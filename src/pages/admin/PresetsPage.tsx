import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { DesignPreset, DesignModule } from '../../types/database';

export default function PresetsPage() {
  const [presets, setPresets] = useState<DesignPreset[]>([]);
  const [modules, setModules] = useState<DesignModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', frameSize: 1, modules: ['Zásuvka'] as string[] });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('design_presets').select('*').order('sort_order'),
      supabase.from('design_modules').select('*').order('sort_order'),
    ]);
    setPresets(p ?? []);
    setModules(m ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', frameSize: 1, modules: [modules[0]?.name ?? 'Zásuvka'] });
    setShowForm(true);
  };

  const openEdit = (pr: DesignPreset) => {
    setEditId(pr.id);
    const mods = Array.isArray(pr.modules) ? pr.modules : [];
    setForm({ name: pr.name, frameSize: pr.frame_size, modules: mods.length > 0 ? mods : ['Zásuvka'] });
    setShowForm(true);
  };

  const setFrameSize = (n: number) => {
    const clamped = Math.max(1, Math.min(5, n));
    const mods = [...form.modules];
    while (mods.length < clamped) mods.push(modules[0]?.name ?? 'Zásuvka');
    setForm({ ...form, frameSize: clamped, modules: mods.slice(0, clamped) });
  };

  const setModuleAt = (idx: number, val: string) => {
    const mods = [...form.modules];
    mods[idx] = val;
    setForm({ ...form, modules: mods });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Vyplňte název', 'error'); return; }
    setSaving(true);
    const payload = { name: form.name, frame_size: form.frameSize, modules: form.modules };

    if (editId) {
      const { error } = await supabase.from('design_presets').update(payload).eq('id', editId);
      if (error) toast(error.message, 'error'); else toast('Preset upraven');
    } else {
      const maxOrder = presets.length > 0 ? Math.max(...presets.map((p) => p.sort_order)) + 1 : 1;
      const { error } = await supabase.from('design_presets').insert({ ...payload, sort_order: maxOrder });
      if (error) toast(error.message, 'error'); else toast('Preset přidán');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat preset?')) return;
    const { error } = await supabase.from('design_presets').delete().eq('id', id);
    if (error) toast(error.message, 'error'); else { toast('Smazano'); load(); }
  };

  if (loading) return <div className="p-8 text-slate-500">Načítám...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Design presety</h1>
          <p className="text-sm text-slate-500 mt-1">Přednast. kombinace rámečků a vložek</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Přidat preset
        </button>
      </div>

      {showForm && (
        <div className="bg-navy-800/60 rounded-2xl border border-white/10 p-6 mb-6 ">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-white">{editId ? 'Upravit preset' : 'Nový preset'}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Název</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="např. 2x Zásuvka" />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Velikost rámečku</label>
              <select value={form.frameSize} onChange={(e) => setFrameSize(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}-rámeček</option>)}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block">Vložky</label>
              {Array.from({ length: form.frameSize }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-extrabold">{i + 1}</div>
                  <select value={form.modules[i] || ''} onChange={(e) => setModuleAt(i, e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                    {modules.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-navy-800/60 border border-white/[0.08] text-slate-300 px-5 py-2.5 rounded-xl font-extrabold hover:bg-white/[0.04] transition">
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {presets.map((pr) => {
          const mods = Array.isArray(pr.modules) ? pr.modules : [];
          return (
            <div key={pr.id} className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-4 flex items-center gap-4 hover: transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-extrabold text-sm">
                {pr.frame_size}R
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-white">{pr.name}</div>
                <div className="text-xs text-slate-500">{mods.join(' + ')}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(pr)} className="p-2 rounded-lg hover:bg-blue-500/100/10 transition"><Pencil className="w-4 h-4 text-blue-400" /></button>
                <button onClick={() => handleDelete(pr.id)} className="p-2 rounded-lg hover:bg-red-500/100/10 transition"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
          );
        })}
        {presets.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="font-extrabold">Zatím žádné presety</p>
          </div>
        )}
      </div>
    </div>
  );
}
