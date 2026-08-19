import { useState } from 'react';
import { Search, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import type { Product, Category } from '../../types/database';
import type { SelectionState, CircuitType } from '../../hooks/useProjectState';

interface Props {
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  activeProductId: string | null;
  onPickProduct: (productId: string) => void;
  visibleLayers?: Record<CircuitType, boolean>;
}

export default function ProductPicker({
  products,
  categories,
  selected,
  activeProductId,
  onPickProduct,
  visibleLayers,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const selectedIds = Object.keys(selected);
  const selectedProducts = (selectedIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[])
    .filter((p) => {
      if (!visibleLayers) return true;
      const trade = (p.trade || 'electric') as CircuitType;
      return visibleLayers[trade];
    });

  const q = search.toLowerCase();
  const filtered = q
    ? selectedProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
    : selectedProducts;

  const grouped = new Map<string, Product[]>();
  for (const p of filtered) {
    const cat = categories.find((c) => c.id === p.category_id);
    const key = cat?.name ?? 'Ostatní';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-extrabold uppercase tracking-wider">
            Produkty k umístění
          </span>
          <span className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[10px] font-extrabold">
            {selectedProducts.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>

      {!collapsed && (
        <div className="bg-white/[0.04]">
          {selectedProducts.length > 5 && (
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Hledat v seznamu..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}

          <div className="max-h-[280px] overflow-auto p-3 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-xs font-extrabold text-slate-400">
                  {selectedProducts.length === 0
                    ? 'Zatím žádné vybrané produkty'
                    : 'Nic nenalezeno'}
                </div>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([catName, items]) => (
                <div key={catName}>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                    {catName}
                  </div>
                  <div className="space-y-1">
                    {items.map((product) => {
                      const isActive = product.id === activeProductId;
                      const qty = selected[product.id]?.placements?.length ?? 0;
                      const cat = categories.find((c) => c.id === product.category_id);
                      return (
                        <button
                          key={product.id}
                          onClick={() => onPickProduct(product.id)}
                          className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition group ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white/[0.06] border border-slate-150 hover:border-blue-300 hover:'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">
                                {product.code}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-[11px] font-extrabold truncate ${
                                isActive ? 'text-white' : 'text-white'
                              }`}
                            >
                              {product.name}
                            </div>
                            <div
                              className={`text-[10px] ${
                                isActive ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {product.brand} {product.code}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {qty > 0 && (
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                  isActive
                                    ? 'bg-white/[0.06] text-white'
                                    : 'bg-white/[0.06] text-slate-400'
                                }`}
                              >
                                {qty}x
                              </span>
                            )}
                            {cat && (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${cat.pill_color}`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
