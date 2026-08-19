import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import type { Profile } from '../../types/database';

interface Defect {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reported_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  photo_url: string;
  created_at: string;
}

const SEVERITY: Record<string, { label: string; color: string }> = {
  low: { label: 'Nizka', color: 'text-slate-500 bg-white/[0.06]' },
  medium: { label: 'Stredni', color: 'text-amber-400 bg-amber-500/10' },
  high: { label: 'Vysoka', color: 'text-orange-600 bg-orange-500/10' },
  critical: { label: 'Kriticka', color: 'text-red-400 bg-red-500/10' },
};

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Otevrena', color: 'text-red-400 bg-red-500/10' },
  in_progress: { label: 'Reseno', color: 'text-blue-400 bg-blue-500/10' },
  resolved: { label: 'Vyresena', color: 'text-emerald-400 bg-emerald-500/10' },
};

export default function DefectsModule({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', assigned_to: '', photo_url: '' });

  const load = useCallback(async () => {
    const [defRes, profRes] = await Promise.all([
      supabase.from('project_defects').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    setDefects((defRes.data || []) as Defect[]);
    setProfiles((profRes.data || []) as Profile[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const { error } = await supabase.from('project_defects').insert({
      project_id: projectId, title: form.title, description: form.description,
      severity: form.severity, assigned_to: form.assigned_to || null,
      photo_url: form.photo_url, reported_by: user!.id,
    });
    if (error) { toast('Chyba', 'error'); return; }
    toast('Vada nahlášena');
    setShowModal(false);
    setForm({ title: '', description: '', severity: 'medium', assigned_to: '', photo_url: '' });
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    await supabase.from('project_defects').update(updates).eq('id', id);
    load();
  };

  if (loading) return <div className="animate-pulse h-32 bg-white/[0.06] rounded-lg" />;

  const openCount = defects.filter(d => d.status !== 'resolved').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{defects.length} vad celkem</span>
          {openCount > 0 && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{openCount} otevrenych</span>}
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition">
          <Plus className="w-4 h-4" /> Nahlásit vadu
        </button>
      </div>

      <div className="space-y-2">
        {defects.map(d => {
          const sev = SEVERITY[d.severity] || SEVERITY.medium;
          const st = STATUS[d.status] || STATUS.open;
          return (
            <div key={d.id} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] hover:border-white/10 transition">
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${d.status === 'resolved' ? 'text-emerald-400' : 'text-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-bold ${d.status === 'resolved' ? 'text-slate-400 line-through' : 'text-white'}`}>{d.title}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sev.color}`}>{sev.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                </div>
                {d.description && <p className="text-xs text-slate-500 mt-1">{d.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                  <span>Nahlasil: {getProfileName(d.reported_by)}</span>
                  {d.assigned_to && <span>Resitel: {getProfileName(d.assigned_to)}</span>}
                  <span>{new Date(d.created_at).toLocaleDateString('cs-CZ')}</span>
                </div>
              </div>
              {d.status !== 'resolved' && (
                <select value={d.status} onChange={e => handleStatusChange(d.id, e.target.value)} className="text-[10px] border border-white/10 rounded px-2 py-1 bg-white/[0.06] shrink-0">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}
            </div>
          );
        })}
        {defects.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Žádné nahlášené vady</p>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nahlásit vadu" size="md" footer={
        <>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleAdd} disabled={!form.title.trim()} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50">Nahlásit</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název vady *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Zavaznost</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Resitel</label><select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"><option value="">-</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">URL fotky</label><input value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
        </div>
      </Modal>
    </div>
  );
}
