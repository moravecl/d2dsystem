import { useState, useMemo } from 'react';
import { X, Search, Plus, MapPin } from 'lucide-react';
import type { Product, Category } from '../../types/database';
import type { SelectionState } from '../../hooks/useProjectState';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  onToggleProduct: (product: Product) => void;
  onPlaceProduct: (productId: string) => void;
}

export default function CatalogBrowser({
  open,
  onClose,
  products,
  categories,
  selected,
  onToggleProduct,
  onPlaceProduct,
}: Props) {
  const [search, setSearch] = useState('');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCatId) {
      list = list.filter((p) => p.category_id === activeCatId);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeCatId, search]);

  const catsWithProducts = useMemo(() => {
    return categories.filter((c) => products.some((p) => p.category_id === c.id));
  }, [categories, products]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className="bg-navy-800/60 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-modal-enter">
        <div className="p-4 border-b bg-white/[0.04] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-white">Katalog produktů</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Přidej produkty do projektu a umísti je na půdorys.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-navy-800/60 border border-white/[0.08] text-slate-400 hover:text-slate-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat produkt..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCatId(null)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition ${
                !activeCatId ? 'bg-slate-900 text-white ' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              Vše
            </button>
            {catsWithProducts.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCatId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition ${
                  activeCatId === cat.id ? 'bg-slate-900 text-white ' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-sm font-extrabold text-slate-400">Nic nenalezeno</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredProducts.map((product) => {
                const isSelected = !!selected[product.id];
                const qty = selected[product.id]?.placements?.length ?? 0;
                const cat = categories.find((c) => c.id === product.category_id);
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                      isSelected ? 'border-blue-300 bg-blue-500/10' : 'border-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.06] shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                          {product.code}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-white truncate">{product.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{product.brand} {product.code}</div>
                      {cat && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${cat.pill_color}`} />
                          <span className="text-[10px] text-slate-400">{cat.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && qty > 0 && (
                        <span className="text-[10px] font-extrabold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">{qty}x</span>
                      )}
                      {isSelected ? (
                        <button
                          onClick={() => onPlaceProduct(product.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold hover:bg-blue-700 transition flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" /> Umístit
                        </button>
                      ) : (
                        <button
                          onClick={() => onToggleProduct(product)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-extrabold hover:bg-slate-800 transition flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Přidat
                        </button>
                      )}
                      {isSelected && (
                        <button
                          onClick={() => onToggleProduct(product)}
                          title="Odebrat z projektu"
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white/[0.04] flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {Object.keys(selected).length} produktů v projektu
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
}
