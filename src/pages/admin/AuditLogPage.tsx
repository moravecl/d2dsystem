import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw, Loader2, Calendar, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';

interface AuditEntry {
 id: string;
 user_id: string;
 entity_type: string;
 entity_id: string | null;
 action: string;
 details: Record<string, unknown>;
 created_at: string;
 profile?: { display_name: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
 created: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
 updated: 'bg-blue-500/10 text-blue-400 border-blue-200',
 deleted: 'bg-red-500/10 text-red-400 border-red-200',
 viewed: 'bg-white/[0.04] text-slate-400 border-white/10',
 login: 'bg-amber-500/10 text-amber-700 border-amber-200',
 logout: 'bg-white/[0.04] text-slate-500 border-white/10',
};

const ACTION_LABELS: Record<string, string> = {
 created: 'Vytvořeno',
 updated: 'Upraveno',
 deleted: 'Smazáno',
 viewed: 'Zobrazeno',
 login: 'Přihlášení',
 logout: 'Odhlášení',
};

const ENTITY_LABELS: Record<string, string> = {
 project: 'Projekt',
 client: 'Klient',
 invoice: 'Faktura',
 employee: 'Zaměstnanec',
 task: 'Úkol',
 user: 'Uživatel',
 organization: 'Organizace',
 product: 'Položka',
 worklog: 'Pracovní záznam',
};

export default function AuditLogPage() {
 const { organization } = useOrganization();
 const [entries, setEntries] = useState<AuditEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [actionFilter, setActionFilter] = useState('');
 const [entityFilter, setEntityFilter] = useState('');
 const [page, setPage] = useState(0);
 const PAGE_SIZE = 50;

 const load = useCallback(async () => {
 setLoading(true);

 let query = supabase
 .from('audit_log')
 .select('*')
 .order('created_at', { ascending: false })
 .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

 if (actionFilter) query = query.eq('action', actionFilter);
 if (entityFilter) query = query.eq('entity_type', entityFilter);

 const { data, error } = await query;

 if (error || !data) {
 setLoading(false);
 return;
 }

 const userIds = [...new Set(data.map(e => e.user_id))];
 const { data: profiles } = await supabase
 .from('profiles')
 .select('id, display_name, email')
 .in('id', userIds);

 const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

 setEntries(data.map(e => ({
 ...e,
 details: (e.details as Record<string, unknown>) ?? {},
 profile: profileMap[e.user_id] ?? null,
 })));
 setLoading(false);
 }, [page, actionFilter, entityFilter]);

 useEffect(() => {
 load();
 }, [load]);

 const filtered = entries.filter(e => {
 if (!search) return true;
 const q = search.toLowerCase();
 return (
 e.entity_type.includes(q) ||
 e.action.includes(q) ||
 (e.profile?.display_name ?? '').toLowerCase().includes(q) ||
 (e.profile?.email ?? '').toLowerCase().includes(q) ||
 JSON.stringify(e.details).toLowerCase().includes(q)
 );
 });

 const formatDate = (iso: string) => {
 const d = new Date(iso);
 return d.toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
 };

 return (
 <div className="p-6 max-w-6xl mx-auto space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold text-white flex items-center gap-2">
 <ClipboardList className="w-5 h-5 text-slate-500"/>
 Audit log
 </h1>
 <p className="text-sm text-slate-500 mt-0.5">
 Záznamy všech akcí v systému {organization?.name ? `· ${organization.name}` : ''}
 </p>
 </div>
 <button
 onClick={() => { setPage(0); load(); }}
 className="p-2 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition"
 title="Obnovit"
 >
 <RefreshCw className="w-4 h-4"/>
 </button>
 </div>

 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Hledat podle uživatele, entity, akce..."
 className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
 />
 </div>
 <select
 value={actionFilter}
 onChange={e => { setActionFilter(e.target.value); setPage(0); }}
 className="px-3 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
 >
 <option value="">Všechny akce</option>
 {Object.entries(ACTION_LABELS).map(([k, v]) => (
 <option key={k} value={k}>{v}</option>
 ))}
 </select>
 <select
 value={entityFilter}
 onChange={e => { setEntityFilter(e.target.value); setPage(0); }}
 className="px-3 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
 >
 <option value="">Všechny entity</option>
 {Object.entries(ENTITY_LABELS).map(([k, v]) => (
 <option key={k} value={k}>{v}</option>
 ))}
 </select>
 </div>

 <div className="bg-navy-800/60 rounded-2xl border border-white/10 overflow-hidden">
 <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
 <span className="text-sm font-bold text-slate-300">
 Záznamy
 </span>
 <span className="text-xs text-slate-400">
 Zobrazeno {filtered.length} z {entries.length} záznamů
 </span>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-5 h-5 animate-spin text-slate-400"/>
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-16">
 <div className="w-12 h-12 bg-white/[0.04] rounded-xl flex items-center justify-center mx-auto mb-3">
 <Activity className="w-6 h-6 text-slate-300"/>
 </div>
 <p className="text-sm text-slate-400">Žádné záznamy</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-50">
 {filtered.map(entry => {
 const actionCfg = ACTION_COLORS[entry.action] ?? 'bg-white/[0.04] text-slate-400 border-white/10';
 const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
 const entityLabel = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;

 return (
 <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/[0.04]/50 transition-colors">
 <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
 {(entry.profile?.display_name || entry.profile?.email || '?')[0].toUpperCase()}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-semibold text-white">
 {entry.profile?.display_name || entry.profile?.email || entry.user_id.slice(0, 8)}
 </span>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionCfg}`}>
 {actionLabel}
 </span>
 <span className="text-xs text-slate-500">
 {entityLabel}
 {entry.details && Object.keys(entry.details).length > 0 && (
 <>
 {' · '}
 {(entry.details.name || entry.details.title || entry.details.invoice_number || '').toString().slice(0, 40)}
 </>
 )}
 </span>
 </div>
 {entry.entity_id && (
 <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
 ID: {entry.entity_id.slice(0, 8)}…
 </p>
 )}
 </div>

 <div className="shrink-0 flex items-center gap-1 text-xs text-slate-400">
 <Calendar className="w-3 h-3"/>
 {formatDate(entry.created_at)}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {entries.length === PAGE_SIZE && (
 <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center justify-between">
 <button
 onClick={() => setPage(p => Math.max(0, p - 1))}
 disabled={page === 0}
 className="px-4 py-1.5 text-xs font-semibold text-slate-400 border border-white/10 rounded-lg hover:bg-white/[0.04] disabled:opacity-40 transition"
 >
 Předchozí
 </button>
 <span className="text-xs text-slate-400">Strana {page + 1}</span>
 <button
 onClick={() => setPage(p => p + 1)}
 className="px-4 py-1.5 text-xs font-semibold text-slate-400 border border-white/10 rounded-lg hover:bg-white/[0.04] transition"
 >
 Další
 </button>
 </div>
 )}
 </div>
 </div>
 );
}
