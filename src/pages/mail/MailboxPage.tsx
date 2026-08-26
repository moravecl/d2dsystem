import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Inbox, RefreshCw, Reply, FolderKanban, MailOpen, Mail as MailIcon,
  Loader2, Search, Trash2, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import EmailDetail, { type IncomingEmail, formatEmailDate } from '../../components/mail/EmailDetail';
import EmailComposer from '../emailing/EmailComposer';

type Filter = 'unassigned' | 'all' | 'unread';

interface ProjectOption {
  id: string;
  name: string;
  project_name: string;
  client_id: string | null;
}

const PAGE_SIZE = 100;

/**
 * Příchozí pošta: seznam + čtecí panel. E-maily stahuje edge funkce
 * imap-sync (cron / tlačítko), třídí je heuristika — nepřiřazené sem
 * padají se štítkem „Nepřiřazeno" a čekají na ruční přiřazení.
 */
export default function MailboxPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [emails, setEmails] = useState<IncomingEmail[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('unassigned');
  const [projectFilter, setProjectFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('email'));
  const [syncing, setSyncing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const load = useCallback(async () => {
    const [emailsRes, projectsRes] = await Promise.all([
      supabase
        .from('emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from('projects')
        .select('id, name, project_name, client_id')
        .order('updated_at', { ascending: false }),
    ]);
    setEmails((emailsRes.data ?? []) as IncomingEmail[]);
    setProjects((projectsRes.data ?? []) as ProjectOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime na nove e-maily + minutovy polling jako pojistka
  useEffect(() => {
    const channel = supabase
      .channel('emails-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, () => load())
      .subscribe();
    const interval = setInterval(load, 60000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const selected = useMemo(
    () => emails.find((e) => e.id === selectedId) ?? null,
    [emails, selectedId],
  );

  const filtered = useMemo(() => {
    let list = emails;
    if (filter === 'unassigned') list = list.filter((e) => e.assignment_status === 'unassigned');
    if (filter === 'unread') list = list.filter((e) => !e.is_read);
    if (projectFilter) list = list.filter((e) => e.project_id === projectFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        e.subject.toLowerCase().includes(q)
        || e.from_email.toLowerCase().includes(q)
        || e.from_name.toLowerCase().includes(q));
    }
    return list;
  }, [emails, filter, projectFilter, query]);

  const unassignedCount = useMemo(
    () => emails.filter((e) => e.assignment_status === 'unassigned').length,
    [emails],
  );

  const projectName = (id: string | null) => {
    if (!id) return null;
    const p = projects.find((pr) => pr.id === id);
    return p ? (p.project_name || p.name) : null;
  };

  const openEmail = async (email: IncomingEmail) => {
    setSelectedId(email.id);
    setSearchParams({ email: email.id }, { replace: true });
    if (!email.is_read) {
      await supabase.from('emails').update({ is_read: true }).eq('id', email.id);
      setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, is_read: true } : e));
      window.dispatchEvent(new Event('emails-changed'));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    // funkce zpracuje malou davku na jedno zavolani (CPU limit) a vraci
    // `pending` - vola se opakovane, dokud je co stahovat
    let total = 0;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/imap-sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const result = await res.json();
        if (!result.ok) {
          const detail = (result.results ?? [])
            .map((r: { error?: string }) => r.error).filter(Boolean).join('; ');
          toast(detail || result.error || 'Synchronizace selhala', 'error');
          setSyncing(false);
          return;
        }
        const results = (result.results ?? []) as { inserted?: number; pending?: number; error?: string }[];
        total += results.reduce((s, r) => s + (r.inserted ?? 0), 0);
        await load();
        const pending = results.reduce((s, r) => s + (r.pending ?? 0), 0);
        if (pending === 0) break;
      }
      toast(total > 0 ? `Staženo ${total} nových e-mailů` : 'Žádné nové e-maily');
    } catch {
      toast(total > 0
        ? `Staženo ${total} e-mailů, pak synchronizace selhala — zkuste to znovu`
        : 'Synchronizace selhala', 'error');
    }
    setSyncing(false);
  };

  const openAssign = () => {
    setAssignProjectId(selected?.project_id ?? '');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selected || !assignProjectId) return;
    setAssignSaving(true);
    const project = projects.find((p) => p.id === assignProjectId);
    const { error } = await supabase
      .from('emails')
      .update({
        project_id: assignProjectId,
        client_id: project?.client_id ?? selected.client_id,
        assignment_status: 'manual',
        assignment_reason: 'Přiřazeno ručně',
      })
      .eq('id', selected.id);
    if (error) {
      toast('Přiřazení se nepodařilo', 'error');
      setAssignSaving(false);
      return;
    }

    // uceni: kdyz klient projektu nema e-mail, nabidnout doplneni odesilatele
    if (project?.client_id && selected.from_email) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, email, name')
        .eq('id', project.client_id)
        .maybeSingle();
      if (client && !client.email) {
        const ok = confirm(
          `Uložit adresu ${selected.from_email} ke klientovi ${client.name || ''}? `
          + 'Příště se e-maily z této adresy přiřadí automaticky.');
        if (ok) {
          await supabase.from('clients').update({ email: selected.from_email }).eq('id', client.id);
        }
      }
    }

    toast('E-mail přiřazen k projektu');
    setAssignSaving(false);
    setAssignOpen(false);
    setEmails((prev) => prev.map((e) => e.id === selected.id
      ? { ...e, project_id: assignProjectId, assignment_status: 'manual' as const }
      : e));
    window.dispatchEvent(new Event('emails-changed'));
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm('Smazat tento e-mail? Zpráva zůstane ve vaší schránce, zmizí jen ze systému.')) return;
    const { error } = await supabase.from('emails').delete().eq('id', selected.id);
    if (error) { toast('Smazání se nepodařilo', 'error'); return; }
    setEmails((prev) => prev.filter((e) => e.id !== selected.id));
    setSelectedId(null);
    setSearchParams({}, { replace: true });
    window.dispatchEvent(new Event('emails-changed'));
    toast('E-mail smazán');
  };

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'unassigned', label: 'Nepřiřazené', count: unassignedCount },
    { key: 'all', label: 'Vše' },
    { key: 'unread', label: 'Nepřečtené' },
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Inbox className="w-6 h-6 text-slate-300" />
            <h1 className="text-xl font-bold text-white">Pošta</h1>
            {unassignedCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {unassignedCount} nepřiřazeno
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Příchozí e-maily automaticky tříděné k projektům</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Synchronizuji…' : 'Synchronizovat teď'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.10] hover:text-slate-200'
            }`}
          >
            {f.label}{typeof f.count === 'number' && f.count > 0 ? ` (${f.count})` : ''}
          </button>
        ))}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold border border-white/10 rounded-lg bg-white/[0.06] text-slate-300 outline-none"
        >
          <option value="">Všechny projekty</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.project_name || p.name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat odesílatele či předmět…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-white/10 rounded-lg bg-white/[0.06] outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_1fr] gap-4">
        {/* seznam */}
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-y-auto">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center px-6">
              <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">
                {emails.length === 0 ? 'Zatím žádná pošta' : 'Nic neodpovídá filtru'}
              </p>
              {emails.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Zapněte IMAP u účtu v <Link to="/admin/smtp" className="text-blue-400 hover:underline">SMTP účtech</Link> a spusťte synchronizaci.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filtered.map((email) => {
                const pname = projectName(email.project_id);
                return (
                  <button
                    key={email.id}
                    onClick={() => openEmail(email)}
                    className={`w-full text-left px-4 py-3 transition hover:bg-white/[0.04] ${
                      selectedId === email.id ? 'bg-blue-500/[0.08]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {email.is_read
                        ? <MailOpen className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        : <MailIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      <span className={`text-xs truncate flex-1 ${email.is_read ? 'text-slate-400' : 'text-white font-bold'}`}>
                        {email.from_name || email.from_email}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatEmailDate(email.received_at)}</span>
                    </div>
                    <div className={`text-sm truncate mt-0.5 ${email.is_read ? 'text-slate-400' : 'text-slate-200 font-semibold'}`}>
                      {email.subject || '(bez předmětu)'}
                    </div>
                    <div className="mt-1">
                      {pname ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                          <FolderKanban className="w-2.5 h-2.5" /> {pname}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          Nepřiřazeno
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* cteci panel */}
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-center px-6 py-16">
              <div>
                <MailOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Vyberte e-mail ze seznamu</p>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={openAssign}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  {selected.project_id ? 'Přeřadit k jinému projektu' : 'Přiřadit k projektu'}
                </button>
                <button
                  onClick={() => setReplyOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-xs font-bold transition"
                >
                  <Reply className="w-3.5 h-3.5" /> Odpovědět
                </button>
                {selected.project_id && (
                  <Link
                    to={`/projekty/${selected.project_id}?tab=email`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-xs font-bold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Otevřít projekt
                  </Link>
                )}
                <button
                  onClick={handleDelete}
                  className="ml-auto p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition"
                  title="Smazat ze systému"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <EmailDetail email={selected} />
            </div>
          )}
        </div>
      </div>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Přiřadit e-mail k projektu" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] outline-none focus:border-blue-400"
            >
              <option value="">Vyberte projekt…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name || p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAssignOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleAssign}
              disabled={assignSaving || !assignProjectId}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {assignSaving ? 'Ukládám…' : 'Přiřadit'}
            </button>
          </div>
        </div>
      </Modal>

      {selected && (
        <EmailComposer
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          onSent={() => setReplyOpen(false)}
          prefillTo={[selected.from_email]}
          prefillProjectId={selected.project_id ?? undefined}
          prefillSubject={selected.subject.toLowerCase().startsWith('re:')
            ? selected.subject
            : `Re: ${selected.subject}`}
        />
      )}
    </div>
  );
}
