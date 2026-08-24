import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { Category } from '../../types/database';

interface Props {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function EditorProductForm({ categories, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    code: '',
    brand: '',
    power: '',
    kind: 'normal' as 'normal' | 'design_series',
    tag: '',
    price: 0,
    purchase_price: 0,
    margin_percent: 30,
    image_url: '',
    category_id: categories[0]?.id ?? '',
    exclusive_group: '',
    trade: 'electric',
    lumens: 0,
    is_active: true,
    show_in_catalog: true,
  });

  const set = (key: string, value: string | number | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Vyplňte název', 'error'); return; }
    if (!form.code.trim()) { toast('Vyplňte kód', 'error'); return; }
    if (!form.category_id) { toast('Vyberte kategorii', 'error'); return; }

    setSaving(true);
    const { error } = await supabase.from('products').insert({
      name: form.name,
      description: form.description,
      code: form.code.toUpperCase(),
      brand: form.brand,
      power: form.power,
      kind: form.kind,
      tag: form.tag,
      price: Number(form.price) || 0,
      purchase_price: Number(form.purchase_price) || 0,
      margin_percent: Number(form.margin_percent) || 0,
      image_url: form.image_url,
      category_id: form.category_id,
      exclusive_group: form.exclusive_group,
      trade: form.trade,
      lumens: Number(form.lumens) || 0,
      is_active: form.is_active,
      show_in_catalog: form.show_in_catalog,
    });

    if (error) {
      toast(error.message, 'error');
      setSaving(false);
      return;
    }

    toast('Produkt vytvořen');
    setSaving(false);
    onSaved();
  };

  const labelClass = 'text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1';
  const inputClass = 'w-full px-3 py-2 rounded-xl border border-white/10 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20';
  const selectClass = 'w-full px-3 py-2 rounded-xl border border-white/10 text-xs font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-lg font-extrabold text-white">Nový produkt</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-slate-400 hover:text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Název</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="např. Touch Pure (sklo)" className={inputClass} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Popis</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Popis položky..." className={`${inputClass} resize-none`} />
            </div>

            <div>
              <label className={labelClass}>Kód</label>
              <input value={form.code} onChange={(e) => set('code', e.target.value)} required placeholder="např. TP, ABB" className={`${inputClass} uppercase font-extrabold`} />
            </div>

            <div>
              <label className={labelClass}>Značka</label>
              <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="např. Loxone" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Napájení</label>
              <select value={form.power} onChange={(e) => set('power', e.target.value)} className={selectClass}>
                <option value="">Neuvedeno</option>
                <option value="24V">24V</option>
                <option value="230V">230V</option>
                <option value="Tree/Air">Tree/Air</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Typ</label>
              <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className={selectClass}>
                <option value="normal">Normální položka</option>
                <option value="design_series">Design řada</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Štítek (tag)</label>
              <input value={form.tag} onChange={(e) => set('tag', e.target.value)} placeholder="např. Standard, Premium" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Kategorie</label>
              <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} required className={selectClass}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Cena prodejní (Kč)</label>
              <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0" className={`${inputClass} font-extrabold`} />
            </div>

            <div>
              <label className={labelClass}>Cena nákupní (Kč)</label>
              <input type="number" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="0" className={`${inputClass} font-extrabold`} />
            </div>

            <div>
              <label className={labelClass}>Marže (%)</label>
              <input type="number" value={form.margin_percent} onChange={(e) => set('margin_percent', e.target.value)} placeholder="30" className={`${inputClass} font-extrabold`} />
            </div>

            <div>
              <label className={labelClass}>Obor (vrstva)</label>
              <select value={form.trade} onChange={(e) => set('trade', e.target.value)} className={selectClass}>
                <option value="electric">Elektro</option>
                <option value="water">Voda</option>
                <option value="heating">Topení</option>
                <option value="recuperation">Rekuperace / VZT</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Lumeny (lm)</label>
              <input type="number" value={form.lumens} onChange={(e) => set('lumens', e.target.value)} placeholder="0 = není světlo" className={`${inputClass} font-extrabold`} />
            </div>

            <div>
              <label className={labelClass}>URL obrázku</label>
              <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." className={inputClass} />
            </div>

            {form.kind === 'design_series' && (
              <div className="col-span-2">
                <label className={labelClass}>Exkluzivní skupina</label>
                <input value={form.exclusive_group} onChange={(e) => set('exclusive_group', e.target.value)} placeholder="např. design_line" className={inputClass} />
              </div>
            )}

            <div className="col-span-2 flex items-center gap-6 pt-2">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set('is_active', !form.is_active)}
                  className={`relative w-10 h-6 rounded-full transition ${form.is_active ? 'bg-blue-600' : 'bg-white/[0.08]'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white/[0.06] shadow transition ${form.is_active ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <span className="text-xs font-extrabold text-slate-300">{form.is_active ? 'Aktivní' : 'Neaktivní'}</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set('show_in_catalog', !form.show_in_catalog)}
                  className={`relative w-10 h-6 rounded-full transition ${form.show_in_catalog ? 'bg-emerald-600' : 'bg-white/[0.08]'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white/[0.06] shadow transition ${form.show_in_catalog ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <span className="text-xs font-extrabold text-slate-300">{form.show_in_catalog ? 'V katalogu' : 'Skrytá'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-5 mt-5 border-t border-white/[0.06]">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-extrabold text-sm hover:bg-blue-700 transition shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Ukládám...' : 'Vytvořit produkt'}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-extrabold text-slate-400 hover:bg-white/[0.04] transition">
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
