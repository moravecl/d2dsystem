import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, X, Check, Tags } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

interface ProjectType {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

const COLOR_OPTIONS = [
  { value: 'slate', label: 'Šedá', bg: 'bg-white/[0.04]0', soft: 'bg-white/[0.06] text-slate-300' },
  { value: 'red', label: 'Červená', bg: 'bg-red-500/100', soft: 'bg-red-500/20 text-red-400' },
  { value: 'orange', label: 'Oranžová', bg: 'bg-orange-500/100', soft: 'bg-orange-100 text-orange-700' },
  { value: 'amber', label: 'Žlutá', bg: 'bg-amber-500/100', soft: 'bg-amber-500/20 text-amber-700' },
  { value: 'yellow', label: 'Zlatá', bg: 'bg-yellow-400', soft: 'bg-yellow-100 text-yellow-700' },
  { value: 'lime', label: 'Limetová', bg: 'bg-lime-500', soft: 'bg-lime-100 text-lime-700' },
  { value: 'green', label: 'Zelená', bg: 'bg-emerald-500/100/100', soft: 'bg-green-100 text-green-700' },
  { value: 'emerald', label: 'Smaragdová', bg: 'bg-emerald-500/100', soft: 'bg-emerald-500/20 text-emerald-700' },
  { value: 'teal', label: 'Tyrkysová', bg: 'bg-teal-500', soft: 'bg-teal-100 text-teal-700' },
  { value: 'cyan', label: 'Azurová', bg: 'bg-cyan-500', soft: 'bg-cyan-100 text-cyan-700' },
  { value: 'sky', label: 'Nebeská', bg: 'bg-sky-500', soft: 'bg-sky-100 text-sky-700' },
  { value: 'blue', label: 'Modrá', bg: 'bg-blue-500/100', soft: 'bg-blue-500/20 text-blue-400' },
  { value: 'violet', label: 'Fialová', bg: 'bg-violet-500', soft: 'bg-violet-100 text-violet-700' },
  { value: 'pink', label: 'Růžová', bg: 'bg-pink-500', soft: 'bg-pink-100 text-pink-700' },
  { value: 'rose', label: 'Lososová', bg: 'bg-rose-500', soft: 'bg-rose-100 text-rose-700' },
];

const emptyForm = { name: '', color: 'blue', is_active: true };

export function getProjectTypeColor(color: string) {
  return COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[0];
}

export default function ProjectTypesPage() {
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from('project_types')
      .select('*')
      .order('sort_order');
    setTypes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (pt: ProjectType) => {
    setEditId(pt.id);
    setForm({ name: pt.name, color: pt.color, is_active: pt.is_active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Vyplňte název', 'error');
      return;
    }
    setSaving(true);
    if (editId) {
      const { error } = await supabase
        .from('project_types')
        .update({ name: form.name.trim(), color: form.color, is_active: form.is_active })
        .eq('id', editId);
      if (error) {
        toast('Chyba při ukládání', 'error');
      } else {
        toast('Typ projektu upraven');
        setShowForm(false);
        load();
      }
    } else {
      const maxOrder = types.length > 0 ? Math.max(...types.map(t => t.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from('project_types')
        .insert({ name: form.name.trim(), color: form.color, is_active: form.is_active, sort_order: maxOrder });
      if (error) {
        toast('Chyba při ukládání', 'error');
      } else {
        toast('Typ projektu přidán');
        setShowForm(false);
        load();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Opravdu smazat typ "${name}"? Odebere se ze všech přiřazených projektů.`)) return;
    const { error } = await supabase.from('project_types').delete().eq('id', id);
    if (error) {
      toast('Chyba při mazání', 'error');
    } else {
      toast('Typ smazán');
      load();
    }
  };

  const handleToggleActive = async (pt: ProjectType) => {
    const { error } = await supabase
      .from('project_types')
      .update({ is_active: !pt.is_active })
      .eq('id', pt.id);
    if (!error) {
      setTypes(prev => prev.map(t => t.id === pt.id ? { ...t, is_active: !t.is_active } : t));
    }
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newTypes = [...types];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTypes.length) return;
    [newTypes[index], newTypes[targetIndex]] = [newTypes[targetIndex], newTypes[index]];
    const updates = newTypes.map((t, i) => supabase.from('project_types').update({ sort_order: i }).eq('id', t.id));
    await Promise.all(updates);
    setTypes(newTypes.map((t, i) => ({ ...t, sort_order: i })));
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Typy projektů</h1>
          <p className="text-sm text-slate-500 mt-1">
            Konfigurovatelný číselník typů projektů (FVE, Tepelné čerpadlo, Elektroinstalace, ...).
            Na projektu lze vybrat více typů najednou.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Přidat typ
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-navy-800/60 border border-white/[0.08] rounded-2xl p-5 ">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">{editId ? 'Upravit typ' : 'Nový typ projektu'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Např. FVE, Tepelné čerpadlo..."
                className="w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Barva</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    title={c.label}
                    className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                      form.color === c.value
                        ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getProjectTypeColor(form.color).soft}`}>
                  <Tags className="w-3 h-3" />
                  {form.name || 'Náhled'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${form.is_active ? 'bg-emerald-500/100' : 'bg-white/[0.08]'}`}
                style={{ height: '22px' }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white/[0.06] rounded-full transition-transform ${form.is_active ? 'translate-x-4.5' : ''}`}
                  style={{ width: '18px', height: '18px', transform: form.is_active ? 'translateX(18px)' : 'translateX(0)' }}
                />
              </button>
              <span className="text-sm text-slate-400">{form.is_active ? 'Aktivní' : 'Neaktivní'}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />
          ))}
        </div>
      ) : types.length === 0 ? (
        <div className="bg-navy-800/60 rounded-2xl border border-dashed border-slate-300 p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <Tags className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400">Žádné typy projektů</p>
          <p className="text-xs text-slate-300 mt-1">Přidejte první typ tlačítkem výše</p>
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-2xl border border-white/10 overflow-hidden ">
          {types.map((pt, index) => {
            const colorInfo = getProjectTypeColor(pt.color);
            return (
              <div
                key={pt.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 hover:bg-white/[0.04]/60 transition group"
              >
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-white/[0.08] disabled:opacity-20 transition"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                  </button>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorInfo.soft}`}>
                  <Tags className="w-3 h-3" />
                  {pt.name}
                </span>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => handleToggleActive(pt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pt.is_active
                        ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                        : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.08]'
                    }`}
                  >
                    {pt.is_active ? 'Aktivní' : 'Neaktivní'}
                  </button>
                  <button
                    onClick={() => openEdit(pt)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-300 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(pt.id, pt.name)}
                    className="p-1.5 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
