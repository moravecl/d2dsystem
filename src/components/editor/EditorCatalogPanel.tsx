import { useState, useMemo } from 'react';
import { Search, MapPin, Info, Plus } from 'lucide-react';
import type { Product, Category } from '../../types/database';
import type { SelectionState } from '../../hooks/useProjectState';
import ProductDetailModal from '../catalog/ProductDetailModal';
import EditorProductForm from './EditorProductForm';

interface Props {
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  activeProductId: string | null;
  onStartPlacing: (productId: string, color?: { name: string; hex: string }) => void;
}

export default function EditorCatalogPanel({
  products,
  categories,
  selected,
  activeProductId,
  onStartPlacing,
}: Props) {
  const [search, setSearch] = useState('');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);


  const catsWithProducts = useMemo(() => {
    return categories.filter((c) => products.some((p) => p.category_id === c.id));
  }, [categories, products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCatId) list = list.filter((p) => p.category_id === activeCatId);
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

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const cat = categories.find((c) => c.id === p.category_id);
      const key = cat?.name ?? 'Ostatni';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [filtered, categories]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat produkt..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveCatId(null)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition ${
              !activeCatId ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
            }`}
          >
            Vše
          </button>
          {catsWithProducts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCatId(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition ${
                activeCatId === cat.id ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-xs font-extrabold text-slate-400">Nic nenalezeno</div>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([catName, items]) => (
              <div key={catName}>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                  {catName}
                </div>
                <div className="space-y-1">
                  {items.map((product) => {
                    const isActive = product.id === activeProductId;
                    const qty = selected[product.id]?.placements?.length ?? 0;
                    return (
                      <button
                        key={product.id}
                        onClick={() => onStartPlacing(product.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition group ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white/[0.06] border border-white/[0.06] hover:border-blue-300 hover:'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                              {product.code}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-extrabold truncate ${isActive ? 'text-white' : 'text-white'}`}>
                            {product.name}
                          </div>
                          <div className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                            {product.brand} {product.code}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {qty > 0 && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              isActive ? 'bg-white/[0.06] text-white' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {qty}x
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailProductId(product.id); }}
                            className={`p-0.5 rounded transition ${isActive ? 'text-white/70 hover:text-white' : 'text-slate-300 hover:text-slate-500'}`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <MapPin className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={() => setShowNewProduct(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition "
        >
          <Plus className="w-3.5 h-3.5" /> Nový produkt
        </button>
      </div>

      {detailProductId && (
        <ProductDetailModal
          productId={detailProductId}
          products={products}
          categories={categories}
          onClose={() => setDetailProductId(null)}
          selected={!!selected[detailProductId]}
          onToggle={() => onStartPlacing(detailProductId)}
          onPlace={(color) => { onStartPlacing(detailProductId, color); setDetailProductId(null); }}
          qty={selected[detailProductId]?.placements?.length ?? 0}
        />
      )}

      {showNewProduct && (
        <EditorProductForm
          categories={categories}
          onClose={() => setShowNewProduct(false)}
          onSaved={() => setShowNewProduct(false)}
        />
      )}
    </div>
  );
}
