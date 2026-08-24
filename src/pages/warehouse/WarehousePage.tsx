import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Search, CreditCard as Edit2, Trash2, Download, RefreshCw, Loader2, X, ScanLine, Printer, GitMerge } from 'lucide-react';
import SortControl, { sortItems, type SortDir } from '../../components/ui/SortControl';
import { useHeader } from '../../contexts/HeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { downloadCsv } from '../../lib/csvExport';
import Modal from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import QrScanner from '../../components/warehouse/QrScanner';
import QuickMovementModal from '../../components/warehouse/QuickMovementModal';
import DuplicateMergeModal from '../../components/warehouse/DuplicateMergeModal';

interface WarehouseItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  price_per_unit: number;
  category: string;
  location: string;
  is_active: boolean;
  product_id: string | null;
  camera_product_id: string | null;
  eps_product_id: string | null;
  camera_table: string | null;
  eps_table: string | null;
  catalog_source: string;
}

interface Transaction {
  id: string;
  item_id: string;
  project_id: string | null;
  type: string;
  quantity: number;
  note: string;
  created_by: string;
  created_at: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  code: string;
  brand: string;
  price: number;
  category_id: string;
  subcategory_id: string | null;
  kind: string;
  frame_prices: Record<string, number> | null;
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

interface ProjectRef { id: string; project_name: string; }

interface CatalogItem { id: string; name: string; price: number; purchase_price?: number; manufacturer?: string; }

const CAMERA_TABLES = ['camera_models', 'camera_nvrs', 'camera_cables', 'camera_poe_switches', 'camera_accessories'] as const;
const EPS_TABLES = ['eps_detector_models', 'eps_panels', 'eps_sirens', 'eps_cables', 'eps_accessories', 'eps_motion_sensors', 'eps_keypads', 'eps_control_devices'] as const;

const CAMERA_TABLE_LABELS: Record<string, string> = {
  camera_models: 'Kamera', camera_nvrs: 'NVR', camera_cables: 'Kabel',
  camera_poe_switches: 'PoE Switch', camera_accessories: 'Příslušenství',
};
const EPS_TABLE_LABELS: Record<string, string> = {
  eps_detector_models: 'Detektor', eps_panels: 'Ústředna', eps_sirens: 'Siréna',
  eps_cables: 'Kabel', eps_accessories: 'Příslušenství', eps_motion_sensors: 'Pohyb. čidlo',
  eps_keypads: 'Klávesnice', eps_control_devices: 'Ovládací prvek',
};

const SOURCE_FILTERS = [
  { key: '', label: 'Vše' },
  { key: 'manual', label: 'Ruční' },
  { key: 'products', label: 'Katalog' },
  { key: 'camera', label: 'Kamery' },
  { key: 'eps', label: 'EPS/EZS' },
];

const tabs = [
  { key: 'items', label: 'Sklad' },
  { key: 'movements', label: 'Pohyby' },
  { key: 'alerts', label: 'Upozornění' },
];

export default function WarehousePage() {
  const navigate = useNavigate();
  const { setConfig } = useHeader();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('items');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [editItem, setEditItem] = useState<WarehouseItem | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [itemForm, setItemForm] = useState({
    name: '', sku: '', unit: 'ks', quantity: 0, min_quantity: 0,
    price_per_unit: 0, category: '', location: '',
  });
  const [movForm, setMovForm] = useState({
    item_id: '', project_id: '', type: 'in', quantity: 0, note: '',
  });
  const [showScanner, setShowScanner] = useState(false);
  const [scannedQrCode, setScannedQrCode] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [allSyncedProductIds, setAllSyncedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setConfig({
      breadcrumbs: [{ label: 'Sklad' }],
      primaryAction: {
        label: 'Synchronizovat katalog',
        icon: <RefreshCw className="w-4 h-4" />,
        onClick: handleSync,
      },
    });
  }, [setConfig]);

  const handleQrScan = (code: string) => {
    setScannedQrCode(code);
  };

  const handleQuickMovementSuccess = () => {
    toast('Pohyb zaznamenán');
    loadData();
  };

  const handleContinueScanning = () => {
    setScannedQrCode(null);
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
    setScannedQrCode(null);
  };

  const loadData = useCallback(async () => {
    const [itemsRes, transRes, projRes, prodRes, catRes, subRes] = await Promise.all([
      supabase.from('warehouse_items').select('*').eq('is_active', true).order('name').range(0, 4999),
      supabase.from('warehouse_transactions').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('projects').select('id, project_name').neq('status', 'cancelled'),
      supabase.from('products').select('id, name, code, brand, price, category_id, subcategory_id, kind, frame_prices').eq('is_active', true).order('name').range(0, 4999),
      supabase.from('categories').select('id, name, sort_order').order('sort_order'),
      supabase.from('subcategories').select('id, category_id, name, sort_order').order('sort_order'),
    ]);

    const allIds: string[] = [];
    let idFrom = 0;
    while (true) {
      const { data: idPage } = await supabase.from('warehouse_items').select('product_id').not('product_id', 'is', null).range(idFrom, idFrom + 999);
      const rows = idPage || [];
      allIds.push(...rows.map((r: { product_id: string }) => r.product_id));
      if (rows.length < 1000) break;
      idFrom += 1000;
    }

    setItems((itemsRes.data || []) as WarehouseItem[]);
    setTransactions((transRes.data || []) as Transaction[]);
    setProjects((projRes.data || []) as ProjectRef[]);
    setCatalogProducts((prodRes.data || []) as CatalogProduct[]);
    setCategories((catRes.data || []) as Category[]);
    setSubcategories((subRes.data || []) as Subcategory[]);
    setAllSyncedProductIds(new Set(allIds));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const allPages: Record<string, unknown>[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page } = await supabase.from('warehouse_items').select('product_id, camera_product_id, camera_table, eps_product_id, eps_table, name, catalog_source').range(from, from + PAGE - 1);
        const rows = page || [];
        allPages.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      const all = allPages as { product_id: string | null; camera_product_id: string | null; camera_table: string | null; eps_product_id: string | null; eps_table: string | null; name: string; catalog_source: string }[];
      const existingProductIds = new Set(all.filter(i => i.product_id).map(i => i.product_id));
      const existingNames = new Set(all.map(i => i.name));
      const existingCameraKeys = new Set(all.filter(i => i.camera_product_id).map(i => `${i.camera_table}:${i.camera_product_id}`));
      const existingEpsKeys = new Set(all.filter(i => i.eps_product_id).map(i => `${i.eps_table}:${i.eps_product_id}`));

      const { data: allProducts } = await supabase.from('products').select('id, name, code, brand, price, kind, frame_prices').eq('is_active', true);

      const toInsert: Record<string, unknown>[] = [];

      if (allProducts) {
        const dsProducts = allProducts.filter(p => p.kind === 'design_series');
        const regularProducts = allProducts.filter(p => p.kind !== 'design_series' && !existingProductIds.has(p.id));

        let pdmData: { product_id: string; design_module_id: string; price: number }[] = [];
        let dmData: { id: string; name: string; price: number }[] = [];
        if (dsProducts.length > 0) {
          const [pdmRes, dmRes] = await Promise.all([
            supabase.from('product_design_modules').select('product_id, design_module_id, price').in('product_id', dsProducts.map(p => p.id)),
            supabase.from('design_modules').select('id, name, price'),
          ]);
          pdmData = (pdmRes.data || []) as typeof pdmData;
          dmData = (dmRes.data || []) as typeof dmData;
        }
        const dmById = new Map(dmData.map(dm => [dm.id, dm]));

        for (const p of regularProducts) {
          toInsert.push({
            name: p.name, sku: p.code, unit: 'ks', quantity: 0, min_quantity: 0,
            price_per_unit: p.price, category: p.brand || '', location: '', product_id: p.id, catalog_source: 'products',
          });
        }

        for (const p of dsProducts) {
          if (existingProductIds.has(p.id)) continue;
          const brandPrefix = p.brand ? `${p.brand} ` : '';
          const fp = (p.frame_prices as Record<string, number> | null) ?? {};
          for (const [sizeStr, framePrice] of Object.entries(fp)) {
            const frameName = `Ramecek ${sizeStr}R - ${brandPrefix}${p.name}`;
            if (!existingNames.has(frameName)) {
              toInsert.push({
                name: frameName, sku: p.code, unit: 'ks', quantity: 0, min_quantity: 0,
                price_per_unit: framePrice, category: p.brand || '', location: '', product_id: p.id, catalog_source: 'products',
              });
              existingNames.add(frameName);
            }
          }
          const productModules = pdmData.filter(pm => pm.product_id === p.id);
          for (const pm of productModules) {
            const dm = dmById.get(pm.design_module_id);
            if (!dm) continue;
            const moduleName = `${dm.name} - ${brandPrefix}${p.name}`;
            if (!existingNames.has(moduleName)) {
              const price = pm.price || dm.price || 0;
              toInsert.push({
                name: moduleName, sku: '', unit: 'ks', quantity: 0, min_quantity: 0,
                price_per_unit: price, category: p.brand || '', location: '', product_id: p.id, catalog_source: 'products',
              });
              existingNames.add(moduleName);
            }
          }
        }
      }

      const cameraPromises = CAMERA_TABLES.map(t =>
        supabase.from(t).select('id, name, price, purchase_price, manufacturer').eq('is_active', true)
      );
      const cameraResults = await Promise.all(cameraPromises);

      for (let i = 0; i < CAMERA_TABLES.length; i++) {
        const tableName = CAMERA_TABLES[i];
        const rows = (cameraResults[i].data || []) as CatalogItem[];
        for (const row of rows) {
          const key = `${tableName}:${row.id}`;
          if (existingCameraKeys.has(key)) continue;
          existingCameraKeys.add(key);
          const label = CAMERA_TABLE_LABELS[tableName] || tableName;
          toInsert.push({
            name: row.name, sku: '', unit: tableName === 'camera_cables' ? 'm' : 'ks', quantity: 0, min_quantity: 0,
            price_per_unit: row.price ?? 0, category: `${label}${row.manufacturer ? ` · ${row.manufacturer}` : ''}`,
            location: '', camera_product_id: row.id, camera_table: tableName, catalog_source: 'camera',
          });
        }
      }

      const epsPromises = EPS_TABLES.map(t =>
        supabase.from(t).select('id, name, price, purchase_price, manufacturer').eq('is_active', true)
      );
      const epsResults = await Promise.all(epsPromises);

      for (let i = 0; i < EPS_TABLES.length; i++) {
        const tableName = EPS_TABLES[i];
        const rows = (epsResults[i].data || []) as CatalogItem[];
        for (const row of rows) {
          const key = `${tableName}:${row.id}`;
          if (existingEpsKeys.has(key)) continue;
          existingEpsKeys.add(key);
          const label = EPS_TABLE_LABELS[tableName] || tableName;
          toInsert.push({
            name: row.name, sku: '', unit: tableName === 'eps_cables' ? 'm' : 'ks', quantity: 0, min_quantity: 0,
            price_per_unit: row.price ?? 0, category: `${label}${row.manufacturer ? ` · ${row.manufacturer}` : ''}`,
            location: '', eps_product_id: row.id, eps_table: tableName, catalog_source: 'eps',
          });
        }
      }

      if (toInsert.length === 0) {
        toast('Sklad je aktuální, žádné nové položky');
        setSyncing(false);
        return;
      }

      const { error } = await supabase.from('warehouse_items').insert(toInsert);
      if (error) {
        toast('Chyba při synchronizaci', 'error');
      } else {
        toast(`Synchronizováno: ${toInsert.length} nových položek`);
        loadData();
      }
    } catch {
      toast('Chyba při synchronizaci', 'error');
    }
    setSyncing(false);
  };

  const getItemName = (id: string) => items.find(i => i.id === id)?.name || '';
  const getProjectName = (id: string | null) => {
    if (!id) return '';
    return projects.find(p => p.id === id)?.project_name || '';
  };

  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity && i.min_quantity > 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price_per_unit, 0);

  const productById = new Map(catalogProducts.map(p => [p.id, p]));

  const getItemCategoryId = (i: WarehouseItem): string | null => {
    if (i.catalog_source === 'camera') return '__camera__';
    if (i.catalog_source === 'eps') return '__eps__';
    if (i.product_id) {
      const prod = productById.get(i.product_id);
      return prod?.category_id || null;
    }
    return null;
  };

  const getItemSubcategoryId = (i: WarehouseItem): string | null => {
    if (i.catalog_source === 'camera' && i.camera_table) return `cam:${i.camera_table}`;
    if (i.catalog_source === 'eps' && i.eps_table) return `eps:${i.eps_table}`;
    if (i.product_id) {
      const prod = productById.get(i.product_id);
      return prod?.subcategory_id || null;
    }
    return null;
  };

  const categoryCounts = new Map<string, number>();
  for (const i of items) {
    const catId = getItemCategoryId(i);
    if (catId) categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
  }

  const categoryOptions: { id: string; name: string; count: number }[] = [];
  for (const c of categories) {
    const cnt = categoryCounts.get(c.id) || 0;
    if (cnt > 0) categoryOptions.push({ id: c.id, name: c.name, count: cnt });
  }
  const camCount = categoryCounts.get('__camera__') || 0;
  if (camCount > 0) categoryOptions.push({ id: '__camera__', name: 'Kamerový systém', count: camCount });
  const epsCount = categoryCounts.get('__eps__') || 0;
  if (epsCount > 0) categoryOptions.push({ id: '__eps__', name: 'EPS / EZS', count: epsCount });

  const subcategoryOptions: { id: string; name: string; count: number }[] = [];
  if (categoryFilter === '__camera__') {
    const subCounts = new Map<string, number>();
    for (const i of items) {
      if (i.catalog_source === 'camera' && i.camera_table) {
        const key = `cam:${i.camera_table}`;
        subCounts.set(key, (subCounts.get(key) || 0) + 1);
      }
    }
    for (const [table, label] of Object.entries(CAMERA_TABLE_LABELS)) {
      const cnt = subCounts.get(`cam:${table}`) || 0;
      if (cnt > 0) subcategoryOptions.push({ id: `cam:${table}`, name: label, count: cnt });
    }
  } else if (categoryFilter === '__eps__') {
    const subCounts = new Map<string, number>();
    for (const i of items) {
      if (i.catalog_source === 'eps' && i.eps_table) {
        const key = `eps:${i.eps_table}`;
        subCounts.set(key, (subCounts.get(key) || 0) + 1);
      }
    }
    for (const [table, label] of Object.entries(EPS_TABLE_LABELS)) {
      const cnt = subCounts.get(`eps:${table}`) || 0;
      if (cnt > 0) subcategoryOptions.push({ id: `eps:${table}`, name: label, count: cnt });
    }
  } else if (categoryFilter) {
    const relevantSubs = subcategories.filter(s => s.category_id === categoryFilter);
    const subCounts = new Map<string, number>();
    for (const i of items) {
      const subId = getItemSubcategoryId(i);
      if (subId) subCounts.set(subId, (subCounts.get(subId) || 0) + 1);
    }
    for (const s of relevantSubs) {
      const cnt = subCounts.get(s.id) || 0;
      if (cnt > 0) subcategoryOptions.push({ id: s.id, name: s.name, count: cnt });
    }
  }

  const activeFilterCount = [categoryFilter, subcategoryFilter, sourceFilter].filter(Boolean).length;

  const warehouseSortOptions = [
    { key: 'name', label: 'Název' },
    { key: 'quantity', label: 'Množství' },
    { key: 'price_per_unit', label: 'Cena za jednotku' },
    { key: 'category', label: 'Kategorie' },
    { key: 'location', label: 'Umístění' },
    { key: 'sku', label: 'SKU' },
  ];

  const filteredItems = sortItems(
    items.filter(i => {
      if (sourceFilter) {
        if (sourceFilter === 'manual' && (i.catalog_source && i.catalog_source !== '')) return false;
        if (sourceFilter === 'products' && i.catalog_source !== 'products') return false;
        if (sourceFilter === 'camera' && i.catalog_source !== 'camera') return false;
        if (sourceFilter === 'eps' && i.catalog_source !== 'eps') return false;
      }
      if (categoryFilter) {
        const itemCat = getItemCategoryId(i);
        if (itemCat !== categoryFilter) return false;
      }
      if (subcategoryFilter) {
        const itemSub = getItemSubcategoryId(i);
        if (itemSub !== subcategoryFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q);
      }
      return true;
    }),
    sortKey,
    sortDir
  );

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return;
    if (editItem) {
      const { error } = await supabase.from('warehouse_items').update({ ...itemForm, updated_at: new Date().toISOString() }).eq('id', editItem.id);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Položka aktualizována');
    } else {
      const { error } = await supabase.from('warehouse_items').insert(itemForm);
      if (error) { toast('Chyba', 'error'); return; }
      toast('Položka přidána');
    }
    setShowItemModal(false);
    loadData();
  };

  const handleMovement = async () => {
    if (!movForm.item_id || movForm.quantity <= 0) return;
    const { error } = await supabase.from('warehouse_transactions').insert({
      item_id: movForm.item_id,
      project_id: movForm.project_id || null,
      type: movForm.type,
      quantity: movForm.quantity,
      note: movForm.note,
      created_by: user!.id,
    });
    if (error) { toast('Chyba', 'error'); return; }

    const item = items.find(i => i.id === movForm.item_id);
    if (item) {
      const newQty = movForm.type === 'in'
        ? item.quantity + movForm.quantity
        : movForm.type === 'out'
        ? Math.max(0, item.quantity - movForm.quantity)
        : movForm.quantity;
      await supabase.from('warehouse_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', movForm.item_id);
    }

    toast('Pohyb zaznamenán');
    setShowMovModal(false);
    loadData();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Smazat položku?')) return;
    await supabase.from('warehouse_items').update({ is_active: false }).eq('id', id);
    toast('Položka smazána');
    loadData();
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-navy-700/50 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  const linkedProductIds = new Set(items.filter(i => i.product_id).map(i => i.product_id));
  const linkedCount = items.filter(i => i.product_id || i.camera_product_id || i.eps_product_id).length;
  const cameraLinkedCount = items.filter(i => i.camera_product_id).length;
  const epsLinkedCount = items.filter(i => i.eps_product_id).length;
  const unlinkedCatalog = catalogProducts.filter(p => !allSyncedProductIds.has(p.id));

  return (
    <div className="space-y-6">
      <div data-tour="warehouse-stats" className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Package className="w-5 h-5 text-blue-400" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Položek</div>
              <div className="text-lg font-extrabold text-white">{items.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><ArrowDownToLine className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hodnota skladu</div>
              <div className="text-lg font-extrabold text-white">{fmt(totalValue)} Kč</div>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${lowStockItems.length > 0 ? 'bg-amber-500/10 border-amber-200' : 'bg-navy-800/60 border-white/[0.08]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-amber-500/20' : 'bg-white/[0.06]/[0.07]'}`}>
              <AlertTriangle className={`w-5 h-5 ${lowStockItems.length > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nízký stav</div>
              <div className={`text-lg font-extrabold ${lowStockItems.length > 0 ? 'text-white' : 'text-white'}`}>{lowStockItems.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06]/[0.07] flex items-center justify-center"><RefreshCw className="w-5 h-5 text-slate-400" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Napojeno</div>
              <div className="text-lg font-extrabold text-white">{linkedCount}</div>
              {(cameraLinkedCount > 0 || epsLinkedCount > 0) && (
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {linkedProductIds.size > 0 && <span>Kat: {linkedProductIds.size}</span>}
                  {cameraLinkedCount > 0 && <span>{linkedProductIds.size > 0 ? ' · ' : ''}Kam: {cameraLinkedCount}</span>}
                  {epsLinkedCount > 0 && <span>{(linkedProductIds.size > 0 || cameraLinkedCount > 0) ? ' · ' : ''}EPS: {epsLinkedCount}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <div className="text-xs text-slate-300">
          {unlinkedCatalog.length > 0 && (
            <span><span className="font-bold text-blue-400">{unlinkedCatalog.length}</span> produktů z katalogu není ve skladu. </span>
          )}
          <span className="text-slate-400">Synchronizace načte nové položky z katalogu produktů, kamer a EPS/EZS.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={() => setShowDuplicateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl transition"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Duplicity
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Synchronizovat
          </button>
        </div>
      </div>

      <div data-tour="warehouse-main" className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08]">
        <div className="flex items-center">
          <div data-tour="warehouse-tabs" className="flex-1"><Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} /></div>
          <button
            onClick={() => {
              if (activeTab === 'items') {
                downloadCsv(items.map(i => ({
                  Název: i.name, SKU: i.sku, Kategorie: i.category, Umístění: i.location,
                  Množství: i.quantity, Jednotka: i.unit, Cena_za_jednotku: i.price_per_unit,
                  Hodnota: i.quantity * i.price_per_unit,
                })), `sklad_polozky_${new Date().toISOString().slice(0, 10)}`);
              } else if (activeTab === 'movements') {
                downloadCsv(transactions.map(t => ({
                  Položka: getItemName(t.item_id), Typ: t.type, Množství: t.quantity,
                  Projekt: getProjectName(t.project_id), Poznámka: t.note,
                  Datum: new Date(t.created_at).toLocaleDateString('cs-CZ'),
                })), `sklad_pohyby_${new Date().toISOString().slice(0, 10)}`);
              }
            }}
            className="mr-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-white/[0.06]/[0.07] border border-white/10 hover:bg-white/[0.06]/[0.04] rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div data-tour="warehouse-search-bar" className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat..." className="w-full pl-10 pr-3 py-2 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                    sourceFilter ? 'bg-blue-500/10 border-blue-200 text-blue-400 font-semibold' : 'bg-white/[0.06]/[0.06] border-white/10 text-slate-300'
                  }`}
                >
                  {SOURCE_FILTERS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={categoryFilter}
                  onChange={e => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }}
                  className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                    categoryFilter ? 'bg-blue-500/10 border-blue-200 text-blue-400 font-semibold' : 'bg-white/[0.06] border-white/10 text-slate-300'
                  }`}
                >
                  <option value="">Vše kategorie</option>
                  {categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
                  ))}
                </select>
                {subcategoryOptions.length > 0 && (
                  <select
                    value={subcategoryFilter}
                    onChange={e => setSubcategoryFilter(e.target.value)}
                    className={`px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                      subcategoryFilter ? 'bg-blue-500/10 border-blue-200 text-blue-400 font-semibold' : 'bg-white/[0.06] border-white/10 text-slate-300'
                    }`}
                  >
                    <option value="">Vše podkategorie</option>
                    {subcategoryOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.count})</option>
                    ))}
                  </select>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setCategoryFilter(''); setSubcategoryFilter(''); setSourceFilter(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-white/[0.06]/[0.04] rounded-xl transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    Zrušit filtry
                  </button>
                )}
                <SortControl
                  options={warehouseSortOptions}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
                />
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition"
                  >
                    <ScanLine className="w-4 h-4" /> QR Scanner
                  </button>
                  <button
                    onClick={() => navigate('/warehouse/print-qr')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 bg-white/[0.06] border border-white/10 rounded-xl hover:bg-white/[0.04] transition"
                  >
                    <Printer className="w-4 h-4" /> Tisk QR
                  </button>
                  <button onClick={() => { setMovForm({ item_id: '', project_id: '', type: 'in', quantity: 0, note: '' }); setShowMovModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 bg-white/[0.06] border border-white/10 rounded-xl hover:bg-white/[0.04] transition">
                    <ArrowDownToLine className="w-4 h-4" /> Pohyb
                  </button>
                  <button onClick={() => {
                    setEditItem(null);
                    setItemForm({ name: '', sku: '', unit: 'ks', quantity: 0, min_quantity: 0, price_per_unit: 0, category: '', location: '' });
                    setShowItemModal(true);
                  }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition">
                    <Plus className="w-4 h-4" /> Nová položka
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-white/[0.08]">
                      <th className="pb-3 pr-4">Název</th>
                      <th className="pb-3 pr-4">SKU</th>
                      <th className="pb-3 pr-4">Kategorie</th>
                      <th className="pb-3 pr-4">Umístění</th>
                      <th className="pb-3 pr-4 text-right">Množství</th>
                      <th className="pb-3 pr-4 text-right">Cena/j</th>
                      <th className="pb-3 pr-4 text-right">Hodnota</th>
                      <th className="pb-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-white/[0.06]/[0.04] transition">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {item.quantity <= item.min_quantity && item.min_quantity > 0 && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <span className="font-semibold text-white">{item.name}</span>
                            {item.catalog_source === 'products' && (
                              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">Katalog</span>
                            )}
                            {item.catalog_source === 'camera' && (
                              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                {item.camera_table ? (CAMERA_TABLE_LABELS[item.camera_table] || 'Kamera') : 'Kamera'}
                              </span>
                            )}
                            {item.catalog_source === 'eps' && (
                              <span className="text-[9px] font-bold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                                {item.eps_table ? (EPS_TABLE_LABELS[item.eps_table] || 'EPS') : 'EPS'}
                              </span>
                            )}
                            {!item.catalog_source && item.product_id && (
                              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">Katalog</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{item.sku}</td>
                        <td className="py-3 pr-4 text-slate-400">
                          {(() => {
                            if (item.catalog_source === 'products' && item.product_id) {
                              const prod = productById.get(item.product_id);
                              if (prod) {
                                const cat = categories.find(c => c.id === prod.category_id);
                                const sub = prod.subcategory_id ? subcategories.find(s => s.id === prod.subcategory_id) : null;
                                return (
                                  <div className="flex flex-col">
                                    {cat && <span className="text-xs font-medium text-slate-300">{cat.name}</span>}
                                    {sub && <span className="text-[11px] text-slate-500">{sub.name}</span>}
                                  </div>
                                );
                              }
                            }
                            if (item.catalog_source === 'camera' && item.camera_table) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-cyan-300">Kamerový systém</span>
                                  <span className="text-[11px] text-slate-500">{CAMERA_TABLE_LABELS[item.camera_table] || item.camera_table}</span>
                                </div>
                              );
                            }
                            if (item.catalog_source === 'eps' && item.eps_table) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-red-300">EPS / EZS</span>
                                  <span className="text-[11px] text-slate-500">{EPS_TABLE_LABELS[item.eps_table] || item.eps_table}</span>
                                </div>
                              );
                            }
                            return item.category || '-';
                          })()}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{item.location}</td>
                        <td className={`py-3 pr-4 text-right font-bold ${item.quantity <= item.min_quantity && item.min_quantity > 0 ? 'text-amber-500' : 'text-white'}`}>
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-400">{fmt(item.price_per_unit)} Kč</td>
                        <td className="py-3 pr-4 text-right font-semibold text-slate-300">{fmt(item.quantity * item.price_per_unit)} Kč</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => {
                              setEditItem(item);
                              setItemForm({ name: item.name, sku: item.sku, unit: item.unit, quantity: item.quantity, min_quantity: item.min_quantity, price_per_unit: item.price_per_unit, category: item.category, location: item.location });
                              setShowItemModal(true);
                            }} className="p-1.5 rounded-lg hover:bg-white/[0.06]/[0.04] text-slate-500 hover:text-slate-300 transition">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/100/100/10 text-slate-500 hover:text-red-400 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredItems.length === 0 && (
                  <div className="text-center py-12 text-sm text-slate-500">
                    {activeFilterCount > 0 || search ? 'Žádné položky odpovídající filtru' : 'Žádné položky'}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">Žádné pohyby</div>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.06]/[0.04] transition">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'in' ? 'bg-emerald-500/100/10' : t.type === 'out' ? 'bg-red-500/100/10' : 'bg-amber-500/100/10'}`}>
                      {t.type === 'in' ? <ArrowDownToLine className="w-4 h-4 text-emerald-500" /> : <ArrowUpFromLine className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{getItemName(t.item_id)}</div>
                      <div className="text-xs text-slate-500">{t.note}{t.project_id ? ` | ${getProjectName(t.project_id)}` : ''}</div>
                    </div>
                    <div className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {t.type === 'in' ? '+' : '-'}{t.quantity}
                    </div>
                    <div className="text-xs text-slate-500 shrink-0">{new Date(t.created_at).toLocaleDateString('cs-CZ')}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Všechny položky mají dostatečný stav</p>
                </div>
              ) : (
                lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-amber-900">{item.name}</div>
                      <div className="text-xs text-amber-400">Aktuální: {item.quantity} {item.unit} / Minimum: {item.min_quantity} {item.unit}</div>
                    </div>
                    <button onClick={() => { setMovForm({ item_id: item.id, project_id: '', type: 'in', quantity: 0, note: 'Doplnění' }); setShowMovModal(true); }} className="px-3 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/20 border border-amber-300 rounded-lg hover:bg-amber-200 transition">
                      Doplnit
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editItem ? 'Upravit položku' : 'Nová položka'} size="lg" footer={
        <>
          <button onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
          <button onClick={handleSaveItem} disabled={!itemForm.name.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">{editItem ? 'Uložit' : 'Přidat'}</button>
        </>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Název *</label><input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">SKU</label><input value={itemForm.sku} onChange={e => setItemForm({ ...itemForm, sku: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Jednotka</label><input value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Množství</label><input type="number" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Min. množství</label><input type="number" value={itemForm.min_quantity} onChange={e => setItemForm({ ...itemForm, min_quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Cena/j (Kč)</label><input type="number" value={itemForm.price_per_unit} onChange={e => setItemForm({ ...itemForm, price_per_unit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Kategorie</label><input value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Umístění</label><input value={itemForm.location} onChange={e => setItemForm({ ...itemForm, location: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
        </div>
      </Modal>

      <Modal open={showMovModal} onClose={() => setShowMovModal(false)} title="Skladový pohyb" size="md" footer={
        <>
          <button onClick={() => setShowMovModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06]/[0.04] rounded-lg transition">Zrušit</button>
          <button onClick={handleMovement} disabled={!movForm.item_id || movForm.quantity <= 0} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">Zaznamenat</button>
        </>
      }>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Položka *</label>
            <select value={movForm.item_id} onChange={e => setMovForm({ ...movForm, item_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Vyberte...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Typ</label>
              <select value={movForm.type} onChange={e => setMovForm({ ...movForm, type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                <option value="in">Příjem</option>
                <option value="out">Výdej</option>
                <option value="adjustment">Korekce</option>
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Množství</label><input type="number" value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Projekt</label>
            <select value={movForm.project_id} onChange={e => setMovForm({ ...movForm, project_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06]/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Bez projektu</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Poznámka</label><input value={movForm.note} onChange={e => setMovForm({ ...movForm, note: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
        </div>
      </Modal>

      <QrScanner
        isActive={showScanner && !scannedQrCode}
        onScan={handleQrScan}
        onClose={handleCloseScanner}
      />

      <QuickMovementModal
        qrCode={scannedQrCode}
        onClose={handleCloseScanner}
        onSuccess={handleQuickMovementSuccess}
        onContinueScanning={handleContinueScanning}
      />

      <DuplicateMergeModal
        open={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        items={items}
        onRefresh={loadData}
      />
    </div>
  );
}
