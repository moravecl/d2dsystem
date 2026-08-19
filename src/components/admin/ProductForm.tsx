import { useState } from 'react';
import { ArrowLeft, Check, Image as ImageIcon, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import type { Product, Category, Subcategory, FloorplanSymbol } from '../../types/database';
import ProductColorsManager from './ProductColorsManager';
import ProductImagesManager from './ProductImagesManager';
import ProductDesignModulesManager from './ProductDesignModulesManager';
import IconPicker from '../catalog/floorplan/IconPicker';
import { getFloorplanIcon, renderPinIcon } from '../catalog/floorplan/iconLibrary';

interface Props {
  product: Product | null;
  categories: Category[];
  subcategories: Subcategory[];
  onSave: () => void;
  onCancel: () => void;
}

export default function ProductForm({ product, categories, subcategories, onSave, onCancel }: Props) {
  const isEdit = !!product;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'symbol' | 'colors' | 'images' | 'modules'>('info');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const existingSymbol = product?.floorplan_symbol as FloorplanSymbol | null | undefined;
  const [symbol, setSymbol] = useState<FloorplanSymbol>({
    type: existingSymbol?.type ?? 'pin',
    width_mm: existingSymbol?.width_mm ?? 80,
    height_mm: existingSymbol?.height_mm ?? 80,
    orientation: existingSymbol?.orientation ?? 'free',
    anchor: existingSymbol?.anchor ?? 'center',
    snap_to_wall: existingSymbol?.snap_to_wall ?? false,
    wall_offset_mm: existingSymbol?.wall_offset_mm ?? 0,
    svg_content: existingSymbol?.svg_content ?? '',
  });
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    code: product?.code ?? '',
    brand: product?.brand ?? '',
    power: product?.power ?? '',
    kind: product?.kind ?? 'normal' as 'normal' | 'design_series',
    tag: product?.tag ?? '',
    price: product?.price ?? 0,
    purchase_price: product?.purchase_price ?? 0,
    margin_percent: product?.margin_percent ?? 30,
    image_url: product?.image_url ?? '',
    category_id: product?.category_id ?? (categories[0]?.id ?? ''),
    subcategory_id: product?.subcategory_id ?? '',
    exclusive_group: product?.exclusive_group ?? '',
    is_active: product?.is_active ?? true,
    show_in_catalog: product?.show_in_catalog ?? true,
    sort_order: product?.sort_order ?? 0,
    default_icon: product?.default_icon ?? '',
    trade: product?.trade ?? 'electric',
    lumens: product?.lumens ?? 0,
    frame_prices: (product?.frame_prices as Record<string, number> | null) ?? null,
  });

  const set = (key: string, value: string | number | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Vyplňte název', 'error'); return; }
    if (!form.code.trim()) { toast('Vyplňte kód', 'error'); return; }
    if (!form.category_id) { toast('Vyberte kategorii', 'error'); return; }

    setSaving(true);
    const payload = {
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
      subcategory_id: form.subcategory_id || null,
      exclusive_group: form.exclusive_group,
      is_active: form.is_active,
      show_in_catalog: form.show_in_catalog,
      sort_order: Number(form.sort_order) || 0,
      default_icon: form.default_icon,
      trade: form.trade,
      lumens: Number(form.lumens) || 0,
      floorplan_symbol: symbol.type === 'pin' ? null : symbol,
      frame_prices: form.kind === 'design_series' ? (form.frame_prices || null) : null,
    };

    if (isEdit) {
      const { error } = await supabase.from('products').update(payload).eq('id', product.id);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast('Položka upravena');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast('Položka přidána');
    }
    setSaving(false);
    onSave();
  };

  const tabs = [
    { id: 'info' as const, label: 'Základní údaje' },
    { id: 'symbol' as const, label: 'Symbol půdorysu' },
    ...(isEdit ? [
      { id: 'colors' as const, label: 'Barvy' },
      { id: 'images' as const, label: 'Galerie' },
      ...(form.kind === 'design_series' ? [{ id: 'modules' as const, label: 'Vložky' }] : []),
    ] : []),
  ];

  return (
    <div className="p-8">
      <button onClick={onCancel} className="flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-slate-300 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Zpět na seznam
      </button>

      <h1 className="text-2xl font-extrabold text-white mb-2">{isEdit ? 'Upravit položku' : 'Nová položka'}</h1>

      {!isEdit && (
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Po vytvoření produktu budete moci přidat barvy a galerii obrázků v záložkách "Barvy" a "Galerie".
          </p>
        </div>
      )}

      {tabs.length > 1 && (
        <div className="flex gap-1 mb-6 bg-white/[0.06] rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-extrabold transition ${
                activeTab === tab.id
                  ? 'bg-white/[0.06] text-white '
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
      {activeTab === 'info' && (
        <div className="max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6 space-y-4">
                <h3 className="font-extrabold text-white text-sm">Základní informace</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Název</label>
                    <input value={form.name} onChange={(e) => set('name', e.target.value)} required
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="např. Touch Pure (sklo)" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Popis</label>
                    <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none" placeholder="Popis položky..." />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Kód (prefix pinu)</label>
                    <input value={form.code} onChange={(e) => set('code', e.target.value)} required
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20 uppercase" placeholder="např. TP, ABB" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Značka</label>
                    <input value={form.brand} onChange={(e) => set('brand', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="např. Loxone" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Napájení</label>
                    <select value={form.power} onChange={(e) => set('power', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                      <option value="">Neuvedeno</option>
                      <option value="24V">24V</option>
                      <option value="230V">230V</option>
                      <option value="Tree/Air">Tree/Air</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Typ</label>
                    <select value={form.kind} onChange={(e) => set('kind', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                      <option value="normal">Normální položka</option>
                      <option value="design_series">Design řada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Štítek (tag)</label>
                    <input value={form.tag} onChange={(e) => set('tag', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="např. Standard, Premium" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Cena prodejní (Kč)</label>
                    <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Cena nákupní (Kč)</label>
                    <input type="number" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Marže (%)</label>
                    <input type="number" value={form.margin_percent} onChange={(e) => set('margin_percent', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="30" />
                  </div>
                  {form.kind === 'design_series' && (
                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Exkluzivní skupina</label>
                      <input value={form.exclusive_group} onChange={(e) => set('exclusive_group', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20" placeholder="např. design_line" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Kategorie</label>
                    <select value={form.category_id} onChange={(e) => { set('category_id', e.target.value); set('subcategory_id', ''); }} required
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Podkategorie</label>
                    <select value={form.subcategory_id} onChange={(e) => set('subcategory_id', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                      <option value="">-- Bez podkategorie --</option>
                      {subcategories.filter(s => s.category_id === form.category_id).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Obor (vrstva)</label>
                    <select value={form.trade} onChange={(e) => set('trade', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20">
                      <option value="electric">Elektro (vč. audio, slaboproud)</option>
                      <option value="water">Voda</option>
                      <option value="heating">Topení</option>
                      <option value="recuperation">Rekuperace / VZT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Lumeny (lm)</label>
                    <input type="number" value={form.lumens} onChange={(e) => set('lumens', e.target.value)} placeholder="0 = není světlo"
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Pořadí</label>
                    <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20" />
                  </div>
                </div>
                <div className="pt-2">
                  <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-2">Výchozí ikona na půdorysu</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.04] transition"
                    >
                      {form.default_icon ? (
                        <>
                          <span className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                            {renderPinIcon(form.default_icon, 15)}
                          </span>
                          <span className="text-xs font-extrabold text-slate-300">
                            {getFloorplanIcon(form.default_icon)?.name ?? form.default_icon}
                          </span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-400">Vybrat ikonu...</span>
                        </>
                      )}
                    </button>
                    {form.default_icon && (
                      <button
                        type="button"
                        onClick={() => set('default_icon', '')}
                        className="text-xs text-red-500 font-extrabold hover:text-red-400 transition"
                      >
                        Odebrat
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => set('is_active', !form.is_active)}
                      className={`relative w-12 h-7 rounded-full transition ${form.is_active ? 'bg-blue-600' : 'bg-white/[0.08]'}`}>
                      <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white/[0.06] shadow transition ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm font-extrabold text-slate-300">{form.is_active ? 'Aktivní' : 'Neaktivní'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => set('show_in_catalog', !form.show_in_catalog)}
                      className={`relative w-12 h-7 rounded-full transition ${form.show_in_catalog ? 'bg-emerald-600' : 'bg-white/[0.08]'}`}>
                      <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white/[0.06] shadow transition ${form.show_in_catalog ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm font-extrabold text-slate-300">{form.show_in_catalog ? 'Zobrazit v katalogu' : 'Skrytá (pouze nabídka)'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
                <h3 className="font-extrabold text-white text-sm mb-4">Hlavní obrázek</h3>
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">URL obrázku</label>
                  <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-xs" placeholder="https://..." />
                </div>
                {form.image_url ? (
                  <img src={form.image_url} alt="náhled" className="mt-4 w-full h-40 object-cover rounded-xl border border-white/[0.06]" />
                ) : (
                  <div className="mt-4 w-full h-40 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {activeTab === 'symbol' && (
        <div className="max-w-3xl">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6 space-y-6">
            <h3 className="font-extrabold text-white text-sm">Konfigurace symbolu na půdorysu</h3>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Typ symbolu</label>
              <select
                value={symbol.type}
                onChange={(e) => setSymbol({ ...symbol, type: e.target.value as 'pin' | 'rect' | 'svg' })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              >
                <option value="pin">Pin (výchozí ikona)</option>
                <option value="rect">Obdélník</option>
                <option value="svg">SVG</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Pin používá výchozí ikonu produktu. Obdélník a SVG mají vlastní rozměry.
              </p>
            </div>

            {symbol.type !== 'pin' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Šířka (mm)</label>
                    <input
                      type="number"
                      value={symbol.width_mm}
                      onChange={(e) => setSymbol({ ...symbol, width_mm: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                      placeholder="80"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Výška (mm)</label>
                    <input
                      type="number"
                      value={symbol.height_mm}
                      onChange={(e) => setSymbol({ ...symbol, height_mm: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                      placeholder="80"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Orientace</label>
                  <select
                    value={symbol.orientation}
                    onChange={(e) => setSymbol({ ...symbol, orientation: e.target.value as 'free' | 'wall' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  >
                    <option value="free">Volná (lze otáčet)</option>
                    <option value="wall">Ke zdi (vždy rovnoběžně)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Kotevní bod</label>
                  <select
                    value={symbol.anchor}
                    onChange={(e) => setSymbol({ ...symbol, anchor: e.target.value as 'center' | 'bottom-center' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  >
                    <option value="center">Střed</option>
                    <option value="bottom-center">Spodní střed</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Určuje, kterým bodem se symbol umísťuje na půdorys.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSymbol({ ...symbol, snap_to_wall: !symbol.snap_to_wall })}
                      className={`relative w-12 h-7 rounded-full transition ${symbol.snap_to_wall ? 'bg-blue-600' : 'bg-white/[0.08]'}`}
                    >
                      <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white/[0.06] shadow transition ${symbol.snap_to_wall ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm font-extrabold text-slate-300">Přichytit ke zdi</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-1">
                    Symbol se automaticky přichytí k nejbližší zdi při umístění.
                  </p>
                </div>

                {symbol.snap_to_wall && (
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Odstup od zdi (mm)</label>
                    <input
                      type="number"
                      value={symbol.wall_offset_mm}
                      onChange={(e) => setSymbol({ ...symbol, wall_offset_mm: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                      placeholder="0"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Vzdálenost mezi symbolem a zdí (0 = dotýká se zdi).
                    </p>
                  </div>
                )}

                {symbol.type === 'svg' && (
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">SVG obsah</label>
                    <textarea
                      value={symbol.svg_content}
                      onChange={(e) => setSymbol({ ...symbol, svg_content: e.target.value })}
                      rows={8}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-mono text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none"
                      placeholder="<svg>...</svg>"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Vložte SVG kód. Symbol bude vyrenderován v zadaných rozměrech.
                    </p>
                    {symbol.svg_content && (
                      <div className="mt-4 p-4 bg-white/[0.04] rounded-xl border border-white/10">
                        <p className="text-xs font-extrabold text-slate-300 mb-2">Náhled:</p>
                        <div
                          className="flex items-center justify-center p-4 bg-navy-800/60 rounded-lg border border-white/10"
                          dangerouslySetInnerHTML={{ __html: symbol.svg_content }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {symbol.type === 'rect' && (
                  <div className="p-4 bg-white/[0.04] rounded-xl border border-white/10">
                    <p className="text-xs font-extrabold text-slate-300 mb-3">Náhled obdélníku:</p>
                    <div className="flex items-center justify-center p-8 bg-navy-800/60 rounded-lg border border-white/10">
                      <div
                        className="bg-blue-600 opacity-50"
                        style={{
                          width: `${Math.min((symbol.width_mm ?? 0) / 2, 200)}px`,
                          height: `${Math.min((symbol.height_mm ?? 0) / 2, 200)}px`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      {symbol.width_mm} × {symbol.height_mm} mm (náhled v měřítku 1:2)
                    </p>
                  </div>
                )}
              </>
            )}

            {symbol.type === 'pin' && (
              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <p className="text-sm font-semibold text-blue-900">
                  Tento produkt bude na půdorysu zobrazen jako standardní pin s výchozí ikonou.
                  Pro vlastní rozměry zvolte typ "Obdélník" nebo "SVG".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mt-6 flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
          <Check className="w-4 h-4" /> {saving ? 'Ukládám...' : isEdit ? 'Uložit změny' : 'Vytvořit položku'}
        </button>
        <button type="button" onClick={onCancel}
          className="bg-navy-800/60 border border-white/[0.08] text-slate-300 px-8 py-3 rounded-xl font-extrabold hover:bg-white/[0.04] transition">
          Zrušit
        </button>
      </div>
      </form>

      {activeTab === 'colors' && product && (
        <div className="max-w-2xl">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
            <ProductColorsManager productId={product.id} />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Barvy se používají k filtrování obrázků v detailu produktu. Nejprve definujte barvy, pak přidejte obrázky a přiřaďte je k barvám.
          </p>
        </div>
      )}

      {activeTab === 'images' && product && (
        <div className="max-w-3xl">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
            <ProductImagesManager productId={product.id} />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Obrázky označené barvou se zobrazí pouze při vybrané barvě. Obrázky "bez barvy" se zobrazí vždy.
          </p>
        </div>
      )}

      {activeTab === 'modules' && product && form.kind === 'design_series' && (
        <div className="max-w-2xl">
          <div className="bg-navy-800/60 rounded-2xl border border-white/[0.06] p-6">
            <ProductDesignModulesManager
              productId={product.id}
              framePrices={form.frame_prices}
              onFramePricesChange={(fp) => setForm((f) => ({ ...f, frame_prices: fp }))}
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Přiřazené vložky se zobrazí u tohoto produktu v katalogu. Každá vložka může mít vlastní cenu specifické pro tuto designovou řadu.
          </p>
        </div>
      )}

      {showIconPicker && (
        <IconPicker
          currentIcon={form.default_icon || undefined}
          onSelect={(iconId) => {
            set('default_icon', iconId ?? '');
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </div>
  );
}
