import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Paperclip, Upload, Clock, Wrench, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import type { JobSubcontractor } from '../../types/subcontractors';

interface Props {
  row: JobSubcontractor | null;
  onClose: () => void;
}

interface WorkRow { id: string; activity: string; started_at: string | null; duration_minutes: number; note: string; approval_status: string; }
interface MatRow { id: string; material_name: string; unit: string; actual_qty: number; note: string; approval_status: string; }
interface FileRow { id: string; file_name: string; file_url: string; by_sub: boolean; created_at: string; }

const APPROVAL_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Čeká na schválení', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Zamítnuto', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

/** Org pohled: výkazy subdodavatele ke schválení + sdílené soubory zakázky. */
export default function SubWorkFilesModal({ row, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [work, setWork] = useState<WorkRow[]>([]);
  const [materials, setMaterials] = useState<MatRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    if (!row) return;
    const [workRes, matRes, filesRes] = await Promise.all([
      supabase.from('job_worklogs')
        .select('id, activity, started_at, duration_minutes, note, approval_status')
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

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `subjob/${row.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file);
      if (upErr) { toast('Soubor se nepodařilo nahrát', 'error'); return; }
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      const { error } = await supabase.from('sub_job_files').insert({
        job_subcontractor_id: row.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        by_sub: false,
        uploaded_by: user!.id,
      });
      if (error) { toast('Soubor se nepodařilo uložit', 'error'); return; }
      toast('Soubor sdílen se subdodavatelem');
      loadData();
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (id: string) => {
    await supabase.from('sub_job_files').delete().eq('id', id);
    loadData();
  };

  const approvalBadge = (status: string) => {
    const m = APPROVAL_META[status] || APPROVAL_META.pending;
    return <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
  };

  return (
    <Modal open onClose={onClose} title={`Výkazy a soubory — ${row.subcontractors?.name || ''}`} size="xl">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" /> Vykázaná práce
          </h3>
          {work.length === 0 ? <p className="text-xs text-slate-500">Žádné výkazy práce.</p> : (
            <div className="space-y-1.5">
              {work.map(w => (
                <div key={w.id} className="flex flex-wrap items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-white">{(w.duration_minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h</span>
                      <span className="text-slate-400 text-xs">{w.started_at ? new Date(w.started_at).toLocaleDateString('cs-CZ') : ''}</span>
                      {approvalBadge(w.approval_status)}
                    </div>
                    {w.note && <p className="text-[11px] text-slate-400 mt-0.5">{w.note}</p>}
                  </div>
                  {w.approval_status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setWorkStatus(w.id, 'approved')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition">
                        <CheckCircle2 className="w-3 h-3" /> Schválit
                      </button>
                      <button onClick={() => setWorkStatus(w.id, 'rejected')} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition">
                        <XCircle className="w-3 h-3" /> Zamítnout
                      </button>
                    </div>
                  )}
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
              <Paperclip className="w-4 h-4 text-amber-400" /> Soubory zakázky
            </h3>
            <label className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-3 h-3" /> {uploading ? 'Nahrávám…' : 'Sdílet soubor se subkou'}
              <input type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = '';
              }} />
            </label>
          </div>
          {files.length === 0 ? <p className="text-xs text-slate-500">Žádné sdílené soubory.</p> : (
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
