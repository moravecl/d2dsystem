import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { renderPinIcon } from './floorplan/iconLibrary';
import type { DesignModule, DesignPreset, ProductColor, Product, ProductDesignModule } from '../../types/database';

interface ProductModule extends ProductDesignModule {
  module: DesignModule;
}

interface Props {
  product: Product;
  designModules: DesignModule[];
  designPresets: DesignPreset[];
  productColors: ProductColor[];
  frameSize: number;
  modules: string[];
  designColor: { name: string; hex: string } | null;
  onFrameSize: (n: number) => void;
  onSlotChange: (idx: number, val: string) => void;
  onColorChange: (color: { name: string; hex: string } | null) => void;
  onApplyPreset: (preset: DesignPreset) => void;
}

export default function DesignBuilder({
  product,
  designModules,
  designPresets,
  productColors,
  frameSize,
  modules,
  designColor,
  onFrameSize,
  onSlotChange,
  onColorChange,
  onApplyPreset,
}: Props) {
  const [productModules, setProductModules] = useState<ProductModule[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    supabase
      .from('product_design_modules')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order')
      .then(({ data }) => {
        const pdms = data ?? [];
        if (pdms.length > 0) {
          setProductModules(
            pdms.map((pdm: ProductDesignModule) => ({
              ...pdm,
              module: designModules.find((m) => m.id === pdm.design_module_id)!,
            })).filter((l) => l.module)
          );
        } else {
          setProductModules([]);
        }
        setLoaded(true);
      });
  }, [product.id, designModules]);

  const pmByModuleId = new Map(productModules.map((pm) => [pm.design_module_id, pm]));

  const num = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    return 0;
  };

  const getModulePrice = (name: string): number => {
    const dm = designModules.find((m) => m.name === name);
    if (!dm) return 0;
    const pm = pmByModuleId.get(dm.id);
    if (pm) return num(pm.price);
    return num(dm.price);
  };

  const getModuleIcon = (name: string): string | null => {
    const dm = designModules.find((m) => m.name === name);
    if (!dm) return null;
    const pm = pmByModuleId.get(dm.id);
    return pm?.icon_url || dm.icon_url || null;
  };

  const dropdownOptions = designModules.map((m) => {
    const pm = pmByModuleId.get(m.id);
    return { name: m.name, price: pm ? num(pm.price) : num(m.price) };
  });

  const colors = productColors.filter((c) => c.product_id === product.id);
  const totalModulePrice = modules.reduce((sum, m) => sum + getModulePrice(m), 0);
  const framePrices = (product.frame_prices as Record<string, number> | null) ?? {};
  const framePrice = framePrices[String(frameSize)] ?? 0;
  const totalPrice = totalModulePrice + framePrice;

  if (!loaded) return null;

  return (
    <div className="border-b border-blue-500/20 bg-blue-500/10">
      <div className="px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-extrabold">1</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider opacity-80">Konfigurace rámečků</div>
            <div className="text-sm font-extrabold">{product.brand} - {product.name}</div>
          </div>
          {totalPrice > 0 && (
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {framePrice > 0 ? 'Rámeček + vložky' : 'Vložky'}
              </div>
              <div className="text-sm font-extrabold">{totalPrice.toLocaleString('cs-CZ')} Kč</div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Počet modulů v rámečku</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const fp = framePrices[String(n)] ?? 0;
              return (
                <button
                  key={n}
                  onClick={() => onFrameSize(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-extrabold transition flex flex-col items-center ${
                    frameSize === n
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-navy-800/60 border border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{n}</span>
                  {fp > 0 && (
                    <span className={`text-[9px] font-semibold ${frameSize === n ? 'text-blue-200' : 'text-slate-400'}`}>
                      {fp.toLocaleString('cs-CZ')} Kč
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Vložky v rámečku</label>
          <div className="space-y-1.5">
            {Array.from({ length: frameSize }).map((_, i) => {
              const modName = modules[i] || '';
              const modIcon = getModuleIcon(modName);
              const modPrice = getModulePrice(modName);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-extrabold shadow shrink-0 overflow-hidden">
                    {modIcon ? (
                      renderPinIcon(modIcon, 16, 'text-white') ?? (i + 1)
                    ) : (
                      i + 1
                    )}
                  </div>
                  <select
                    value={modName}
                    onChange={(e) => onSlotChange(i, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-extrabold"
                  >
                    {dropdownOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name}{opt.price > 0 ? ` (${opt.price.toLocaleString('cs-CZ')} Kč)` : ''}
                      </option>
                    ))}
                  </select>
                  {modPrice > 0 && (
                    <div className="text-xs font-extrabold text-blue-400 shrink-0 w-16 text-right">
                      {modPrice.toLocaleString('cs-CZ')} Kč
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {colors.length > 0 && (
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Barva</label>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => {
                const isActive = designColor?.name === c.name;
                return (
                  <button
                    key={c.id}
                    onClick={() => onColorChange(isActive ? null : { name: c.name, hex: c.hex_code })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 transition text-xs font-extrabold ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.hex_code }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {designPresets.length > 0 && (
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Rychlé presety</label>
            <div className="flex flex-wrap gap-1.5">
              {designPresets.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => onApplyPreset(pr)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition"
                >
                  {pr.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-navy-800/60 rounded-lg border border-blue-200 p-3 flex items-start gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-extrabold text-blue-400 shrink-0 mt-0.5">2</div>
          <div className="text-xs text-blue-400 font-semibold leading-relaxed">
            Teď klikni na půdorys vlevo, kam chceš rámeček umístit. Každé kliknutí přidá pin s touto konfigurací.
          </div>
        </div>
      </div>
    </div>
  );
}
