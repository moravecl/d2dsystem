import { useState, useEffect } from 'react';
import { Plus, Trash2, CircleDot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import IconPicker from '../catalog/floorplan/IconPicker';
import { renderPinIcon } from '../catalog/floorplan/iconLibrary';
import type { DesignModule, ProductDesignModule } from '../../types/database';

interface Props {
  productId: string;
  framePrices: Record<string, number> | null;
  onFramePricesChange: (fp: Record<string, number>) => void;
}

interface LinkedModule extends ProductDesignModule {
  module: DesignModule;
}

export default function ProductDesignModulesManager({ productId, framePrices, onFramePricesChange }: Props) {
  const [allModules, setAllModules] = useState<DesignModule[]>([]);
  const [linked, setLinked] = useState<LinkedModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const { toast } = useToast();

  const fp = framePrices ?? {};

  const load = async () => {
    const [modulesRes, linkedRes] = await Promise.all([
      supabase.from('design_modules').select('*').order('sort_order'),
      supabase.from('product_design_modules').select('*').eq('product_id', productId).order('sort_order'),
    ]);

    const modules = modulesRes.data ?? [];
    const pdms = linkedRes.data ?? [];

    setAllModules(modules);
    setLinked(
      pdms.map((pdm: ProductDesignModule) => ({
        ...pdm,
        module: modules.find((m) => m.id === pdm.design_module_id)!,
      })).filter((l: LinkedModule) => l.module)
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const linkedIds = new Set(linked.map((l) => l.design_module_id));
  const available = allModules.filter((m) => !linkedIds.has(m.id));

  const handleAdd = async (moduleId: string) => {
    const mod = allModules.find((m) => m.id === moduleId);
    if (!mod) return;
    const maxOrder = linked.length > 0 ? Math.max(...linked.map((l) => l.sort_order)) + 1 : 0;
    const { error } = await supabase.from('product_design_modules').insert({
      product_id: productId,
      design_module_id: moduleId,
      price: mod.price ?? 0,
      sort_order: maxOrder,
    });
    if (error) { toast(error.message, 'error'); return; }
    load();
  };

  const handleAddAll = async () => {
    if (available.length === 0) return;
    const startOrder = linked.length > 0 ? Math.max(...linked.map((l) => l.sort_order)) + 1 : 0;
    const rows = available.map((m, i) => ({
      product_id: productId,
      design_module_id: m.id,
      price: m.price ?? 0,
      sort_order: startOrder + i,
    }));
    const { error } = await supabase.from('product_design_modules').insert(rows);
    if (error) { toast(error.message, 'error'); return; }
    toast('Všechny vložky přidány');
    load();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('product_design_modules').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    load();
  };

  const handlePriceChange = (id: string, price: number) => {
    setLinked((prev) => prev.map((l) => l.id === id ? { ...l, price } : l));
  };

  const handlePriceSave = async (id: string) => {
    const item = linked.find((l) => l.id === id);
    if (!item) return;
    const { error } = await supabase.from('product_design_modules').update({ price: item.price }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
  };

  const handleIconSelect = async (iconId: string | undefined) => {
    if (!pickerForId) return;
    const val = iconId ?? null;
    const { error } = await supabase.from('product_design_modules').update({ icon_url: val }).eq('id', pickerForId);
    if (error) { toast(error.message, 'error'); return; }
    setLinked((prev) => prev.map((l) => l.id === pickerForId ? { ...l, icon_url: val } : l));
    setPickerForId(null);
  };

  const getDisplayIconId = (item: LinkedModule): string | null => {
    return item.icon_url || item.module.icon_url || null;
  };

  const handleFramePrice = (size: string, value: number) => {
    const next = { ...fp, [size]: value };
    onFramePricesChange(next);
  };

  if (loading) return <div className="text-sm text-slate-500 py-4">Načítám vložky...</div>;

  if (allModules.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500 mb-1">Žádné designové moduly v systému.</p>
        <p className="text-xs text-slate-400">Nejdříve vytvořte moduly v Admin &gt; Designové moduly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-extrabold text-white text-sm">Vložky design řady</h4>
          {available.length > 0 && (
            <button
              onClick={handleAddAll}
              className="text-xs font-extrabold text-blue-400 hover:text-blue-400 transition"
            >
              Přidat vše ({available.length})
            </button>
          )}
        </div>

        {linked.length > 0 && (
          <div className="space-y-2 mb-5">
            {linked.map((item) => {
              const iconId = getDisplayIconId(item);
              const rendered = iconId ? renderPinIcon(iconId, 20, 'text-slate-400') : null;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setPickerForId(item.id)}
                    className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-300 bg-white/[0.06] flex items-center justify-center shrink-0 hover:border-blue-400 hover:bg-blue-500/10 transition group"
                    title="Vybrat ikonu"
                  >
                    {rendered || (
                      <CircleDot className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition" />
                    )}
                  </button>
                  <span className="font-extrabold text-white text-sm flex-1 min-w-0 truncate">
                    {item.module.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handlePriceChange(item.id, Number(e.target.value) || 0)}
                      onBlur={() => handlePriceSave(item.id)}
                      className="w-24 px-2.5 py-1.5 rounded-lg border border-white/10 text-sm font-extrabold text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-xs text-slate-400 font-semibold">Kč</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {available.length > 0 && (
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Dostupné moduly k přidání
            </div>
            <div className="flex flex-wrap gap-1.5">
              {available.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAdd(m.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-extrabold text-slate-400 hover:bg-blue-500/10 hover:border-blue-300 hover:text-blue-400 transition"
                >
                  <Plus className="w-3 h-3" />
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {linked.length > 0 && available.length === 0 && (
          <p className="text-xs text-emerald-400 font-semibold mt-2">Všechny moduly jsou přiřazeny.</p>
        )}
      </div>

      <div className="border-t border-white/10 pt-5">
        <h4 className="font-extrabold text-white text-sm mb-3">Ceny rámečků</h4>
        <p className="text-xs text-slate-500 mb-3">Cena samotného rámečku (bez vložek) pro každý počet modulů.</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n}>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1 text-center">{n}R</label>
              <input
                type="number"
                value={fp[String(n)] ?? ''}
                onChange={(e) => handleFramePrice(String(n), Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-2.5 py-2 rounded-lg border border-white/10 text-sm font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>
      </div>

      {pickerForId && (
        <IconPicker
          currentIcon={linked.find((l) => l.id === pickerForId)?.icon_url ?? undefined}
          onSelect={handleIconSelect}
          onClose={() => setPickerForId(null)}
        />
      )}
    </div>
  );
}
