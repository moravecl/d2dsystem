import { memo } from 'react';
import { MapPin, Check, Eye } from 'lucide-react';
import type { Product, Category } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';

interface Props {
  product: Product;
  category: Category | undefined;
  selected: boolean;
  qty: number;
  onToggle: () => void;
  onPlace: () => void;
  onDetail: () => void;
}

export default memo(function ProductCard({ product, category, selected, qty, onToggle, onPlace, onDetail }: Props) {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canViewPrices = hasPermission('view_prices');
  return (
    <div
      className={`group bg-navy-800/60 rounded-3xl overflow-hidden cursor-pointer  hover:shadow-xl transition-all duration-250 hover:-translate-y-1 relative ${
        selected
          ? 'ring-2 ring-emerald-500 ring-offset-2'
          : 'border-2 border-transparent'
      }`}
    >
      {selected && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-emerald-600 text-white text-center py-1.5 text-xs font-extrabold tracking-wider flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
          VYBRANO
          {qty > 0 && <span className="bg-white/[0.06] px-2 py-0.5 rounded-full ml-1">{qty} ks</span>}
        </div>
      )}

      <div className="relative h-52 bg-white/[0.06] overflow-hidden" onClick={onToggle}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-full h-full object-cover transition duration-500 group-hover:scale-110 ${
              selected ? 'brightness-[1.02]' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
            <span className="text-slate-300 text-4xl font-extrabold">{product.code}</span>
          </div>
        )}

        {product.tag && (
          <div className={`absolute left-3 bg-white/[0.06] backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-slate-300  border border-white/50 ${selected ? 'top-11' : 'top-3'}`}>
            {product.tag}
          </div>
        )}

        <div className={`absolute right-3 bg-white/[0.06] backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-slate-300 border border-white/50  ${selected ? 'top-11' : 'top-3'}`}>
          {product.code}
        </div>

        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          {category && (
            <span className={`text-[10px] font-extrabold px-2 py-1 rounded-lg ${category.pill_color} text-white inline-flex items-center gap-1`}>
              {category.name}
            </span>
          )}
          {product.power && (
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-slate-900/75 text-white inline-flex items-center gap-1">
              {product.power}
            </span>
          )}
        </div>

        {!selected && qty === 0 && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/[0.06] backdrop-blur px-4 py-2 rounded-xl text-sm font-extrabold text-white shadow-lg">
              Klikni pro výběr
            </div>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col h-[210px]" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">{product.brand}</span>
          {product.kind === 'design_series' && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-200 uppercase tracking-wider">Designová řada</span>
          )}
        </div>

        <h3 className="font-extrabold text-white text-lg mt-2 leading-tight">{product.name}</h3>
        <p className="text-xs text-slate-500 leading-relaxed mt-2 line-clamp-2">{product.description}</p>

        {product.price > 0 && permissionsLoading && (
          <div className="mt-2 h-5 w-24 rounded bg-white/[0.06] animate-skeleton" aria-hidden="true" />
        )}
        {product.price > 0 && !permissionsLoading && canViewPrices && (
          <div className="mt-2 text-sm font-extrabold text-blue-400">{product.price.toLocaleString('cs-CZ')} Kc</div>
        )}

        <div className="mt-auto pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              className="text-xs font-extrabold px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.08] transition flex items-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); onPlace(); }}
            >
              <MapPin className="w-3.5 h-3.5" /> Umístit
            </button>
            <button
              className={`text-xs font-extrabold px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                product.kind === 'design_series'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-200 hover:bg-amber-500/20'
                  : 'bg-white/[0.06] hover:bg-white/[0.08]'
              }`}
              onClick={(e) => { e.stopPropagation(); onDetail(); }}
            >
              <Eye className="w-3.5 h-3.5" /> {product.kind === 'design_series' ? 'Vložky' : 'Detail'}
            </button>
          </div>

          {selected ? (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-200">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              <span className="text-xs font-extrabold">{qty > 0 ? `${qty} ks` : 'Vybrano'}</span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400">
              Klikni pro výběr
            </div>
          )}
        </div>
      </div>
    </div>
  );
})
