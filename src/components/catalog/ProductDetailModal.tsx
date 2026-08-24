import { useState, useEffect } from 'react';
import { X, MapPin, Check, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { renderPinIcon } from './floorplan/iconLibrary';
import type { Product, Category, ProductColor, ProductImage, DesignModule, ProductDesignModule } from '../../types/database';

interface ProductModule extends ProductDesignModule {
  module: DesignModule;
}

interface Props {
  productId: string;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  selected: boolean;
  onToggle: () => void;
  onPlace: (color?: { name: string; hex: string }) => void;
  qty: number;
}

export default function ProductDetailModal({
  productId,
  products,
  categories,
  onClose,
  selected,
  onToggle,
  onPlace,
  qty,
}: Props) {
  const product = products.find((p) => p.id === productId);
  const [activeImg, setActiveImg] = useState(0);
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [productModules, setProductModules] = useState<ProductModule[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setActiveImg(0);
    setSelectedColorId(null);

    const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [
      supabase.from('product_colors')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order'),
      supabase.from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order'),
    ];

    const isDesignSeries = products.find((p) => p.id === productId)?.kind === 'design_series';
    if (isDesignSeries) {
      queries.push(
        supabase.from('product_design_modules')
          .select('*')
          .eq('product_id', productId)
          .order('sort_order'),
        supabase.from('design_modules')
          .select('*')
          .order('sort_order'),
      );
    }

    Promise.all(queries).then((results) => {
      const colorsRes = results[0] as { data: ProductColor[] | null };
      const imagesRes = results[1] as { data: ProductImage[] | null };

      const loadedColors = colorsRes.data ?? [];
      setColors(loadedColors);
      setImages(imagesRes.data ?? []);
      if (loadedColors.length > 0) {
        setSelectedColorId(loadedColors[0].id);
      }

      if (isDesignSeries && results.length > 2) {
        const pdmsRes = results[2] as { data: ProductDesignModule[] | null };
        const modulesRes = results[3] as { data: DesignModule[] | null };
        const pdms = pdmsRes.data ?? [];
        const modules = modulesRes.data ?? [];
        setProductModules(
          pdms.map((pdm) => ({
            ...pdm,
            module: modules.find((m) => m.id === pdm.design_module_id)!,
          })).filter((l) => l.module)
        );
      } else {
        setProductModules([]);
      }

      setLoading(false);
    });
  }, [productId]);

  if (!product) return null;

  const cat = categories.find((c) => c.id === product.category_id);

  const baseImages = product.image_url ? [{ url: product.image_url, colorId: null as string | null }] : [];
  const extraImages = images.map((img) => ({ url: img.image_url, colorId: img.color_id }));
  const allRawImages = [...baseImages, ...extraImages].filter((i) => i.url);

  const hasColors = colors.length > 0;

  const visibleImages = hasColors && selectedColorId
    ? allRawImages.filter((img) => !img.colorId || img.colorId === selectedColorId)
    : allRawImages;

  const safeActiveImg = Math.min(activeImg, Math.max(0, visibleImages.length - 1));

  const handleColorSelect = (colorId: string) => {
    setSelectedColorId(colorId);
    setActiveImg(0);
  };

  const navigateImg = (dir: -1 | 1) => {
    setActiveImg((prev) => {
      const next = prev + dir;
      if (next < 0) return visibleImages.length - 1;
      if (next >= visibleImages.length) return 0;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65] flex items-center justify-center p-4 animate-backdrop-enter">
      <div className="bg-navy-800/60 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-modal-enter">
        <div className="p-5 border-b bg-white/[0.04] flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">{product.brand}</div>
            <h3 className="text-lg font-extrabold text-white truncate">{product.name}</h3>
          </div>
          <button onClick={onClose} className="bg-white/[0.06] p-2 rounded-full border  text-slate-400 hover:text-slate-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] aspect-square flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : visibleImages.length > 0 ? (
                <div>
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] aspect-square relative group">
                    <img
                      src={visibleImages[safeActiveImg]?.url || ''}
                      alt={product.name}
                      className="w-full h-full object-cover transition-opacity duration-200"
                    />
                    {visibleImages.length > 1 && (
                      <>
                        <button
                          onClick={() => navigateImg(-1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/[0.06] shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                        >
                          <ChevronLeft className="w-5 h-5 text-slate-300" />
                        </button>
                        <button
                          onClick={() => navigateImg(1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/[0.06] shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.06]"
                        >
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-extrabold px-3 py-1 rounded-full">
                          {safeActiveImg + 1} / {visibleImages.length}
                        </div>
                      </>
                    )}
                  </div>

                  {visibleImages.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {visibleImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                            safeActiveImg === i ? 'border-blue-500 shadow' : 'border-white/10 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {hasColors && (
                    <div className="mt-4">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Barva</div>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((color) => (
                          <button
                            key={color.id}
                            onClick={() => handleColorSelect(color.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition text-xs font-extrabold ${
                              selectedColorId === color.id
                                ? 'border-blue-500 bg-blue-500/10 text-blue-400 '
                                : 'border-white/10 bg-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: color.hex_code }}
                            />
                            {color.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] aspect-square flex items-center justify-center">
                  <span className="text-slate-300 text-5xl font-extrabold">{product.code}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {cat && (
                  <span className={`text-xs font-extrabold px-3 py-1.5 rounded-lg ${cat.pill_color} text-white`}>
                    {cat.name}
                  </span>
                )}
                {product.power && (
                  <span className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-slate-900 text-white">
                    {product.power}
                  </span>
                )}
                {product.tag && (
                  <span className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-300">
                    {product.tag}
                  </span>
                )}
              </div>

              {product.description && (
                <div className="text-sm text-slate-400 leading-relaxed">{product.description}</div>
              )}

              {product.kind === 'design_series' && productModules.length > 0 && (
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Dostupné vložky</div>
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {productModules.map((pm) => {
                      const iconId = pm.icon_url || pm.module.icon_url;
                      const priceNum = typeof pm.price === 'string' ? parseFloat(pm.price) || 0 : (pm.price ?? 0);
                      return (
                        <div key={pm.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                          {iconId ? (
                            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                              {renderPinIcon(iconId, 16, 'text-white')}
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-extrabold text-slate-500">{pm.module.name.charAt(0)}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-white truncate">{pm.module.name}</div>
                            {priceNum > 0 && (
                              <div className="text-[10px] font-semibold text-blue-400">{priceNum.toLocaleString('cs-CZ')} Kč</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Kód</div>
                  <div className="text-sm font-extrabold text-white mt-1">{product.code}</div>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Značka</div>
                  <div className="text-sm font-extrabold text-white mt-1">{product.brand}</div>
                </div>
                {product.price > 0 && (
                  <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Cena</div>
                    <div className="text-sm font-extrabold text-blue-400 mt-1">{product.price.toLocaleString('cs-CZ')} Kč</div>
                  </div>
                )}
                {qty > 0 && (
                  <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Umístěno</div>
                    <div className="text-sm font-extrabold text-white mt-1">{qty} ks</div>
                  </div>
                )}
              </div>

              {hasColors && selectedColorId && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                    style={{ backgroundColor: colors.find((c) => c.id === selectedColorId)?.hex_code }}
                  />
                  <span className="text-sm font-extrabold text-slate-300">
                    {colors.find((c) => c.id === selectedColorId)?.name}
                  </span>
                </div>
              )}

              {selected && (
                <div className="bg-emerald-500/10 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-extrabold text-emerald-800">Produkt je ve vašem výběru</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={onToggle}
                  className={`flex-1 py-3 rounded-xl font-extrabold transition flex items-center justify-center gap-2 ${
                    selected
                      ? 'bg-red-500/10 text-red-400 border border-red-200 hover:bg-red-500/20'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'
                  }`}
                >
                  {selected ? (
                    <><Minus className="w-4 h-4" /> Odebrat z výběru</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Přidat do výběru</>
                  )}
                </button>
                <button
                  onClick={() => {
                    const selColor = selectedColorId ? colors.find(c => c.id === selectedColorId) : null;
                    onPlace(selColor ? { name: selColor.name, hex: selColor.hex_code } : undefined);
                  }}
                  className="px-5 py-3 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" /> Umístit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
