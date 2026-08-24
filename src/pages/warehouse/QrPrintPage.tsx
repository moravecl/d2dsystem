import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Printer,
  Filter,
  Check,
  X,
  Loader2,
  Package,
  Grid3X3,
} from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { supabase } from '../../lib/supabase';

interface WarehouseItem {
  id: string;
  name: string | null;
  sku: string | null;
  location: string | null;
  qr_code: string | null;
  product_id: string | null;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

interface CatalogProduct {
  id: string;
  category_id: string;
  subcategory_id: string | null;
}

type LabelSize = 'small' | 'medium' | 'large';
type ColumnsCount = 2 | 3 | 4 | 5;

const LABEL_SIZES: Record<LabelSize, { qr: number; name: string }> = {
  small: { qr: 80, name: 'Maly (80px)' },
  medium: { qr: 120, name: 'Stredni (120px)' },
  large: { qr: 160, name: 'Velky (160px)' },
};

export default function QrPrintPage() {
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [columns, setColumns] = useState<ColumnsCount>(3);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [generatingQr, setGeneratingQr] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Sklad', href: '/sklad' },
        { label: 'Tisk QR kodu' },
      ],
    });
  }, [setConfig]);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, catRes, subRes, prodRes] = await Promise.all([
        supabase
          .from('warehouse_items')
          .select('id, name, sku, location, qr_code, product_id')
          .eq('is_active', true)
          .order('name'),
        supabase.from('categories').select('id, name, sort_order').order('sort_order'),
        supabase
          .from('subcategories')
          .select('id, category_id, name, sort_order')
          .order('sort_order'),
        supabase.from('products').select('id, category_id, subcategory_id').eq('is_active', true),
      ]);

      setItems((itemsRes.data || []) as WarehouseItem[]);
      setCategories((catRes.data || []) as Category[]);
      setSubcategories((subRes.data || []) as Subcategory[]);
      setProducts((prodRes.data || []) as CatalogProduct[]);
    } catch (err) {
      console.error('Failed to load QR print data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const productById = new Map(products.map((p) => [p.id, p]));

  const filteredSubs = categoryFilter
    ? subcategories.filter((s) => s.category_id === categoryFilter)
    : [];

  const filteredItems = items.filter((item) => {
    if (categoryFilter || subcategoryFilter) {
      if (!item.product_id) return false;
      const prod = productById.get(item.product_id);
      if (!prod) return false;
      if (categoryFilter && prod.category_id !== categoryFilter) return false;
      if (subcategoryFilter && prod.subcategory_id !== subcategoryFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        (item.name || '').toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedItems(new Set(filteredItems.map((i) => i.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const generateQrCodes = async () => {
    setGeneratingQr(true);
    const newUrls: Record<string, string> = {};

    for (const itemId of selectedItems) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;

      const code = item.qr_code || item.id;
      try {
        const dataUrl = await QRCode.toDataURL(code, {
          width: LABEL_SIZES[labelSize].qr * 2,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        newUrls[itemId] = dataUrl;
      } catch {
        console.error('Failed to generate QR for', itemId);
      }
    }

    setQrDataUrls(newUrls);
    setGeneratingQr(false);
  };

  const handlePrint = async () => {
    await generateQrCodes();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const selectedItemsList = items.filter((i) => selectedItems.has(i.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page {
            margin: 10mm;
          }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print flex items-center gap-4">
        <button
          onClick={() => navigate('/warehouse')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpet na sklad
        </button>
      </div>

      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              Vyber polozek
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
              >
                Vybrat vse ({filteredItems.length})
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1.5 text-slate-400 hover:bg-white/[0.04] rounded-lg transition"
              >
                Zrusit vyber
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubcategoryFilter('');
              }}
              className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                categoryFilter
                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 font-semibold'
                  : 'bg-white/[0.06] border-white/10 text-slate-300'
              }`}
            >
              <option value="">Vse kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {filteredSubs.length > 0 && (
              <select
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                  subcategoryFilter
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 font-semibold'
                    : 'bg-white/[0.06] border-white/10 text-slate-300'
                }`}
              >
                <option value="">Vse podkategorie</option>
                {filteredSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {(categoryFilter || subcategoryFilter) && (
              <button
                onClick={() => {
                  setCategoryFilter('');
                  setSubcategoryFilter('');
                }}
                className="flex items-center gap-1 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.04] rounded-xl transition"
              >
                <X className="w-3.5 h-3.5" />
                Zrusit filtry
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Zadne polozky odpovidajici filtru
              </div>
            ) : (
              filteredItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                    selectedItems.has(item.id)
                      ? 'bg-blue-500/10 border border-blue-500/30'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                      selectedItems.has(item.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-white/20'
                    }`}
                  >
                    {selectedItems.has(item.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {item.name || 'Bez nazvu'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.sku ? `SKU: ${item.sku}` : ''}
                      {item.sku && item.location ? ' | ' : ''}
                      {item.location ? `Umisteni: ${item.location}` : ''}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-slate-400" />
              Nastaveni tisku
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Velikost QR kodu
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(LABEL_SIZES) as [LabelSize, { qr: number; name: string }][]).map(
                    ([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setLabelSize(key)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                          labelSize === key
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {val.name}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Pocet sloupcu
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([2, 3, 4, 5] as ColumnsCount[]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setColumns(n)}
                      className={`px-3 py-2 text-sm font-bold rounded-lg border transition ${
                        columns === n
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Vybrano</h3>
              <span className="text-2xl font-bold text-blue-400">
                {selectedItems.size}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {selectedItems.size === 0
                ? 'Vyberte polozky pro tisk'
                : `${selectedItems.size} QR stitku k tisku`}
            </p>
            <button
              onClick={handlePrint}
              disabled={selectedItems.size === 0 || generatingQr}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingQr ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Tisknout QR kody
            </button>
          </div>
        </div>
      </div>

      <div
        id="print-area"
        ref={printRef}
        className="bg-white p-8"
        style={{
          display: Object.keys(qrDataUrls).length > 0 ? 'block' : 'none',
        }}
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
          }}
        >
          {selectedItemsList.map((item) => (
            <div
              key={item.id}
              className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center"
              style={{ pageBreakInside: 'avoid' }}
            >
              {qrDataUrls[item.id] ? (
                <img
                  src={qrDataUrls[item.id]}
                  alt={item.name ?? ''}
                  style={{
                    width: LABEL_SIZES[labelSize].qr,
                    height: LABEL_SIZES[labelSize].qr,
                  }}
                />
              ) : (
                <div
                  className="bg-gray-100 flex items-center justify-center"
                  style={{
                    width: LABEL_SIZES[labelSize].qr,
                    height: LABEL_SIZES[labelSize].qr,
                  }}
                >
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="mt-2 text-xs font-semibold text-gray-800 line-clamp-2">
                {item.name || 'Bez nazvu'}
              </div>
              {item.sku ? (
                <div className="text-[10px] text-gray-500">{item.sku}</div>
              ) : null}
              {item.location ? (
                <div className="text-[10px] text-gray-400">{item.location}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {selectedItems.size > 0 && Object.keys(qrDataUrls).length === 0 && (
        <div className="no-print bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Nahled ({selectedItems.size} stitku)
          </h3>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
            }}
          >
            {selectedItemsList.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="bg-white/[0.04] border border-white/10 rounded-lg p-3 flex flex-col items-center text-center"
              >
                <div
                  className="bg-white/10 rounded flex items-center justify-center"
                  style={{
                    width: Math.min(LABEL_SIZES[labelSize].qr, 80),
                    height: Math.min(LABEL_SIZES[labelSize].qr, 80),
                  }}
                >
                  <Package className="w-6 h-6 text-slate-500" />
                </div>
                <div className="mt-2 text-xs font-medium text-slate-300 line-clamp-2">
                  {item.name || 'Bez nazvu'}
                </div>
                {item.sku ? (
                  <div className="text-[10px] text-slate-500">{item.sku}</div>
                ) : null}
              </div>
            ))}
            {selectedItemsList.length > 12 && (
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3 flex items-center justify-center text-slate-500 text-sm">
                +{selectedItemsList.length - 12} dalsich
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
