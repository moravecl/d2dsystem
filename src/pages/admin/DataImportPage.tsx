import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DatabaseBackup, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2,
  ChevronRight, ChevronLeft, Users, Building2, ListChecks, Play, RotateCcw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import { logAudit } from '../../lib/auditLog';
import {
  parseFlowiiFile, collectUserNames, collectFirms, suggestUser,
  ENTITY_LABELS, ENTITY_ORDER, type FlowiiEntity, type ParsedFile, type Row,
} from '../../lib/flowiiImport/parse';
import {
  runFlowiiImport, countImported,
  type ImportScope, type ImportLogLine, type ImportProgress, type ImportCounts,
} from '../../lib/flowiiImport/runner';

type Step = 'files' | 'settings' | 'summary' | 'run';

interface Member { id: string; name: string }

const STEPS: { key: Step; label: string }[] = [
  { key: 'files', label: 'Soubory' },
  { key: 'settings', label: 'Nastavení' },
  { key: 'summary', label: 'Souhrn' },
  { key: 'run', label: 'Import' },
];

const SCOPE_ITEMS: { key: keyof ImportScope; label: string; needs: FlowiiEntity; hint: string }[] = [
  { key: 'partners', label: 'Partneři → Klienti, kontakty, dodavatelé', needs: 'partners', hint: 'Typ „Dodavatel" jde do číselníku dodavatelů, ostatní do CRM.' },
  { key: 'pricelist', label: 'Ceník → Katalog produktů', needs: 'pricelist', hint: 'Kategorie a podkategorie se založí podle ceníku.' },
  { key: 'jobs', label: 'Zakázky → Projekty', needs: 'jobs', hint: 'Číslo zakázky zůstane jako legacy číslo, technická pole FVE se uloží k projektu.' },
  { key: 'cases', label: 'Obchodní případy → Leady', needs: 'cases', hint: 'Úspěch = převedený lead s vazbou na projekt, Neúspěch = ztracený.' },
  { key: 'tasks', label: 'Úkoly', needs: 'tasks', hint: 'Vazba na projekt přes číslo zakázky.' },
  { key: 'events', label: 'Události → Kalendář', needs: 'events', hint: 'Typy událostí se doplní do číselníku.' },
  { key: 'issued', label: 'Doklady → Vydané faktury', needs: 'documents', hint: 'Faktury, zálohy, DD k záloze, vyúčtování, dobropisy (jedna souhrnná položka).' },
  { key: 'received', label: 'Doklady → Přijaté faktury', needs: 'documents', hint: 'Chybějící dodavatelé se založí.' },
  { key: 'finance', label: 'Příjmy a výdaje → Úhrady + cashflow', needs: 'finance', hint: 'Úhrady se spárují s fakturami, zbytek jde do ručních pohybů cashflow.' },
];

const TABLE_LABELS: Record<string, string> = {
  clients: 'Klienti', suppliers: 'Dodavatelé', client_contacts: 'Kontakty', client_addresses: 'Adresy',
  products: 'Produkty', projects: 'Projekty', leads: 'Leady', tasks: 'Úkoly', events: 'Události',
  invoices: 'Vydané faktury', invoice_items: 'Položky faktur', received_invoices: 'Přijaté faktury',
  payments_matched: 'Spárované úhrady', cashflow_manual_entries: 'Pohyby cashflow',
};

const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

export default function DataImportPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('files');
  const [parsed, setParsed] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [firms, setFirms] = useState<string[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string | null>>({});
  const [tasksRule, setTasksRule] = useState<'open_active' | 'all_done'>('open_active');
  const [scope, setScope] = useState<ImportScope>({
    partners: true, pricelist: true, jobs: true, cases: true, tasks: true, events: true, issued: true, received: true, finance: true,
  });
  const [existing, setExisting] = useState<Record<string, number> | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [logs, setLogs] = useState<ImportLogLine[]>([]);
  const [result, setResult] = useState<ImportCounts | null>(null);

  const files = useMemo(() => {
    const out: Partial<Record<FlowiiEntity, Row[]>> = {};
    for (const p of parsed) if (p.entity) out[p.entity] = [...(out[p.entity] || []), ...p.rows];
    return out;
  }, [parsed]);

  const allFirms = useMemo(() => collectFirms(files), [files]);
  const userNames = useMemo(() => collectUserNames(files), [files]);

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data: mem } = await supabase.from('organization_members').select('user_id').eq('organization_id', organization.id);
      const ids = (mem || []).map(m => m.user_id as string);
      if (ids.length === 0) return;
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', ids);
      setMembers(((profiles || []) as { id: string; display_name: string; email: string }[])
        .map(p => ({ id: p.id, name: p.display_name || p.email })));
    })();
  }, [organization]);

  // výchozí mapování uživatelů a subjektů po načtení souborů
  useEffect(() => {
    setFirms(allFirms);
  }, [allFirms]);
  useEffect(() => {
    setUserMap(prev => {
      const next: Record<string, string | null> = {};
      for (const n of userNames) next[n] = prev[n] !== undefined ? prev[n] : suggestUser(n, members);
      return next;
    });
  }, [userNames, members]);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setParsing(true);
    const out: ParsedFile[] = [...parsed];
    for (const f of Array.from(list)) {
      try {
        const p = await parseFlowiiFile(f);
        const idx = out.findIndex(x => x.entity && x.entity === p.entity);
        if (idx >= 0) out[idx] = p; else out.push(p);
      } catch (e) {
        toast(`${f.name}: soubor se nepodařilo přečíst (${(e as Error).message})`, 'error');
      }
    }
    setParsed(out);
    setParsing(false);
  };

  const removeFile = (name: string) => setParsed(prev => prev.filter(p => p.fileName !== name));

  const goSummary = async () => {
    if (!organization) return;
    setStep('summary');
    setExisting(null);
    setExisting(await countImported(organization.id));
  };

  const start = async () => {
    if (!organization || !user) return;
    setRunning(true);
    setStep('run');
    setLogs([]);
    setResult(null);
    setProgress(null);
    try {
      const counts = await runFlowiiImport(files, {
        orgId: organization.id, userId: user.id, firms, userMap, tasksRule, scope,
      }, {
        onProgress: p => setProgress(p),
        onLog: l => setLogs(prev => [...prev, l]),
      });
      setResult(counts);
      await logAudit('organization', organization.id, 'data_import', { source: 'flowii', counts, firms });
      toast('Import dokončen');
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', text: `Import přerušen: ${(e as Error).message}` }]);
      toast('Import selhal', 'error');
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setStep('files'); setParsed([]); setResult(null); setLogs([]); setProgress(null); setExisting(null);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const hasAny = Object.keys(files).length > 0;
  const errorCount = logs.filter(l => l.level === 'error').length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <DatabaseBackup className="w-6 h-6 text-slate-300" />
          <h1 className="text-xl font-bold text-white">Import dat z jiného systému</h1>
        </div>
        <p className="text-sm text-slate-500">
          Přenos zálohy z Flowii (partneři, zakázky, obchodní případy, úkoly, události, doklady, ceník, příjmy a výdaje).
          Import je opakovatelný — každý záznam si nese původní identifikátor, druhé spuštění nic nezduplikuje.
        </p>
      </div>

      {/* kroky */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              i === stepIndex ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                : i < stepIndex ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-slate-500 border-white/[0.06]'
            }`}>
              <span className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px]">{i < stepIndex ? '✓' : i + 1}</span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------- 1 soubory */}
      {step === 'files' && (
        <div className="space-y-4">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/[0.12] hover:border-blue-400/40 rounded-2xl p-10 text-center cursor-pointer transition bg-white/[0.02]"
          >
            <input ref={fileInputRef} type="file" multiple accept=".xlsx" className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
            {parsing ? <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" /> : <Upload className="w-8 h-8 text-slate-500 mx-auto" />}
            <p className="text-sm font-semibold text-slate-300 mt-3">Přetáhni sem všech 8 XLSX souborů ze zálohy (nebo klikni)</p>
            <p className="text-xs text-slate-500 mt-1">Soubory se rozpoznají podle obsahu, na názvech nezáleží. Lze přidávat postupně.</p>
          </div>

          {parsed.length > 0 && (
            <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
              {ENTITY_ORDER.map(ent => {
                const p = parsed.find(x => x.entity === ent);
                return (
                  <div key={ent} className="flex items-center gap-3 px-4 py-2.5">
                    {p ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <span className="w-4 h-4 rounded-full border border-white/[0.15] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${p ? 'text-white' : 'text-slate-500'}`}>{ENTITY_LABELS[ent]}</div>
                      {p && <div className="text-[11px] text-slate-500 truncate">{p.fileName} · {p.rows.length.toLocaleString('cs-CZ')} řádků</div>}
                    </div>
                    {p && <button onClick={() => removeFile(p.fileName)} className="p-1 text-slate-500 hover:text-red-400 transition"><XCircle className="w-4 h-4" /></button>}
                  </div>
                );
              })}
              {parsed.filter(p => !p.entity).map(p => (
                <div key={p.fileName} className="flex items-center gap-3 px-4 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-amber-300">Nerozpoznaný soubor</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.fileName} · hlavičky: {p.headers.slice(0, 6).join(', ')}…</div>
                  </div>
                  <button onClick={() => removeFile(p.fileName)} className="p-1 text-slate-500 hover:text-red-400 transition"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep('settings')} disabled={!hasAny} className="flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-40">
              Pokračovat <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- 2 nastavení */}
      {step === 'settings' && (
        <div className="space-y-5">
          {allFirms.length > 1 && (
            <section className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-orange-400" /> Subjekty v záloze
              </h2>
              <p className="text-xs text-slate-500 mb-3">Záloha obsahuje data více účetních subjektů. Vyber, které importovat do této organizace ({organization?.name}).</p>
              <div className="flex flex-wrap gap-2">
                {allFirms.map(f => {
                  const on = firms.includes(f);
                  return (
                    <button key={f} onClick={() => setFirms(prev => on ? prev.filter(x => x !== f) : [...prev, f])}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition ${on ? 'bg-orange-600/20 text-orange-300 border-orange-500/30' : 'text-slate-400 border-white/[0.08] hover:text-white'}`}>
                      {on ? '✓ ' : ''}{f}
                    </button>
                  );
                })}
              </div>
              {firms.length === 0 && <p className="text-xs text-red-400 mt-2">Vyber alespoň jeden subjekt.</p>}
            </section>
          )}

          <section className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-1">
              <ListChecks className="w-4 h-4 text-blue-400" /> Co importovat
            </h2>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {SCOPE_ITEMS.map(item => {
                const available = !!files[item.needs];
                const on = scope[item.key] && available;
                return (
                  <button key={item.key} disabled={!available} onClick={() => setScope(s => ({ ...s, [item.key]: !s[item.key] }))}
                    className={`text-left px-3 py-2.5 rounded-xl border transition ${!available ? 'opacity-40 cursor-not-allowed border-white/[0.05]' : on ? 'bg-blue-600/15 border-blue-500/30' : 'border-white/[0.08] hover:border-white/[0.15]'}`}>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>{on && <CheckCircle2 className="w-3 h-3 text-white" />}</span>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 pl-6">{available ? item.hint : 'Soubor nebyl nahrán.'}</div>
                  </button>
                );
              })}
            </div>
            {files.tasks && scope.tasks && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="text-xs font-bold text-slate-400 mb-2">Stav úkolů (export stav neobsahuje)</div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['open_active', 'Úkoly otevřených zakázek jako „k udělání", ostatní hotové'],
                    ['all_done', 'Všechny jako hotová historie'],
                  ] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTasksRule(k)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${tasksRule === k ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'text-slate-400 border-white/[0.08] hover:text-white'}`}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {userNames.length > 0 && (
            <section className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-400" /> Mapování uživatelů
              </h2>
              <p className="text-xs text-slate-500 mb-3">Jména ze starého systému → účty v nové organizaci (odpovědné osoby, řešitelé úkolů, zadavatelé). Nenamapovaná jména zůstanou bez přiřazení; autor záznamu budeš ty.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {userNames.map(n => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 w-40 truncate" title={n}>{n}</span>
                    <select value={userMap[n] || ''} onChange={e => setUserMap(m => ({ ...m, [n]: e.target.value || null }))} className={inputCls}>
                      <option value="">— nemapovat —</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('files')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition"><ChevronLeft className="w-4 h-4" /> Zpět</button>
            <button onClick={goSummary} disabled={allFirms.length > 1 && firms.length === 0} className="flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-40">
              Souhrn <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- 3 souhrn */}
      {step === 'summary' && (
        <div className="space-y-4">
          <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Co se stane</h2>
            <div className="divide-y divide-white/[0.06]">
              {SCOPE_ITEMS.filter(i => scope[i.key] && files[i.needs]).map(i => {
                const rows = files[i.needs] || [];
                const firmCol = ['jobs', 'cases', 'documents', 'finance'].includes(i.needs);
                const n = firmCol && firms.length ? rows.filter(r => !r['Firma'] || firms.includes(r['Firma'])).length : rows.length;
                return (
                  <div key={i.key} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-200">{i.label}</span>
                    <span className="text-slate-400 tabular-nums">{n.toLocaleString('cs-CZ')} řádků</span>
                  </div>
                );
              })}
            </div>
            {allFirms.length > 1 && <p className="text-xs text-slate-500 mt-3">Subjekty: {firms.join(', ')}</p>}
          </div>

          <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Už dříve importováno</h2>
            {existing === null ? <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Zjišťuji…</div>
              : Object.values(existing).every(v => v === 0)
                ? <p className="text-xs text-emerald-400">V organizaci zatím žádná data z tohoto zdroje nejsou — půjde o první import.</p>
                : (
                  <div className="text-xs text-slate-400">
                    <p className="text-amber-300 mb-1">Část dat už importována je — spuštění je aktualizuje (podle původního identifikátoru), nic se nezduplikuje:</p>
                    {Object.entries(existing).filter(([, v]) => v > 0).map(([k, v]) => <span key={k} className="inline-block mr-3">{TABLE_LABELS[k] || k}: <b className="text-slate-200">{v}</b></span>)}
                  </div>
                )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('settings')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition"><ChevronLeft className="w-4 h-4" /> Zpět</button>
            <button onClick={start} disabled={existing === null} className="flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-40">
              <Play className="w-4 h-4" /> Spustit import
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- 4 běh */}
      {step === 'run' && (
        <div className="space-y-4">
          <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5">
            {running ? (
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white"><Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> {progress?.step || 'Připravuji…'}</div>
                {progress && progress.total > 0 && (
                  <>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 tabular-nums">{progress.done} / {progress.total}</div>
                  </>
                )}
                <p className="text-xs text-slate-500 mt-3">Nezavírej stránku, import běží v prohlížeči.</p>
              </div>
            ) : result ? (
              <div>
                <div className={`flex items-center gap-2 text-sm font-extrabold ${errorCount ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {errorCount ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {errorCount ? `Import dokončen s ${errorCount} chybami` : 'Import dokončen'}
                </div>
                <div className="grid sm:grid-cols-3 gap-2 mt-4">
                  {Object.entries(result).map(([k, v]) => (
                    <div key={k} className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                      <div className="text-[11px] text-slate-500">{TABLE_LABELS[k] || k}</div>
                      <div className="text-lg font-extrabold text-white tabular-nums">{v.toLocaleString('cs-CZ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-bold text-red-400"><XCircle className="w-4 h-4" /> Import neproběhl</div>
            )}
          </div>

          {logs.length > 0 && (
            <div className="bg-navy-800/60 border border-white/[0.08] rounded-2xl p-4 max-h-80 overflow-y-auto font-mono text-[11px] space-y-0.5">
              {logs.map((l, i) => (
                <div key={i} className={l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-400'}>
                  {l.level === 'error' ? '✖ ' : l.level === 'warn' ? '⚠ ' : '• '}{l.text}
                </div>
              ))}
            </div>
          )}

          {!running && (
            <div className="flex justify-end">
              <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition"><RotateCcw className="w-4 h-4" /> Nový import</button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-slate-500">
        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Očekávané soubory: partneři, seznam obchodních případů, seznam zakázek, seznam úkolů, seznam událostí, seznam dokladů, můj ceník, příjmy a výdaje — export „Záloha dat" z Flowii.</span>
      </div>
    </div>
  );
}
