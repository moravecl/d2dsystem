import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Loader2, Mail, ListChecks, Coins, CheckCircle2, FolderKanban,
  History, ChevronDown, FastForward,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import {
  type TrackedAction, ACTION_TYPE_LABELS, actionSummary, executeAction,
} from '../../lib/aiActions';

interface ClassifyProposal {
  email_id: string;
  project_id: string | null;
  confidence: number;
  reason: string;
}

interface EmailBrief {
  id: string;
  from_email: string;
  from_name: string;
  subject: string;
}

interface ProjectOption { id: string; name: string; project_name: string }
interface AssetOption { id: string; name: string }

interface SummaryRow {
  id: string;
  date_from: string;
  date_to: string;
  emails_count: number;
  summary: string;
  actions: TrackedAction[];
  created_at: string;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * AI Asistent — fáze 1: pošta a akce napříč systémem. Asistent navrhuje
 * (shrnutí, přiřazení, úkoly, události, termíny, leady), uživatel
 * schvaluje; zápisy běží pod jeho účtem přes executeAction (RLS).
 * Každé shrnutí se ukládá do ai_summaries — z toho žije přírůstková
 * analýza „od posledního shrnutí", deduplikace návrhů i historie dole.
 */
export default function AssistantPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  // shrnuti
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(7));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [summaryMeta, setSummaryMeta] = useState('');
  const [actions, setActions] = useState<TrackedAction[]>([]);
  const [selectedActions, setSelectedActions] = useState<Set<number>>(new Set());
  const [executing, setExecuting] = useState(false);

  // trideni
  const [classifying, setClassifying] = useState(false);
  const [proposals, setProposals] = useState<ClassifyProposal[]>([]);
  const [proposalEmails, setProposalEmails] = useState<Map<string, EmailBrief>>(new Map());
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  // ciselniky, historie, naklady
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [historyRows, setHistoryRows] = useState<SummaryRow[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [monthCost, setMonthCost] = useState(0);

  const loadStatic = useCallback(async () => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [projRes, assetRes, runsRes, unassignedRes, summariesRes] = await Promise.all([
      supabase.from('projects').select('id, name, project_name').order('updated_at', { ascending: false }),
      supabase.from('assets').select('id, name').order('name'),
      supabase.from('ai_runs').select('cost_usd').gte('created_at', monthStart.toISOString()),
      supabase.from('emails').select('id', { count: 'exact', head: true }).eq('assignment_status', 'unassigned'),
      supabase.from('ai_summaries').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setProjects((projRes.data ?? []) as ProjectOption[]);
    setAssets((assetRes.data ?? []) as AssetOption[]);
    setMonthCost(((runsRes.data ?? []) as { cost_usd: number }[])
      .reduce((s, r) => s + Number(r.cost_usd), 0));
    setUnassignedCount(unassignedRes.count ?? 0);
    setHistoryRows((summariesRes.data ?? []) as SummaryRow[]);
  }, []);

  useEffect(() => { loadStatic(); }, [loadStatic]);

  const lastSummary = historyRows[0] ?? null;

  const callAssistant = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    // AI muze premyslet i desitky sekund; po 4 minutach to vzdavame
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return await res.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { error: 'Časový limit vypršel — zkuste kratší období' };
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  const runSummarize = async (fromIso: string, toIso: string) => {
    setSummarizing(true);
    setSummary(''); setActions([]); setSelectedActions(new Set()); setSummaryId(null);
    try {
      const result = await callAssistant({
        action: 'summarize_emails',
        date_from: fromIso,
        date_to: toIso,
        only_unassigned: onlyUnassigned,
      });
      if (!result.ok) { toast(result.error || 'Shrnutí selhalo', 'error'); setSummarizing(false); return; }
      setSummary(result.summary || '');
      const acts = (result.actions ?? []) as TrackedAction[];
      setActions(acts);
      setSummaryId(result.summary_id ?? null);
      setSelectedActions(new Set(acts.map((_, i) => i)));
      setSummaryMeta(`${result.emails_count} e-mailů${result.truncated ? ' (zkráceno)' : ''}`);
      loadStatic();
    } catch {
      toast('Shrnutí selhalo', 'error');
    }
    setSummarizing(false);
  };

  const handleSummarizeRange = () =>
    runSummarize(`${dateFrom}T00:00:00Z`, `${dateTo}T23:59:59Z`);

  const handleSummarizeSinceLast = () => {
    if (!lastSummary) return;
    runSummarize(lastSummary.date_to, new Date().toISOString());
  };

  const persistActionStatuses = async (id: string | null, acts: TrackedAction[]) => {
    if (!id) return;
    await supabase.from('ai_summaries').update({ actions: acts }).eq('id', id);
  };

  const handleExecuteSelected = async () => {
    if (!user || !organization) return;
    setExecuting(true);
    let ok = 0; let failed = 0;
    const next = [...actions];
    for (const [i, action] of actions.entries()) {
      if (!selectedActions.has(i) || action.status === 'executed') continue;
      const err = await executeAction(action, { userId: user.id, orgId: organization.id });
      if (err) { failed++; toast(`${ACTION_TYPE_LABELS[action.type]}: ${err}`, 'error'); }
      else { ok++; next[i] = { ...action, status: 'executed' }; }
    }
    setActions(next);
    setSelectedActions(new Set());
    await persistActionStatuses(summaryId, next);
    setExecuting(false);
    if (ok > 0) toast(`Provedeno ${ok} akcí${failed ? `, ${failed} selhalo` : ''}`);
    loadStatic();
  };

  const handleClassify = async () => {
    setClassifying(true);
    setProposals([]); setSelectedProposals(new Set());
    try {
      const result = await callAssistant({ action: 'classify_emails' });
      if (!result.ok) { toast(result.error || 'Třídění selhalo', 'error'); setClassifying(false); return; }
      const props = (result.proposals ?? []) as ClassifyProposal[];
      setProposals(props);
      setSelectedProposals(new Set(
        props.filter((p) => p.project_id && p.confidence >= 0.5).map((p) => p.email_id),
      ));
      if (props.length > 0) {
        const { data } = await supabase
          .from('emails')
          .select('id, from_email, from_name, subject')
          .in('id', props.map((p) => p.email_id));
        setProposalEmails(new Map(((data ?? []) as EmailBrief[]).map((e) => [e.id, e])));
      } else {
        toast(result.emails_count === 0 ? 'Žádné nepřiřazené e-maily' : 'Asistent nenašel žádná jistá přiřazení');
      }
      loadStatic();
    } catch {
      toast('Třídění selhalo', 'error');
    }
    setClassifying(false);
  };

  const handleAssignSelected = async () => {
    if (!user || !organization) return;
    setAssigning(true);
    let ok = 0;
    const remaining: ClassifyProposal[] = [];
    for (const p of proposals) {
      if (!selectedProposals.has(p.email_id) || !p.project_id) { remaining.push(p); continue; }
      const err = await executeAction(
        { type: 'assign_email', email_id: p.email_id, project_id: p.project_id, reason: p.reason },
        { userId: user.id, orgId: organization.id },
      );
      if (err) { remaining.push(p); toast(err, 'error'); } else ok++;
    }
    setProposals(remaining);
    setSelectedProposals(new Set());
    setAssigning(false);
    if (ok > 0) toast(`Přiřazeno ${ok} e-mailů`);
    loadStatic();
  };

  const projectName = (id: string | null) => {
    if (!id) return '';
    const p = projects.find((pr) => pr.id === id);
    return p ? (p.project_name || p.name) : '';
  };

  const updateAction = (index: number, patch: Partial<TrackedAction>) => {
    setActions((prev) => prev.map((a, i) => i === index ? { ...a, ...patch } as TrackedAction : a));
  };

  const renderActionRow = (a: TrackedAction, i: number, interactive: boolean) => (
    <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02] ${a.status === 'executed' ? 'opacity-70' : ''}`}>
      {interactive && (
        a.status === 'executed' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <input
            type="checkbox"
            checked={selectedActions.has(i)}
            onChange={() => setSelectedActions((prev) => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i); else next.add(i);
              return next;
            })}
            className="w-4 h-4 accent-emerald-500 shrink-0"
          />
        )
      )}
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 shrink-0">
        {ACTION_TYPE_LABELS[a.type] ?? a.type}
      </span>
      <span className="flex-1 text-sm text-slate-200 min-w-0 truncate">{actionSummary(a)}</span>
      {interactive && a.type === 'create_due_item' && !a.asset_id && a.status !== 'executed' && (
        <select
          value={a.asset_id ?? ''}
          onChange={(e) => updateAction(i, { asset_id: e.target.value || null })}
          className="px-2 py-1 text-xs border border-amber-500/40 rounded-lg bg-white/[0.06] text-slate-300 outline-none shrink-0"
        >
          <option value="">Vyberte majetek…</option>
          {assets.map((as) => <option key={as.id} value={as.id}>{as.name}</option>)}
        </select>
      )}
      {a.type === 'assign_email' && (
        <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
          <FolderKanban className="w-3 h-3" /> {projectName(a.project_id)}
        </span>
      )}
      {!interactive && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
          a.status === 'executed'
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-white/[0.08] text-slate-400'
        }`}>
          {a.status === 'executed' ? 'Provedeno' : 'Neprovedeno'}
        </span>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Sparkles className="w-6 h-6 text-violet-400" />
            <h1 className="text-xl font-bold text-white">AI Asistent</h1>
          </div>
          <p className="text-sm text-slate-500">
            Shrne poštu, roztřídí e-maily a navrhne akce — každý zápis nejdřív schválíte
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.06] px-3 py-2 rounded-xl">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          Tento měsíc: ~{(monthCost * 25).toFixed(0)} Kč ({monthCost.toFixed(2)} USD)
        </div>
      </div>

      {/* Shrnuti posty */}
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" /> Shrnutí pošty
        </h2>
        <div className="flex items-end gap-3 flex-wrap">
          {lastSummary && (
            <button
              onClick={handleSummarizeSinceLast}
              disabled={summarizing}
              title={`Poslední shrnutí: ${fmtDateTime(lastSummary.created_at)}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FastForward className="w-4 h-4" />}
              Od posledního shrnutí
            </button>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Od</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Do</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none" />
          </div>
          <label className="flex items-center gap-2 pb-2.5 cursor-pointer">
            <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            <span className="text-sm text-slate-300">Jen nepřiřazené</span>
          </label>
          <button
            onClick={handleSummarizeRange}
            disabled={summarizing}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition disabled:opacity-50 ${
              lastSummary
                ? 'bg-white/[0.06] hover:bg-white/[0.10] text-slate-300'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {summarizing ? 'Pracuji…' : 'Shrnout období'}
          </button>
        </div>
        {lastSummary && !summarizing && (
          <p className="text-xs text-slate-500">
            Poslední shrnutí proběhlo {fmtDateTime(lastSummary.created_at)} (pokrývá poštu do {fmtDateTime(lastSummary.date_to)}).
          </p>
        )}
        {summarizing && (
          <p className="text-xs text-slate-500">
            Asistent čte e-maily a přemýšlí — obvykle do půl minuty, u delšího období i déle. Stránku nechte otevřenou.
          </p>
        )}

        {summary && (
          <div className="space-y-4">
            <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Shrnutí ({summaryMeta})
              </div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{summary}</div>
            </div>

            {actions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Navržené akce ({actions.length})
                  </div>
                  <button
                    onClick={handleExecuteSelected}
                    disabled={executing || selectedActions.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Provést vybrané ({selectedActions.size})
                  </button>
                </div>
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
                  {actions.map((a, i) => renderActionRow(a, i, true))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trideni e-mailu */}
      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" /> Roztřídit nepřiřazené e-maily
            {unassignedCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {unassignedCount}
              </span>
            )}
          </h2>
          <button
            onClick={handleClassify}
            disabled={classifying || unassignedCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {classifying ? 'Třídím…' : 'Navrhnout přiřazení'}
          </button>
        </div>

        {proposals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <button
                onClick={handleAssignSelected}
                disabled={assigning || selectedProposals.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Přiřadit vybrané ({selectedProposals.size})
              </button>
            </div>
            <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
              {proposals.map((p) => {
                const email = proposalEmails.get(p.email_id);
                return (
                  <div key={p.email_id} className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02]">
                    <input
                      type="checkbox"
                      checked={selectedProposals.has(p.email_id)}
                      disabled={!p.project_id}
                      onChange={() => setSelectedProposals((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.email_id)) next.delete(p.email_id); else next.add(p.email_id);
                        return next;
                      })}
                      className="w-4 h-4 accent-emerald-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{email?.subject || '(bez předmětu)'}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {email ? (email.from_name || email.from_email) : p.email_id} — {p.reason}
                      </div>
                    </div>
                    <select
                      value={p.project_id ?? ''}
                      onChange={(e) => setProposals((prev) => prev.map((x) =>
                        x.email_id === p.email_id ? { ...x, project_id: e.target.value || null } : x))}
                      className="px-2 py-1 text-xs border border-white/10 rounded-lg bg-white/[0.06] text-slate-300 outline-none shrink-0 max-w-[180px]"
                    >
                      <option value="">Nepřiřazovat</option>
                      {projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>{pr.project_name || pr.name}</option>
                      ))}
                    </select>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      p.confidence >= 0.7 ? 'bg-emerald-500/20 text-emerald-300'
                        : p.confidence >= 0.5 ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-white/[0.08] text-slate-400'
                    }`}>
                      {Math.round(p.confidence * 100)} %
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Historie shrnuti */}
      {historyRows.length > 0 && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-slate-400" /> Historie shrnutí
          </h2>
          <div className="divide-y divide-white/[0.06]">
            {historyRows.map((row) => {
              const acts = (row.actions ?? []) as TrackedAction[];
              const executed = acts.filter((a) => a.status === 'executed').length;
              const open = expandedHistory.has(row.id);
              return (
                <div key={row.id} className="py-2">
                  <button
                    onClick={() => setExpandedHistory((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-3 text-left py-1"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    <span className="text-sm text-slate-200 font-semibold shrink-0">
                      {fmtDateTime(row.created_at)}
                    </span>
                    <span className="text-xs text-slate-500 flex-1 min-w-0 truncate">
                      {new Date(row.date_from).toLocaleDateString('cs-CZ')} – {new Date(row.date_to).toLocaleDateString('cs-CZ')}
                      {' · '}{row.emails_count} e-mailů
                    </span>
                    {acts.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 shrink-0">
                        {executed}/{acts.length} akcí provedeno
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="mt-2 ml-7 space-y-3">
                      <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {row.summary || '(bez textu)'}
                      </div>
                      {acts.length > 0 && (
                        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] overflow-hidden">
                          {acts.map((a, i) => renderActionRow(a, i, false))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
