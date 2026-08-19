import { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  duration_minutes: number;
  description: string;
  billable: boolean;
  created_at: string;
}

export default function ProjectTimeTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], duration_minutes: 60, description: '', billable: true });

  const load = useCallback(async () => {
    const { data } = await supabase.from('time_entries').select('*').eq('project_id', projectId).order('date', { ascending: false });
    setEntries((data || []) as TimeEntry[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const totalMinutes = entries.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + e.duration_minutes, 0);
  const fmtH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  const handleAdd = async () => {
    const { error } = await supabase.from('time_entries').insert({
      user_id: user!.id, project_id: projectId, date: form.date,
      duration_minutes: form.duration_minutes, description: form.description, billable: form.billable,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Záznam přidán');
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('time_entries').delete().eq('id', id);
    toast('Smazáno');
    load();
  };

  if (loading) return <div className="animate-pulse h-32 bg-white/[0.06] rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/10 rounded-xl px-4 py-2">
            <div className="text-[10px] font-semibold text-blue-400 uppercase">Celkem</div>
            <div className="text-lg font-extrabold text-blue-400">{fmtH(totalMinutes)}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl px-4 py-2">
            <div className="text-[10px] font-semibold text-emerald-400 uppercase">Fakturovatelné</div>
            <div className="text-lg font-extrabold text-emerald-400">{fmtH(billableMinutes)}</div>
          </div>
        </div>
        <button onClick={() => { setForm({ date: new Date().toISOString().split('T')[0], duration_minutes: 60, description: '', billable: true }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
          <Plus className="w-4 h-4" /> Přidat
        </button>
      </div>

      <div className="space-y-1.5">
        {entries.map(e => (
          <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition group">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{e.description || 'Bez popisu'}</div>
              <div className="text-xs text-slate-400">{new Date(e.date).toLocaleDateString('cs-CZ')}</div>
            </div>
            <span className="text-sm font-bold text-slate-300">{fmtH(e.duration_minutes)}</span>
            {e.billable && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">FAKT</span>}
            <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Žádné časové záznamy</p>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nový časový záznam" size="sm" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleAdd} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">Přidat</button>
        </>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Minuty</label><input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.billable} onChange={e => setForm({ ...form, billable: e.target.checked })} className="rounded" /><span className="text-sm text-slate-300">Fakturovatelné</span></label>
        </div>
      </Modal>
    </div>
  );
}
