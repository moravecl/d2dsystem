import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LayoutGrid, LayoutList, Package, Maximize2, Minimize2, Warehouse } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import type { Product, Category, Subcategory } from '../../types/database';
import ProductDetailModal from '../../components/catalog/ProductDetailModal';

const inputClasses = 'w-full px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

export default function CatalogListPage() {
  const { setConfig } = useHeader();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [cardSize, setCardSize] = useState<'normal' | 'small'>(() => {
    const saved = localStorage.getItem('catalog_card_size');
    return (saved === 'small' || saved === 'normal') ? saved : 'normal';
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, { qty: number; unit: string }>>({});

  useEffect(() => {
    localStorage.setItem('catalog_card_size', cardSize);
  }, [cardSize]);

  const loadData = useCallback(async () => {
    const [productsRes, categoriesRes, subcategoriesRes, stockRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('sort_order'),
      supabase.from('warehouse_items').select('product_id, quantity, unit').eq('is_active', true).not('product_id', 'is', null),
    ]);
    setProducts((productsRes.data || []) as Product[]);
    setCategories((categoriesRes.data || []) as Category[]);
    setSubcategories((subcategoriesRes.data || []) as Subcategory[]);
    const sm: Record<string, { qty: number; unit: string }> = {};
    for (const item of (stockRes.data || []) as { product_id: string; quantity: number; unit: string }[]) {
      if (item.product_id) sm[item.product_id] = { qty: item.quantity, unit: item.unit };
    }
    setStockMap(sm);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (isAdmin) {
      setConfig({
        breadcrumbs: [{ label: 'Katalog' }],
        primaryAction: {
          label: 'Nový produkt',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => navigate('/admin/products'),
        },
      });
    } else {
      setConfig({ breadcrumbs: [{ label: 'Katalog' }] });
    }
  }, [setConfig, isAdmin]);


  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();

  const filteredSubs = categoryFilter ? subcategories.filter(s => s.category_id === categoryFilter) : [];

  const filtered = products.filter((p) => {
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    if (subcategoryFilter && p.subcategory_id !== subcategoryFilter) return false;
    if (brandFilter && p.brand !== brandFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  });

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || '';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat produkty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }}
            className="px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          >
            <option value="">Vše kategorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {filteredSubs.length > 0 && (
            <select
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            >
              <option value="">Vše podkategorie</option>
              {filteredSubs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-white/10 rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          >
            <option value="">Vše značky</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <div className="flex bg-navy-800/60 border border-white/[0.08] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2.5 transition-all ${view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white/[0.04]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-2.5 transition-all ${view === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white/[0.04]'}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          {view === 'grid' && (
            <button
              onClick={() => setCardSize(cardSize === 'normal' ? 'small' : 'normal')}
              className="p-2.5 bg-navy-800/60 border border-white/[0.08] rounded-xl text-slate-500 hover:bg-white/[0.04] transition-all"
              title={cardSize === 'normal' ? 'Zmenšit náhledy' : 'Zvětšit náhledy'}
            >
              {cardSize === 'normal' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-48 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-12 text-center  shadow-slate-100">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Žádné produkty</p>
        </div>
      ) : view === 'grid' ? (
        <div className={`grid gap-4 ${
          cardSize === 'small'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {filtered.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
            >
              <div className={`${cardSize === 'small' ? 'aspect-square' : 'aspect-[4/3]'} bg-white/[0.04] relative overflow-hidden`}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-slate-200" />
                  </div>
                )}
                {product.brand && (
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-white/[0.06]/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-slate-400 border border-white/50">
                    {product.brand}
                  </span>
                )}
              </div>
              <div className={`${cardSize === 'small' ? 'p-2' : 'p-4'}`}>
                <div className={`${cardSize === 'small' ? 'text-[10px]' : 'text-xs'} text-slate-400 mb-1 font-medium truncate`}>{product.code}</div>
                <div className={`${cardSize === 'small' ? 'text-xs' : 'text-sm'} font-semibold text-white line-clamp-2 mb-2`}>{product.name}</div>
                <div className="flex items-center justify-between">
                  <span className={`${cardSize === 'small' ? 'text-[10px]' : 'text-xs'} text-slate-500 font-medium truncate`}>{getCategoryName(product.category_id)}</span>
                  <span className={`${cardSize === 'small' ? 'text-xs' : 'text-sm'} font-bold text-white`}>{product.price.toLocaleString('cs-CZ')} Kč</span>
                </div>
                {stockMap[product.id] !== undefined && (
                  <div className={`mt-2 flex items-center gap-1.5 ${cardSize === 'small' ? 'text-[9px]' : 'text-[10px]'}`}>
                    <Warehouse className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className={`font-bold ${stockMap[product.id].qty > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                      {stockMap[product.id].qty > 0
                        ? `${stockMap[product.id].qty} ${stockMap[product.id].unit} skladem`
                        : 'Není skladem'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden  shadow-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04]/80">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">Produkt</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell border-b border-white/[0.06]">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell border-b border-white/[0.06]">Kategorie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell border-b border-white/[0.06]">Značka</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell border-b border-white/[0.06]">Sklad</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-500/100/10/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 overflow-hidden border border-white/[0.06]">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden sm:table-cell">{product.code}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden md:table-cell">{getCategoryName(product.category_id)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden md:table-cell">{product.brand}</td>
                    <td className="px-5 py-3.5 text-sm text-right hidden lg:table-cell">
                      {stockMap[product.id] !== undefined ? (
                        <span className={`font-semibold ${stockMap[product.id].qty > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                          {stockMap[product.id].qty > 0 ? `${stockMap[product.id].qty} ${stockMap[product.id].unit}` : 'Není skladem'}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-white text-right">{product.price.toLocaleString('cs-CZ')} Kč</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          products={products}
          categories={categories}
          onClose={() => setSelectedProductId(null)}
          selected={false}
          onToggle={() => {}}
          onPlace={() => setSelectedProductId(null)}
          qty={0}
        />
      )}
    </div>
  );
}
