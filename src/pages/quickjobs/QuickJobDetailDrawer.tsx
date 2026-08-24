import { useState, useEffect } from 'react';
import { X, MapPin, User, Calendar, Clock, ArrowRight, FolderKanban, Play, CheckCircle2, Undo2, CreditCard as Edit2, Package, DollarSign, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import type { QuickJobRow, QuickJobWorkEntry, QuickJobMaterialEntry } from './quickJobTypes';
import { STATUS_MAP, PRIORITY_MAP, BILLING_STATUS_MAP } from './quickJobTypes';
import QuickJobCompletionModal from './QuickJobCompletionModal';

interface Props {
  job: QuickJobRow;
  onClose: () => void;
  onUpdated: () => void;
  onEdit: (job: QuickJobRow) => void;
}

export default function QuickJobDetailDrawer({ job, onClose, onUpdated, onEdit }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schedDate, setSchedDate] = useState(job.scheduled_date || '');
  const [schedNote, setSchedNote] = useState(job.scheduled_note || '');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workEntries, setWorkEntries] = useState<QuickJobWorkEntry[]>([]);
  const [materialEntries, setMaterialEntries] = useState<QuickJobMaterialEntry[]>([]);

  const st = STATUS_MAP[job.status] || STATUS_MAP.pool;
  const pr = PRIORITY_MAP[job.priority] || PRIORITY_MAP.normal;
  const bs = BILLING_STATUS_MAP[job.billing_status] || BILLING_STATUS_MAP.none;
  const displayClient = job.crm_client_name || job.client_name || '';

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30';

  useEffect(() => {
    if (job.status !== 'done') return;
    (async () => {
      const [workRes, matRes] = await Promise.all([
        supabase.from('quick_job_work_entries').select('*').eq('quick_job_id', job.id).order('work_date'),
        supabase.from('quick_job_material_entries').select('*').eq('quick_job_id', job.id).order('created_at'),
      ]);
      setWorkEntries((workRes.data || []) as QuickJobWorkEntry[]);
      setMaterialEntries((matRes.data || []) as QuickJobMaterialEntry[]);
    })();
  }, [job.id, job.status]);

  const claimJob = async () => {
    setSaving(true);
    await supabase.from('quick_jobs').update({
      claimed_by: user?.id,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    toast('Zakázka převzata');
    setSaving(false);
    onUpdated();
  };

  const unclaimJob = async () => {
    setSaving(true);
    await supabase.from('quick_jobs').update({
      claimed_by: null,
      claimed_at: null,
      scheduled_date: null,
      scheduled_note: '',
      status: 'pool',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    toast('Zakázka vrácena do sběrníku');
    setSaving(false);
    onUpdated();
  };

  const scheduleJob = async () => {
    if (!schedDate) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      scheduled_date: schedDate,
      scheduled_note: schedNote,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    };
    if (!job.claimed_by) {
      updates.claimed_by = user?.id;
      updates.claimed_at = new Date().toISOString();
    }
    await supabase.from('quick_jobs').update(updates).eq('id', job.id);
    toast('Zakázka naplánována');
    setSaving(false);
    setShowSchedule(false);
    onUpdated();
  };

  const startJob = async () => {
    setSaving(true);
    await supabase.from('quick_jobs').update({
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    toast('Zakázka zahájena');
    setSaving(false);
    onUpdated();
  };

  const markAsInvoiced = async () => {
    setSaving(true);
    await supabase.from('quick_jobs').update({
      billing_status: 'invoiced',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    toast('Označeno jako vyfakturováno');
    setSaving(false);
    onUpdated();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-navy-900 border-l border-white/[0.08] shadow-2xl overflow-y-auto animate-slide-in-right">
          <div className="sticky top-0 z-10 bg-navy-900/95 backdrop-blur-sm border-b border-white/[0.08] px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white truncate flex-1">{job.title}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(job)} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 transition">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-1 rounded ${st.color}`}>{st.label}</span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <span className={`w-2 h-2 rounded-full ${pr.dot}`} />
                {pr.label}
              </span>
              {job.status === 'done' && (
                <span className={`text-[11px] font-bold px-2 py-1 rounded ${bs.color}`}>{bs.label}</span>
              )}
              {(job.tags || []).map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">{tag}</span>
              ))}
            </div>

            {job.description && (
              <p className="text-sm text-slate-300 leading-relaxed">{job.description}</p>
            )}

            <div className="space-y-3">
              {displayClient && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Klient</div>
                    {job.client_id ? (
                      <button onClick={() => navigate(`/crm/${job.client_id}`)} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition truncate block">{displayClient}</button>
                    ) : (
                      <div className="text-sm text-slate-300">{displayClient}</div>
                    )}
                  </div>
                </div>
              )}

              {job.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Adresa</div>
                    <div className="text-sm text-slate-300">{job.address}</div>
                    {job.address_lat && job.address_lon && (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-[9px] font-bold text-emerald-400">GPS</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {job.project_id && (
                <div className="flex items-center gap-3">
                  <FolderKanban className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Projekt</div>
                    <button onClick={() => navigate(`/projekty/${job.project_id}`)} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition truncate block">
                      {job.project_name || 'Otevřít projekt'}
                    </button>
                  </div>
                </div>
              )}

              {job.estimated_hours > 0 && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Odhad</div>
                    <div className="text-sm text-slate-300">{job.estimated_hours} hod</div>
                  </div>
                </div>
              )}

              {job.scheduled_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Naplánováno</div>
                    <div className="text-sm text-cyan-300">{new Date(job.scheduled_date).toLocaleDateString('cs-CZ')}</div>
                    {job.scheduled_note && <div className="text-[11px] text-slate-400 mt-0.5">{job.scheduled_note}</div>}
                  </div>
                </div>
              )}

              {job.claimed_by_name && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Přiřazeno</div>
                    <div className="text-sm text-slate-300">{job.claimed_by_name}</div>
                  </div>
                </div>
              )}
            </div>

            {job.completed_at && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Dokončeno</div>
                <div className="text-xs text-emerald-300">{new Date(job.completed_at).toLocaleString('cs-CZ')}</div>
                {job.completion_notes && <div className="text-sm text-slate-300 mt-2">{job.completion_notes}</div>}
              </div>
            )}

            {job.status === 'done' && workEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Výkaz práce
                </div>
                <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
                  {workEntries.map(w => (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">{w.worker_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(w.work_date).toLocaleDateString('cs-CZ')}
                          {w.description && ` - ${w.description}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-white">{w.hours}h</div>
                        {w.hourly_rate > 0 && (
                          <div className="text-[10px] text-blue-400">{(w.hours * w.hourly_rate).toLocaleString('cs-CZ')} Kč</div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02]">
                    <span className="text-[10px] font-bold text-slate-400">Celkem</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white">{job.total_work_hours}h</span>
                      {job.total_work_cost > 0 && (
                        <span className="text-xs font-bold text-blue-400 ml-2">{Number(job.total_work_cost).toLocaleString('cs-CZ')} Kč</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {job.status === 'done' && materialEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Výkaz materiálu
                </div>
                <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
                  {materialEntries.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">{m.material_name}</div>
                        <div className="text-[10px] text-slate-500">{m.quantity} {m.unit} x {Number(m.unit_price).toLocaleString('cs-CZ')} Kč</div>
                      </div>
                      <div className="text-xs font-bold text-amber-400 shrink-0">
                        {(m.quantity * m.unit_price).toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02]">
                    <span className="text-[10px] font-bold text-slate-400">Celkem materiál</span>
                    <span className="text-xs font-bold text-amber-400">{Number(job.total_material_cost).toLocaleString('cs-CZ')} Kč</span>
                  </div>
                </div>
              </div>
            )}

            {job.status === 'done' && (job.total_work_cost > 0 || job.total_material_cost > 0) && (
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Celková částka</div>
                  <div className="text-sm font-extrabold text-emerald-400">
                    {(Number(job.total_work_cost) + Number(job.total_material_cost)).toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Calendar className="w-3 h-3" />
              Vytvořeno: {new Date(job.created_at).toLocaleDateString('cs-CZ')}
            </div>

            {showSchedule && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">Datum realizace *</label>
                  <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cyan-300 mb-1">Poznámka</label>
                  <input value={schedNote} onChange={e => setSchedNote(e.target.value)} placeholder="Čas, podrobnosti..." className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowSchedule(false)} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
                  <button onClick={scheduleJob} disabled={!schedDate || saving} className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-sm shadow-cyan-500/20 transition disabled:opacity-50">Naplánovat</button>
                </div>
              </div>
            )}

            {job.status !== 'done' && job.status !== 'cancelled' && !showSchedule && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
                {job.status === 'pool' && (
                  <button onClick={claimJob} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-sm shadow-blue-500/20 transition disabled:opacity-50">
                    <ArrowRight className="w-3.5 h-3.5" /> Vzít si
                  </button>
                )}
                {(job.status === 'pool' || job.status === 'claimed') && (
                  <button onClick={() => setShowSchedule(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-sm shadow-cyan-500/20 transition">
                    <Calendar className="w-3.5 h-3.5" /> Naplánovat
                  </button>
                )}
                {(job.status === 'claimed' || job.status === 'scheduled') && (
                  <button onClick={startJob} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 rounded-xl shadow-sm shadow-amber-500/20 transition disabled:opacity-50">
                    <Play className="w-3.5 h-3.5" /> Zahájit
                  </button>
                )}
                {(job.status === 'in_progress' || job.status === 'scheduled') && (
                  <button onClick={() => setShowCompletionModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 rounded-xl shadow-sm shadow-emerald-500/20 transition">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dokončit s výkazem
                  </button>
                )}
                {job.status !== 'pool' && (
                  <button onClick={unclaimJob} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.06] rounded-xl transition disabled:opacity-50">
                    <Undo2 className="w-3.5 h-3.5" /> Vrátit do sběrníku
                  </button>
                )}
              </div>
            )}

            {job.status === 'done' && job.billing_status === 'ready' && (
              <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
                <button onClick={() => navigate('/finance')} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-sm shadow-blue-500/20 transition">
                  <FileText className="w-3.5 h-3.5" /> Přejít do financí
                </button>
                <button onClick={markAsInvoiced} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition disabled:opacity-50">
                  <DollarSign className="w-3.5 h-3.5" /> Označit jako vyfakturováno
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompletionModal && (
        <QuickJobCompletionModal
          open={showCompletionModal}
          job={job}
          onClose={() => setShowCompletionModal(false)}
          onCompleted={() => { setShowCompletionModal(false); onUpdated(); }}
        />
      )}
    </>
  );
}
