import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Zap, Droplets, Flame, Wind, Package, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Material } from '../../types/database';

type Trade = Material['trade'];
type MaterialType = Material['material_type'];
type CalcRule = NonNullable<Material['fitting_calc_rule']>;

const TRADES: { value: Trade; label: string; icon: typeof Zap; color: string }[] = [
  { value: 'electric', label: 'Elektro', icon: Zap, color: '#eab308' },
  { value: 'water', label: 'Voda', icon: Droplets, color: '#3b82f6' },
  { value: 'heating', label: 'Topení', icon: Flame, color: '#ef4444' },
  { value: 'recuperation', label: 'Rekuperace', icon: Wind, color: '#22c55e' },
];

const MATERIAL_TYPES: { value: MaterialType; label: string; icon: typeof Package }[] = [
  { value: 'linear', label: 'Kabely / trubky', icon: Package },
  { value: 'fitting', label: 'Tvarovky', icon: Wrench },
  { value: 'other', label: 'Ostatní', icon: Package },
];

const CALC_RULES: { value: CalcRule; label: string }[] = [
  { value: 'per_bend', label: 'Za každý ohyb trasy' },
  { value: 'per_tee', label: 'Za každý T-kus / odbočku' },
  { value: 'per_endpoint', label: 'Za každý koncový bod' },
  { value: 'per_10m', label: 'Za každých 10 m trasy' },
];

const emptyForm = {
  name: '',
  trade: 'electric' as Trade,
  unit: 'm',
  price: '',
  purchasePrice: '',
  material_type: 'linear' as MaterialType,
  fitting_calc_rule: '' as string,
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrade, setActiveTrade] = useState<Trade>('electric');
  const [activeType, setActiveType] = useState<MaterialType>('linear');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('materials').select('*').order('trade').order('sort_order');
    setMaterials(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = materials.filter((m) => m.trade === activeTrade && m.material_type === activeType);

  const openNew = () => {
    setEditId(null);
    setForm({
      ...emptyForm,
      trade: activeTrade,
      material_type: activeType,
      unit: activeType === 'fitting' ? 'ks' : 'm',
    });
    setShowForm(true);
  };

  const openEdit = (mat: Material) => {
    setEditId(mat.id);
    setForm({
      name: mat.name,
      trade: mat.trade,
      unit: mat.unit,
      price: mat.price_per_unit > 0 ? String(mat.price_per_unit) : '',
      purchasePrice: mat.purchase_price > 0 ? String(mat.purchase_price) : '',
      material_type: mat.material_type,
      fitting_calc_rule: mat.fitting_calc_rule ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Vyplňte název materiálu', 'error'); return; }
    setSaving(true);
    const price = parseFloat(form.price.replace(',', '.')) || 0;
    const purchasePrice = parseFloat(form.purchasePrice.replace(',', '.')) || 0;

    const payload = {
      name: form.name,
      trade: form.trade,
      unit: form.unit,
      price_per_unit: price,
      purchase_price: purchasePrice,
      material_type: form.material_type,
      fitting_calc_rule: form.material_type === 'fitting' && form.fitting_calc_rule
        ? form.fitting_calc_rule
        : null,
    };

    if (editId) {
      const { error } = await supabase.from('materials').update(payload).eq('id', editId);
      if (error) toast(error.message, 'error');
      else toast('Materiál upraven');
    } else {
      const tradeItems = materials.filter((m) => m.trade === form.trade && m.material_type === form.material_type);
      const maxOrder = tradeItems.length > 0 ? Math.max(...tradeItems.map((m) => m.sort_order)) + 1 : 1;
      const { error } = await supabase.from('materials').insert({ ...payload, sort_order: maxOrder });
      if (error) toast(error.message, 'error');
      else toast('Materiál přidán');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat materiál?')) return;
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) toast(error.message, 'error');
    else { toast('Smazano'); load(); }
  };

  const toggleActive = async (mat: Material) => {
    const { error } = await supabase.from('materials').update({ is_active: !mat.is_active }).eq('id', mat.id);
    if (error) toast(error.message, 'error');
    else load();
  };

  const updatePrice = async (mat: Material, newPrice: string) => {
    const price = parseFloat(newPrice.replace(',', '.')) || 0;
    await supabase.from('materials').update({ price_per_unit: price }).eq('id', mat.id);
  };

  if (loading) return <div className="p-8 text-slate-400">Načítám...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Materiály a ceny</h1>
          <p className="text-sm text-slate-400 mt-1">Kabely, trubky, tvarovky -- typy a ceny</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition shadow-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Přidat materiál
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TRADES.map((t) => {
          const Icon = t.icon;
          const count = materials.filter((m) => m.trade === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setActiveTrade(t.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition ${
                activeTrade === t.value
                  ? 'bg-white/[0.06]/[0.15] text-white shadow-md'
                  : 'bg-navy-800/60 border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]/[0.04]'
              }`}
            >
              <Icon className="w-4 h-4" style={activeTrade !== t.value ? { color: t.color } : undefined} />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                activeTrade === t.value ? 'bg-white/[0.06]/20' : 'bg-white/[0.06]/[0.07]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-6">
        {MATERIAL_TYPES.map((mt) => {
          const count = materials.filter((m) => m.trade === activeTrade && m.material_type === mt.value).length;
          const Icon = mt.icon;
          return (
            <button
              key={mt.value}
              onClick={() => setActiveType(mt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                activeType === mt.value
                  ? 'bg-blue-600 text-white '
                  : 'bg-navy-900/50 border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]/[0.07]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {mt.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                activeType === mt.value ? 'bg-white/[0.06]/20' : 'bg-white/[0.06]/[0.07]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 mb-6 ">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-white">{editId ? 'Upravit materiál' : 'Nový materiál'}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-300"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Název</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
                placeholder={form.material_type === 'fitting' ? 'např. PPR koleno 90 20mm' : 'např. CYKY-J 3x1,5'} />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Obor</label>
              <select value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value as Trade })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
                {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Typ</label>
              <select value={form.material_type} onChange={(e) => setForm({
                ...form,
                material_type: e.target.value as MaterialType,
                unit: e.target.value === 'fitting' ? 'ks' : 'm',
                fitting_calc_rule: e.target.value !== 'fitting' ? '' : form.fitting_calc_rule,
              })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
                {MATERIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Jednotka</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
                placeholder="m / ks" />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Prodejní cena / j.</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
                placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Nákupní cena / j.</label>
              <input value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50"
                placeholder="0" />
            </div>
            {form.material_type === 'fitting' && (
              <div>
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Auto-výpočet</label>
                <select value={form.fitting_calc_rule} onChange={(e) => setForm({ ...form, fitting_calc_rule: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500/50">
                  <option value="">Žádný (ručně)</option>
                  {CALC_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-extrabold hover:bg-blue-500/100/100 transition disabled:opacity-60 flex items-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-white/[0.08] text-slate-400 px-5 py-2.5 rounded-xl font-extrabold hover:bg-white/[0.06]/[0.07] transition">
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/50 border-b border-white/[0.06]">
            <tr>
              <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Materiál</th>
              <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Jednotka</th>
              {activeType === 'fitting' && (
                <th className="text-left p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Autopočet</th>
              )}
              <th className="text-right p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Prodej / j.</th>
              <th className="text-right p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Nakup / j.</th>
              <th className="text-center p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Stav</th>
              <th className="text-right p-4 font-extrabold text-slate-500 text-xs uppercase tracking-widest">Akce</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((mat) => {
              const rule = CALC_RULES.find((r) => r.value === mat.fitting_calc_rule);
              return (
                <tr key={mat.id} className="border-b border-white/[0.06] hover:bg-white/[0.06]/[0.04] transition">
                  <td className="p-4 font-extrabold text-white">{mat.name}</td>
                  <td className="p-4 text-slate-300">{mat.unit}</td>
                  {activeType === 'fitting' && (
                    <td className="p-4">
                      {rule ? (
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-md bg-blue-500/100/15 text-blue-300 border border-blue-500/25">
                          {rule.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">ručně</span>
                      )}
                    </td>
                  )}
                  <td className="p-4 text-right">
                    <input
                      type="text"
                      defaultValue={mat.price_per_unit > 0 ? String(mat.price_per_unit) : ''}
                      onBlur={(e) => updatePrice(mat, e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.06]/[0.06] text-white text-right font-extrabold text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500 ml-1">Kč</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-semibold text-slate-400">
                      {mat.purchase_price > 0 ? `${mat.purchase_price} Kč` : '-'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => toggleActive(mat)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition ${
                      mat.is_active ? 'bg-emerald-500/100/15 text-emerald-300 border border-emerald-500/25' : 'bg-white/[0.06]/[0.07] text-slate-400 border border-white/[0.06]'
                    }`}>
                      {mat.is_active ? 'Aktivní' : 'Skryto'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(mat)} className="p-2 rounded-lg hover:bg-blue-500/100/100/10 transition">
                        <Pencil className="w-4 h-4 text-blue-400" />
                      </button>
                      <button onClick={() => handleDelete(mat.id)} className="p-2 rounded-lg hover:bg-red-500/100/100/10 transition">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={activeType === 'fitting' ? 7 : 6} className="p-8 text-center text-slate-500 font-extrabold">
                  {activeType === 'fitting'
                    ? 'Žádné tvarovky v tomto oboru'
                    : 'Žádné materiály v tomto oboru'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
