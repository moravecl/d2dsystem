import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Zap, Calendar, Clock, ArrowRight, User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import { STATUS_MAP, PRIORITY_MAP } from '../../pages/quickjobs/quickJobTypes';
import type { QuickJobRow } from '../../pages/quickjobs/quickJobTypes';
import QuickJobFormModal from '../../pages/quickjobs/QuickJobFormModal';
import QuickJobDetailDrawer from '../../pages/quickjobs/QuickJobDetailDrawer';

interface Props {
  projectId: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  address?: string;
  addressLat?: number | null;
  addressLon?: number | null;
}

export default function ProjectQuickJobsTab({ projectId, projectName, clientId, clientName, address, addressLat, addressLon }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<QuickJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<QuickJobRow | null>(null);
  const [editJob, setEditJob] = useState<QuickJobRow | null>(null);

  const loadJobs = useCallback(async () => {
    const { data } = await supabase
      .from('quick_jobs')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    const rows = (data || []) as QuickJobRow[];
    const claimedIds = [...new Set(rows.map(r => r.claimed_by).filter(Boolean))] as string[];

    let profileMap = new Map<string, string>();
    if (claimedIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', claimedIds);
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name || p.email]));
    }

    setJobs(rows.map(r => ({ ...r, claimed_by_name: r.claimed_by ? profileMap.get(r.claimed_by) || '' : '' })));
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const claimJob = async (jobId: string) => {
    await supabase.from('quick_jobs').update({
      claimed_by: user?.id,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    toast('Zakázka převzata');
    loadJobs();
  };

  const doneCount = jobs.filter(j => j.status === 'done').length;
  const activeCount = jobs.filter(j => j.status !== 'done').length;
  const totalHours = jobs.reduce((sum, j) => sum + (j.estimated_hours || 0), 0);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-500/20">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-semibold text-slate-400">Aktivní</span>
              <span className="text-sm font-extrabold text-white">{activeCount}</span>
            </div>
            <div className="relative overflow-hidden flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500/15 to-green-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-slate-400">Hotovo</span>
              <span className="text-sm font-extrabold text-emerald-400">{doneCount}</span>
            </div>
            {totalHours > 0 && (
              <div className="relative overflow-hidden flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-extrabold text-white">{totalHours}h</span>
              </div>
            )}
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-blue-500/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Přidat dílčí práci
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Zatím žádné dílčí práce</p>
            <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-blue-500/20 transition-all">
              <Plus className="w-4 h-4" /> Přidat první
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(j => {
              const st = STATUS_MAP[j.status] || STATUS_MAP.pool;
              const pr = PRIORITY_MAP[j.priority] || PRIORITY_MAP.normal;
              return (
                <div key={j.id} onClick={() => setSelectedJob(j)} className="relative flex items-center gap-4 px-4 py-3 bg-navy-800/60 rounded-xl border border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all cursor-pointer group">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none" />
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${pr.dot} ring-2 ring-current/20`} />
                  <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{j.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </div>
                    {j.description && <p className="text-[11px] text-slate-500 truncate mt-0.5">{j.description}</p>}
                  </div>
                  <div className="relative flex items-center gap-2 shrink-0">
                    {j.scheduled_date && (
                      <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{new Date(j.scheduled_date).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                    {j.claimed_by_name && (
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />{j.claimed_by_name.split(' ')[0]}
                      </span>
                    )}
                    {j.status === 'pool' && (
                      <button onClick={e => { e.stopPropagation(); claimJob(j.id); }} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg shadow-md shadow-blue-500/20 transition-all opacity-0 group-hover:opacity-100">
                        <ArrowRight className="w-3 h-3" /> Vzít si
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuickJobFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={loadJobs}
        prefillProjectId={projectId}
        prefillProjectName={projectName}
        prefillClientId={clientId}
        prefillClientName={clientName}
        prefillAddress={address}
        prefillLat={addressLat}
        prefillLon={addressLon}
      />

      {selectedJob && (
        <QuickJobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdated={() => { setSelectedJob(null); loadJobs(); }}
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
    </>
  );
}
