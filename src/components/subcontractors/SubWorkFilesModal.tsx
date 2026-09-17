import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Paperclip, Clock, Wrench, Package, Pencil, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import SubJobChat from './SubJobChat';
import type { JobSubcontractor } from '../../types/subcontractors';

interface Props {
  row: JobSubcontractor | null;
  onClose: () => void;
}

interface WorkRow { id: string; activity: string; started_at: string | null; ended_at: string | null; duration_minutes: number; note: string; approval_status: string; }
interface MatRow { id: string; material_name: string; unit: string; actual_qty: number; note: string; approval_status: string; }
interface FileRow { id: string; file_name: string; file_url: string; by_sub: boolean; created_at: string; }

const APPROVAL_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Čeká na schválení', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Zamítnuto', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Org pohled: výkazy subdodavatele ke schválení + sdílené soubory zakázky. */
export default function SubWorkFilesModal({ row, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [work, setWork] = useState<WorkRow[]>([]);
  const [materials, setMaterials] = useState<MatRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [editWork, setEditWork] = useState<{ id: string; date: string; from: string; to: string; note: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [diaryBusy, setDiaryBusy] = useState<string | null>(null);
  const [diaryWritten, setDiaryWritten] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!row) return;
    const [workRes, matRes, filesRes] = await Promise.all([
      supabase.from('job_worklogs')
        .select('id, activity, started_at, ended_at, duration_minutes, note, approval_status')
        .eq('job_id', row.job_id).eq('submitted_by_sub', row.subcontractor_id)
        .order('started_at', { ascending: false }),
      supabase.from('job_material_entries')
        .select('id, material_name, unit, actual_qty, note, approval_status')
        .eq('job_id', row.job_id).eq('submitted_by_sub', row.subcontractor_id)
        .order('created_at', { ascending: false }),
      supabase.from('sub_job_files')
        .select('id, file_name, file_url, by_sub, created_at')
        .eq('job_subcontractor_id', row.id)
        .order('created_at', { ascending: false }),
    ]);
    setWork((workRes.data || []) as WorkRow[]);
    setMaterials((matRes.data || []) as MatRow[]);
    setFiles((filesRes.data || []) as FileRow[]);
  }, [row]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!row) return null;

  const setWorkStatus = async (id: string, approval_status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('job_worklogs').update({ approval_status }).eq('id', id);
    if (error) { toast('Chyba při změně stavu', 'error'); return; }
    loadData();
  };
  const setMatStatus = async (id: string, approval_status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('job_material_entries').update({ approval_status }).eq('id', id);
    if (error) { toast('Chyba při změně stavu', 'error'); return; }
    loadData();
  };

  const removeFile = async (id: string) => {
    await supabase.from('sub_job_files').delete().eq('id', id);
    loadData();
  };

  const startEditWork = (w: WorkRow) => {
    const start = w.started_at ? new Date(w.started_at) : new Date();
    const end = w.ended_at
      ? new Date(w.ended_at)
      : new Date(start.getTime() + (w.duration_minutes || 0) * 60000);
    setEditWork({
      id: w.id,
      date: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      from: toTimeStr(start),
      to: toTimeStr(end),
      note: w.note || '',
    });
  };

  const saveEditWork = async () => {
    if (!editWork) return;
    if (!editWork.date || !editWork.from || !editWork.to || editWork.to <= editWork.from) {
      toast('Čas „do" musí být později než čas „od"', 'error');
      return;
    }
    setSavingEdit(true);
    const startedAt = new Date(`${editWork.date}T${editWork.from}:00`);
    const endedAt = new Date(`${editWork.date}T${editWork.to}:00`);
    const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    const { error } = await supabase.from('job_worklogs').update({
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: minutes,
      note: editWork.note,
    }).eq('id', editWork.id);
    setSavingEdit(false);
    if (error) { toast(`Výkaz se nepodařilo uložit: ${error.message}`, 'error'); return; }
    toast('Výkaz upraven');
    setEditWork(null);
    loadData();
  };

  const writeToDiary = async (w: WorkRow) => {
    if (!row || !user) return;
    setDiaryBusy(w.id);
    const subName = row.subcontractors?.name || 'Subdodavatel';
    const start = w.started_at ? new Date(w.started_at) : null;
    const end = w.ended_at ? new Date(w.ended_at) : null;
    const entryDate = start
      ? `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`
      : new Date().toISOString().slice(0, 10);
    const hours = (w.duration_minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
    const { error } = await supabase.from('job_diary_entries').insert({
      job_id: row.job_id,
      entry_date: entryDate,
      time_from: start ? toTimeStr(start) : null,
      time_to: end ? toTimeStr(end) : null,
      content: `Subdodávka — ${subName} (${hours} h)${w.note ? `: ${w.note}` : ''}`,
      people_on_site: [`temp:${subName}`],
      created_by: user.id,
    });
    setDiaryBusy(null);
    if (error) { toast(`Zápis do deníku se nepodařil: ${error.message}`, 'error'); return; }
    await logAudit('job_diary', row.job_id, 'diary_entry_added', { date: entryDate, source: 'sub_worklog' });
    setDiaryWritten(prev => new Set(prev).add(w.id));
    toast('Zapsáno do stavebního deníku');
  };

  const approvalBadge = (status: string) => {
    const m = APPROVAL_META[status] || APPROVAL_META.pending;
    return <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
  };

  return (
    <Modal open onClose={onClose} title={`Zakázka — ${row.subcontractors?.name || ''}`} size="xl">
      <div className="space-y-6">
        <SubJobChat jobSubId={row.id} viewer="org" counterpartyName={row.subcontractors?.name || 'Subdodavatel'} />

        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" /> Vykázaná práce
          </h3>
          {work.length === 0 ? <p className="text-xs text-slate-500">Žádné výkazy práce.</p> : (
            <div className="space-y-1.5">
              {work.map(w => editWork?.id === w.id ? (
                <div key={w.id} className="bg-white/[0.04] border border-blue-400/30 rounded-lg px-3 py-2.5 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-[130px_95px_95px_1fr] gap-2">
                    <input type="date" value={editWork.date} onChange={e => setEditWork(f => f && ({ ...f, date: e.target.value }))} className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-blue-400" />
                    <input type="time" value={editWork.from} onChange={e => setEditWork(f => f && ({ ...f, from: e.target.value }))} title="Od" className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-blue-400" />
                    <input type="time" value={editWork.to} onChange={e => setEditWork(f => f && ({ ...f, to: e.target.value }))} title="Do" className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-blue-400" />
                    <input value={editWork.note} onChange={e => setEditWork(f => f && ({ ...f, note: e.target.value }))} placeholder="Poznámka" className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-blue-400 col-span-2 sm:col-span-1" />
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button onClick={() => setEditWork(null)} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition">Zrušit</button>
                    <button onClick={saveEditWork} disabled={savingEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                      {savingEdit && <Loader2 className="w-3 h-3 animate-spin" />} Uložit
                    </button>
                  </div>
                </div>
              ) : (
                <div key={w.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-white">{(w.duration_minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h</span>
                      <span className="text-slate-400 text-xs">
                        {w.started_at ? new Date(w.started_at).toLocaleDateString('cs-CZ') : ''}
                        {w.started_at && w.ended_at ? ` ${new Date(w.started_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}–${new Date(w.ended_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                      {approvalBadge(w.approval_status)}
                    </div>
                    {w.note && <p className="text-[11px] text-slate-400 mt-0.5">{w.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {w.approval_status === 'pending' && (
                      <>
                        <button onClick={() => setWorkStatus(w.id, 'approved')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition">
                          <CheckCircle2 className="w-3 h-3" /> Schválit
                        </button>
                        <button onClick={() => setWorkStatus(w.id, 'rejected')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
                          <XCircle className="w-3 h-3" /> Zamítnout
                        </button>
                      </>
                    )}
                    <button onClick={() => startEditWork(w)} title="Upravit výkaz" className="p-1.5 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-blue-500/10 transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => writeToDiary(w)}
                      disabled={diaryBusy === w.id || diaryWritten.has(w.id)}
                      title={diaryWritten.has(w.id) ? 'Zapsáno do deníku' : 'Zapsat do stavebního deníku'}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition disabled:opacity-60 ${diaryWritten.has(w.id) ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'}`}
                    >
                      {diaryBusy === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />}
                      {diaryWritten.has(w.id) ? 'V deníku' : 'Do deníku'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" /> Vykázaný materiál
          </h3>
          {materials.length === 0 ? <p className="text-xs text-slate-500">Žádné výkazy materiálu.</p> : (
            <div className="space-y-1.5">
              {materials.map(m => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-white truncate">{m.material_name}</span>
                      <span className="text-slate-400 text-xs">{m.actual_qty} {m.unit}</span>
                      {approvalBadge(m.approval_status)}
                    </div>
                    {m.note && <p className="text-[11px] text-slate-400 mt-0.5">{m.note}</p>}
                  </div>
                  {m.approval_status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setMatStatus(m.id, 'approved')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition">
                        <CheckCircle2 className="w-3 h-3" /> Schválit
                      </button>
                      <button onClick={() => setMatStatus(m.id, 'rejected')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
                        <XCircle className="w-3 h-3" /> Zamítnout
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-2">Do podkladů fakturace se dostanou jen schválené výkazy.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-amber-400" /> Soubory od subdodavatele
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">Podklady subdodavateli sdílíte přes Soubory projektu — na složce zaškrtněte „Zobrazit v partnerské sekci". Zde vidíte soubory, které nahrál subdodavatel (fotky, revize…).</p>
          {files.length === 0 ? <p className="text-xs text-slate-500">Subdodavatel zatím nic nenahrál.</p> : (
            <div className="space-y-1.5">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <Paperclip className={`w-3.5 h-3.5 shrink-0 ${f.by_sub ? 'text-amber-400' : 'text-blue-400'}`} />
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-200 hover:text-blue-300 truncate flex-1">{f.file_name}</a>
                  <span className="text-[10px] text-slate-500 shrink-0">{f.by_sub ? 'od subdodavatele' : 'od nás'} · {new Date(f.created_at).toLocaleDateString('cs-CZ')}</span>
                  <button onClick={() => removeFile(f.id)} className="p-1 rounded text-slate-500 hover:text-red-400 transition shrink-0">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
