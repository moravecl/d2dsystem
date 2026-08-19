import { useState, useEffect, useCallback } from 'react';
import {
  Search, Ticket, ChevronRight, Calendar,
  List, LayoutGrid, Archive, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import KanbanBoard, { getColorConfig } from '../../components/ui/KanbanBoard';
import { useKanbanColumns } from '../../hooks/useKanbanColumns';
import ServiceTicketDetailDrawer from './ServiceTicketDetailDrawer';

interface TicketRow {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  reported_by_portal: boolean;
  created_at: string;
  project_name: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name?: string;
}

const PRIORITY_MAP: Record<string, { label: string; dot: string }> = {
  low: { label: 'Nízká', dot: 'bg-slate-400' },
  normal: { label: 'Normální', dot: 'bg-blue-500/100' },
  high: { label: 'Vysoká', dot: 'bg-amber-500/100' },
  urgent: { label: 'Urgentní', dot: 'bg-red-500/100' },
};

export default function ServiceTicketsList() {
  const { isAdmin } = useOrganization();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const { columns, loading: colsLoading, addColumn, updateColumn, removeColumn } = useKanbanColumns('service_tickets');

  const loadTickets = useCallback(async () => {
    let q = supabase
      .from('service_tickets')
      .select('id, project_id, title, description, status, priority, reported_by_portal, created_at, resolved_at, resolved_by')
      .order('created_at', { ascending: false });

    if (priorityFilter) q = q.eq('priority', priorityFilter);

    if (showArchive) {
      q = q.not('resolved_at', 'is', null);
    } else {
      q = q.is('resolved_at', null);
    }

    const { data } = await q;
    const rows = (data || []) as any[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
    const resolvedByIds = [...new Set(rows.map((r) => r.resolved_by).filter(Boolean))];

    let projectMap = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projects } = await supabase.from('projects').select('id, project_name').in('id', projectIds);
      projectMap = new Map((projects || []).map((p: any) => [p.id, p.project_name]));
    }

    let resolvedByMap = new Map<string, string>();
    if (resolvedByIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', resolvedByIds);
      resolvedByMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));
    }

    setTickets(rows.map((r) => ({
      ...r,
      project_name: projectMap.get(r.project_id) || '',
      resolved_by_name: resolvedByMap.get(r.resolved_by) || '',
    })));
    setLoading(false);
  }, [priorityFilter, showArchive]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const updateStatus = async (ticketId: string, newStatus: string) => {
    const updates: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    await supabase.from('service_tickets').update(updates).eq('id', ticketId);
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
    toast('Status aktualizován', 'success');
  };

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.project_name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  const isLoading = loading || colsLoading;

  const renderTicketCard = (ticket: TicketRow) => {
    const pr = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;

    return (
      <div
        className="bg-navy-800/60 rounded-lg border border-white/10 p-3 transition-shadow cursor-pointer group hover:border-white/20"
        onClick={() => setSelectedTicketId(ticket.id)}
      >
        <div className="flex items-start gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${pr.dot}`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{ticket.title}</h4>
            {ticket.project_name && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{ticket.project_name}</p>
            )}
          </div>
        </div>

        {ticket.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">{ticket.description}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(ticket.created_at).toLocaleDateString('cs-CZ')}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{pr.label}</span>
            {ticket.reported_by_portal && (
              <span className="text-[10px] font-bold text-cyan-600 bg-cyan-500/10 px-1.5 py-0.5 rounded">Portal</span>
            )}
          </div>
        </div>

        {ticket.resolved_at && (
          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-emerald-500/20 bg-emerald-500/5 -mx-3 -mb-3 px-3 py-2 rounded-b-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-emerald-400">
              Dokončeno {new Date(ticket.resolved_at).toLocaleDateString('cs-CZ')}
              {ticket.resolved_by_name && ` - ${ticket.resolved_by_name}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat tikety..." className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition ${priorityFilter ? 'bg-blue-500/10 border-blue-200 text-blue-400 font-semibold' : 'bg-white/[0.06] border-white/10 text-slate-400'}`}
        >
          <option value="">Všechny priority</option>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button
          onClick={() => setShowArchive(!showArchive)}
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition ${showArchive ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-semibold' : 'bg-white/[0.06] border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
        >
          <Archive className="w-4 h-4" />
          {showArchive ? 'Archiv' : 'Zobrazit archiv'}
        </button>
        <div className="flex bg-white/[0.06] rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'kanban' ? 'bg-white/[0.06] text-white ' : 'text-slate-500'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'list' ? 'bg-white/[0.06] text-white ' : 'text-slate-500'}`}
          >
            <List className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Seznam
          </button>
        </div>
      </div>

      {filtered.length === 0 && !search ? (
        <div className="text-center py-16">
          <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Žádné servisní tikety</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard<TicketRow>
          columns={columns}
          items={filtered}
          getItemStatus={(t) => t.status}
          getItemId={(t) => t.id}
          renderCard={renderTicketCard}
          onMoveItem={updateStatus}
          onAddColumn={addColumn}
          onUpdateColumn={(id, u) => updateColumn(id, u)}
          onRemoveColumn={removeColumn}
          canManageColumns={isAdmin}
          emptyText="Žádné tikety"
        />
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
          {filtered.map((t) => {
            const colDef = columns.find((c) => c.key === t.status);
            const colColor = colDef ? getColorConfig(colDef.color) : getColorConfig('slate');
            const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.normal;
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition cursor-pointer"
                onClick={() => setSelectedTicketId(t.id)}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${pr.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{t.title}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colColor.bg} ${colColor.text}`}>
                      {colDef?.label || t.status}
                    </span>
                    {t.reported_by_portal && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600">Portal</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.project_name}</div>
                </div>
                <div className="text-xs text-slate-400 shrink-0">
                  {t.resolved_at ? (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {new Date(t.resolved_at).toLocaleDateString('cs-CZ')}
                      {t.resolved_by_name && <span className="text-emerald-400/70">({t.resolved_by_name})</span>}
                    </span>
                  ) : (
                    new Date(t.created_at).toLocaleDateString('cs-CZ')
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      <ServiceTicketDetailDrawer
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onUpdate={loadTickets}
      />
    </div>
  );
}
