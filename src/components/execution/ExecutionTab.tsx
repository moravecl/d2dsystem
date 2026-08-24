import { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Loader2, Calendar, CheckCircle2, FileText, ArrowRight, DollarSign, Check, Eye, RotateCcw, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import ExecutionDashboard from './ExecutionDashboard';

interface ProjectQuote {
  id: string;
  quote_number: string;
  version: number;
  total_selling: number;
  status: string;
}

interface Job {
  id: string;
  project_id: string;
  quote_id: string | null;
  included_quote_ids: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 },
  presented: { label: 'Předloženo', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Eye },
  returned: { label: 'Vráceno', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: RotateCcw },
  draft: { label: 'Rozpracována', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]', Icon: FileText },
};

function QuoteStatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] || STATUS_BADGE.draft;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${meta.cls}`}>
      <Icon className="w-2.5 h-2.5" /> {meta.label}
    </span>
  );
}

export default function ExecutionTab({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [allQuotes, setAllQuotes] = useState<ProjectQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    const [jobRes, quotesRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('project_quotes').select('id, quote_number, version, total_selling, status').eq('project_id', projectId).order('version', { ascending: false }),
    ]);
    setJob(jobRes.data as Job | null);
    setAllQuotes((quotesRes.data || []) as ProjectQuote[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleQuote = (id: string) => {
    setSelectedQuoteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateJob = async () => {
    if (!user) return;
    setCreating(true);
    const ids = [...selectedQuoteIds];
    const primaryQuoteId = ids[0] || null;

    const { data, error } = await supabase.from('jobs').insert({
      project_id: projectId,
      quote_id: primaryQuoteId,
      included_quote_ids: ids.length > 0 ? ids : [],
      status: 'ready',
      started_at: startDate || null,
      created_by: user.id,
    }).select().maybeSingle();

    if (error) {
      toast('Chyba při vytváření zakázky', 'error');
    } else {
      await logAudit('job', data?.id, 'created', { project_id: projectId, quote_ids: ids });
      toast('Zakázka vytvořena');
      setShowCreateModal(false);
      setSelectedQuoteIds(new Set());
      setStartDate('');
      loadData();
    }
    setCreating(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'in_progress' && !job.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    if (newStatus === 'in_progress' && job.status === 'completed') {
      updates.completed_at = null;
    }

    const { error } = await supabase.from('jobs').update(updates).eq('id', job.id);
    if (error) {
      toast('Chyba při změně stavu', 'error');
    } else {
      await logAudit('job', job.id, 'status_changed', { from: job.status, to: newStatus });
      toast('Stav změněn');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!job) {
    const approvedCount = allQuotes.filter(q => q.status === 'approved').length;
    const totalAmount = [...selectedQuoteIds].reduce((sum, id) => {
      const q = allQuotes.find(x => x.id === id);
      return sum + (q?.total_selling || 0);
    }, 0);

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-900/30 via-navy-900 to-emerald-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Vytvořit zakázku
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              {allQuotes.length > 0
                ? `Máte ${allQuotes.length} ${allQuotes.length === 1 ? 'nabídku' : 'nabídek'} (${approvedCount} schválených). Vyberte nabídky k napojení, nebo vytvořte zakázku bez nabídky.`
                : 'Zatím nemáte žádné nabídky. Můžete vytvořit zakázku bez napojení a nabídky připojit později.'
              }
            </p>

            <button
              onClick={() => {
                const approved = allQuotes.filter(q => q.status === 'approved');
                setSelectedQuoteIds(new Set(approved.map(q => q.id)));
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2.5 bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-900/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              Vytvořit zakázku
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {allQuotes.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dostupné nabídky</h4>
            </div>
            <div className="p-3 space-y-2">
              {allQuotes.map(q => (
                <div key={q.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-300">{q.quote_number}</span>
                    <span className="text-xs text-slate-500">v{q.version}</span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <span className="text-sm font-bold text-slate-300 tabular-nums">
                    {Math.round(q.total_selling).toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Modal
          open={showCreateModal}
          onClose={() => { setShowCreateModal(false); setSelectedQuoteIds(new Set()); setStartDate(''); }}
          title="Vytvořit zakázku"
          size="md"
          footer={
            <>
              <button onClick={() => { setShowCreateModal(false); setSelectedQuoteIds(new Set()); setStartDate(''); }} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
                Zrušit
              </button>
              <button
                onClick={handleCreateJob}
                disabled={creating}
                className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Vytvořit zakázku
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Napojit nabídky (volitelně)
              </label>
              {allQuotes.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-white/[0.08] rounded-xl">
                  <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Žádné nabídky k dispozici</p>
                  <p className="text-[10px] text-slate-500 mt-1">Zakázka bude vytvořena bez napojení na nabídku</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allQuotes.map(q => {
                    const isSelected = selectedQuoteIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleQuote(q.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-teal-500/50 bg-teal-500/10'
                            : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-teal-600 border-teal-600' : 'border-slate-500'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-300">{q.quote_number}</span>
                            <span className="text-xs text-slate-500">v{q.version}</span>
                            <QuoteStatusBadge status={q.status} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-bold text-slate-300 shrink-0 tabular-nums">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          {Math.round(q.total_selling).toLocaleString('cs-CZ')} Kč
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedQuoteIds.size > 0 && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-teal-400 font-semibold">{selectedQuoteIds.size} {selectedQuoteIds.size === 1 ? 'nabídka' : 'nabídek'} vybráno</span>
                    <span className="text-teal-300 font-bold tabular-nums">{Math.round(totalAmount).toLocaleString('cs-CZ')} Kč</span>
                  </div>
                </div>
              )}

              {selectedQuoteIds.size === 0 && allQuotes.length > 0 && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-amber-400">Zakázka bude vytvořena bez napojení na nabídku. Nabídky lze připojit později.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Datum zahájení (volitelně)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <ExecutionDashboard
      job={job}
      allQuotes={allQuotes}
      onStatusChange={handleStatusChange}
      onRefresh={loadData}
    />
  );
}
