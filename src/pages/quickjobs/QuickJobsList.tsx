import { useState, useEffect, useCallback } from 'react';
import {
  Search, Zap, Calendar, LayoutGrid, List, Plus,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import KanbanBoard, { getColorConfig } from '../../components/ui/KanbanBoard';
import { useKanbanColumns } from '../../hooks/useKanbanColumns';
import type { QuickJobRow } from './quickJobTypes';
import { PRIORITY_MAP } from './quickJobTypes';
import QuickJobDetailDrawer from './QuickJobDetailDrawer';
import QuickJobFormModal from './QuickJobFormModal';
import QuickJobCompletionModal from './QuickJobCompletionModal';

interface Props {
  onAdd: () => void;
  refreshKey: number;
}

export default function QuickJobsList({ onAdd, refreshKey }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useOrganization();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<QuickJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [myOnly, setMyOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedJob, setSelectedJob] = useState<QuickJobRow | null>(null);
  const [editJob, setEditJob] = useState<QuickJobRow | null>(null);
  const [completionJob, setCompletionJob] = useState<QuickJobRow | null>(null);

  const { columns, loading: colsLoading, addColumn, updateColumn, removeColumn } = useKanbanColumns('quick_jobs');

  const loadJobs = useCallback(async () => {
    let q = supabase.from('quick_jobs').select('*').neq('status', 'cancelled').order('created_at', { ascending: false });
    if (priorityFilter) q = q.eq('priority', priorityFilter);
    if (myOnly && user) q = q.eq('claimed_by', user.id);

    const { data } = await q;
    const rows = (data || []) as QuickJobRow[];

    const projectIds = [...new Set(rows.map(r => r.project_id).filter(Boolean))] as string[];
    const claimedIds = [...new Set(rows.map(r => r.claimed_by).filter(Boolean))] as string[];
    const clientIds = [...new Set(rows.map(r => r.client_id).filter(Boolean))] as string[];

    const [projRes, profileRes, clientRes] = await Promise.all([
      projectIds.length > 0 ? supabase.from('projects').select('id, project_name').in('id', projectIds) : Promise.resolve({ data: [] }),
      claimedIds.length > 0 ? supabase.from('profiles').select('id, display_name, email').in('id', claimedIds) : Promise.resolve({ data: [] }),
      clientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] }),
    ]);

    const projMap = new Map((projRes.data || []).map((p: any) => [p.id, p.project_name]));
    const profileMap = new Map((profileRes.data || []).map((p: any) => [p.id, p.display_name || p.email]));
    const clientMap = new Map((clientRes.data || []).map((c: any) => [c.id, c.name]));

    setJobs(rows.map(r => ({
      ...r,
      project_name: r.project_id ? projMap.get(r.project_id) || '' : '',
      claimed_by_name: r.claimed_by ? profileMap.get(r.claimed_by) || '' : '',
      crm_client_name: r.client_id ? clientMap.get(r.client_id) || '' : '',
    })));
    setLoading(false);
  }, [priorityFilter, myOnly, user]);

  useEffect(() => { loadJobs(); }, [loadJobs, refreshKey]);

  const updateStatus = async (jobId: string, newStatus: string) => {
    if (newStatus === 'done') {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        setCompletionJob(job);
        return;
      }
    }
    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'claimed' || newStatus === 'scheduled' || newStatus === 'in_progress') {
      const job = jobs.find(j => j.id === jobId);
      if (!job?.claimed_by) {
        updates.claimed_by = user?.id;
        updates.claimed_at = new Date().toISOString();
      }
    }
    if (newStatus === 'pool') {
      updates.claimed_by = null;
      updates.claimed_at = null;
      updates.scheduled_date = null;
      updates.scheduled_note = '';
    }
    await supabase.from('quick_jobs').update(updates).eq('id', jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    toast('Status aktualizován');
  };

  const filtered = jobs.filter(j => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.title.toLowerCase().includes(q) ||
      (j.client_name || '').toLowerCase().includes(q) ||
      (j.crm_client_name || '').toLowerCase().includes(q) ||
      (j.address || '').toLowerCase().includes(q) ||
      (j.project_name || '').toLowerCase().includes(q);
  });

  const handleJobUpdated = () => {
    setSelectedJob(null);
    loadJobs();
  };

  const renderCard = (job: QuickJobRow) => {
    const pr = PRIORITY_MAP[job.priority] || PRIORITY_MAP.normal;
    const displayClient = job.crm_client_name || job.client_name || '';

    return (
      <div
        className="relative overflow-hidden bg-navy-800/60 rounded-xl border border-white/[0.08] p-3 transition-all cursor-pointer group hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20 hover:scale-[1.01]"
        onClick={() => setSelectedJob(job)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <div className="flex items-start gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${pr.dot}`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{job.title}</h4>
            {displayClient && <p className="text-[11px] text-slate-400 truncate mt-0.5">{displayClient}</p>}
          </div>
        </div>

        {job.address && <p className="text-[11px] text-slate-500 truncate mb-2 flex items-center gap-1"><span className="w-3 h-3 inline-block text-slate-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>{job.address}</p>}

        {(job.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {job.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('cs-CZ') : new Date(job.created_at).toLocaleDateString('cs-CZ')}
          </span>
          <div className="flex items-center gap-1.5">
            {job.estimated_hours > 0 && (
              <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{job.estimated_hours}h</span>
            )}
            {job.claimed_by_name && (
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <User className="w-2.5 h-2.5" />{job.claimed_by_name.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isLoading = loading || colsLoading;

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat zakázky..." className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30" />
          </div>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition ${priorityFilter ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 font-semibold' : 'bg-white/[0.06] border-white/10 text-slate-400'}`}
          >
            <option value="" className="bg-navy-800">Všechny priority</option>
            {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k} className="bg-navy-800">{v.label}</option>)}
          </select>
          <button
            onClick={() => setMyOnly(!myOnly)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${myOnly ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' : 'bg-white/[0.06] border-white/10 text-slate-400'}`}
          >
            Moje
          </button>
          <div className="flex bg-white/[0.06] rounded-lg p-0.5 ml-auto">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'kanban' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'list' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Seznam
            </button>
          </div>
          <button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-sm shadow-blue-500/20 transition">
            <Plus className="w-3.5 h-3.5" /> Nová
          </button>
        </div>

        {filtered.length === 0 && !search ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-sm text-slate-400 mb-4">Žádné rychlé zakázky</p>
            <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]">
              <Plus className="w-4 h-4" /> Přidat první zakázku
            </button>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard<QuickJobRow>
            columns={columns}
            items={filtered}
            getItemStatus={j => j.status}
            getItemId={j => j.id}
            renderCard={renderCard}
            onMoveItem={updateStatus}
            onAddColumn={addColumn}
            onUpdateColumn={(id, u) => updateColumn(id, u)}
            onRemoveColumn={removeColumn}
            canManageColumns={isAdmin}
            emptyText="Žádné zakázky"
          />
        ) : (
          <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
            {filtered.map(j => {
              const colDef = columns.find(c => c.key === j.status);
              const colColor = colDef ? getColorConfig(colDef.color) : getColorConfig('slate');
              const pr = PRIORITY_MAP[j.priority] || PRIORITY_MAP.normal;
              const displayClient = j.crm_client_name || j.client_name || '';
              return (
                <div key={j.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition cursor-pointer" onClick={() => setSelectedJob(j)}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${pr.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{j.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colColor.bg} ${colColor.text}`}>{colDef?.label || j.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {displayClient}{displayClient && j.address ? ' — ' : ''}{j.address}
                    </div>
                  </div>
                  {j.claimed_by_name && <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">{j.claimed_by_name.split(' ')[0]}</span>}
                  <div className="text-xs text-slate-400 shrink-0">{j.scheduled_date ? new Date(j.scheduled_date).toLocaleDateString('cs-CZ') : ''}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedJob && (
        <QuickJobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdated={handleJobUpdated}
          onEdit={j => { setSelectedJob(null); setEditJob(j); }}
        />
      )}

      {editJob && (
        <QuickJobFormModal
          open={!!editJob}
          onClose={() => setEditJob(null)}
          onSaved={() => { setEditJob(null); loadJobs(); }}
          editJob={editJob}
        />
      )}

      {completionJob && (
        <QuickJobCompletionModal
          open={!!completionJob}
          job={completionJob}
          onClose={() => setCompletionJob(null)}
          onCompleted={() => { setCompletionJob(null); loadJobs(); }}
        />
      )}
    </>
  );
}
