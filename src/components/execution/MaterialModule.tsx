import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { Plus, Package, AlertTriangle, Loader2, Trash2, Search, ArrowRight, Zap, Droplets, Flame, Wind, Lightbulb, ClipboardList, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, Eye, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';
import BulkMaterialModal from './BulkMaterialModal';

interface MaterialEntry {
  id: string;
  material_name: string;
  unit: string;
  planned_qty: number;
  actual_qty: number;
  unit_price: number;
  purchase_price: number;
  note: string;
  is_unplanned: boolean;
  created_by: string | null;
  created_at: string;
  product_id: string | null;
  source_quote_id: string | null;
  trade: string | null;
}

interface QuoteItem {
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  productId?: string;
  trade: string;
  sectionName: string;
  quoteId: string;
}

interface ProjectQuote {
  id: string;
  quote_number: string;
  version: number;
  total_selling: number;
  status: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  code: string;
  brand: string;
  price: number;
  purchase_price: number;
}

interface WarehouseItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  product_id: string | null;
}

const TRADE_META: Record<string, { label: string; accent: string; bg: string; Icon: typeof Zap }> = {
  electric: { label: 'Elektro', accent: '#eab308', bg: '#1a1500', Icon: Zap },
  water: { label: 'Voda', accent: '#3b82f6', bg: '#0d1a2d', Icon: Droplets },
  heating: { label: 'Topení', accent: '#ef4444', bg: '#1a0d0d', Icon: Flame },
  recuperation: { label: 'Rekuperace', accent: '#22c55e', bg: '#0d1a10', Icon: Wind },
  lighting: { label: 'Osvětlení', accent: '#f59e0b', bg: '#1a1400', Icon: Lightbulb },
};

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: 'Schváleno', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 },
  presented: { label: 'Předloženo', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Eye },
  returned: { label: 'Vráceno', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: RotateCcw },
  draft: { label: 'Rozpracována', cls: 'text-slate-400 bg-white/[0.06] border-white/[0.08]', Icon: FileText },
};

type AddMode = 'quote' | 'catalog' | 'custom';

interface Props {
  jobId: string;
  quoteIds: string[];
  projectId: string;
  allQuotes: ProjectQuote[];
}

export default function MaterialModule({ jobId, quoteIds, projectId, allQuotes }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [plannedItems, setPlannedItems] = useState<QuoteItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [productPriceMap, setProductPriceMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addMode, setAddMode] = useState<AddMode>('quote');
  const [addName, setAddName] = useState('');
  const [addUnit, setAddUnit] = useState('ks');
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('0');
  const [addNote, setAddNote] = useState('');
  const [addProductId, setAddProductId] = useState<string | null>(null);
  const [addSourceQuoteId, setAddSourceQuoteId] = useState<string | null>(null);
  const [addTrade, setAddTrade] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const includedQuotes = allQuotes.filter(q => quoteIds.includes(q.id));
  const quoteIdsKey = quoteIds.join(',');

  const loadData = useCallback(async () => {
    try {
      const ids = quoteIdsKey.split(',').filter(v => v && v !== 'null' && v !== 'undefined');
      const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [
        supabase.from('job_material_entries').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, code, brand, price, purchase_price').eq('is_active', true).order('name'),
        supabase.from('warehouse_items').select('id, name, unit, quantity, product_id').eq('is_active', true),
      ];
      if (ids.length > 0) {
        queries.push(supabase.from('project_quotes').select('id, sections_data').in('id', ids));
      }

      const results = await Promise.all(queries);
      setEntries((results[0].data || []) as MaterialEntry[]);
      const products = (results[1].data || []) as CatalogProduct[];
      setCatalogProducts(products);
      setWarehouseItems((results[2].data || []) as WarehouseItem[]);

      const priceMap = new Map<string, number>();
      for (const p of products) {
        priceMap.set(p.id, p.purchase_price || 0);
      }
      setProductPriceMap(priceMap);

      const quotesRes = ids.length > 0 ? results[3] : { data: [], error: null };
      const quoteRows = (quotesRes.data || []) as any[];
      if (quotesRes?.error) {
        console.error('Failed to load quote sections:', quotesRes.error);
      }
      const items: QuoteItem[] = [];
      for (const quote of quoteRows) {
        const quoteId = (quote as any)?.id;
        const raw = (quote as any)?.sections_data;
        if (!raw) continue;
        const sections = Array.isArray(raw) ? raw : (Array.isArray(raw?.sections) ? raw.sections : []);
        for (const sec of sections) {
          if (!sec || !Array.isArray(sec.items)) continue;
          const sectionTrade = sec.trade || 'electric';
          const sectionName = sec.name || TRADE_META[sectionTrade]?.label || sectionTrade;
          for (const item of sec.items) {
            if (!item?.name) continue;
            items.push({
              name: item.name, unit: item.unit || 'ks', quantity: item.quantity || 0,
              sellingPrice: item.sellingPrice || 0, productId: item.productId,
              trade: sectionTrade, sectionName, quoteId,
            });
          }
        }
      }
      setPlannedItems(items);
    } catch (err) {
      console.error('MaterialModule loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId, quoteIdsKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const isUnplanned = (name: string) => !plannedItems.find(p => p.name === name);

  const findWarehouseItem = (productId: string | null, materialName: string): WarehouseItem | undefined => {
    const byExactName = warehouseItems.find(w => w.name.toLowerCase() === materialName.toLowerCase());
    if (byExactName) return byExactName;
    if (productId) {
      const byProductExact = warehouseItems.filter(w => w.product_id === productId);
      if (byProductExact.length === 1) return byProductExact[0];
    }
    return warehouseItems.find(w => materialName.toLowerCase().includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(materialName.toLowerCase()));
  };

  const deductFromWarehouse = async (materialName: string, productId: string | null, qty: number, note: string) => {
    if (!user) return;
    const whItem = findWarehouseItem(productId, materialName);
    if (!whItem) return;
    await supabase.from('warehouse_transactions').insert({
      item_id: whItem.id, project_id: projectId, type: 'out',
      quantity: qty, note: note || `Spotreba: ${materialName}`, created_by: user.id,
    });
    await supabase.from('warehouse_items').update({
      quantity: Math.max(0, whItem.quantity - qty), updated_at: new Date().toISOString(),
    }).eq('id', whItem.id);
  };

  const returnToWarehouse = async (entry: MaterialEntry) => {
    if (!user) return;
    const whItem = findWarehouseItem(entry.product_id, entry.material_name);
    if (!whItem) return;
    await supabase.from('warehouse_transactions').insert({
      item_id: whItem.id, project_id: projectId, type: 'in',
      quantity: entry.actual_qty, note: `Storno spotreby: ${entry.material_name}`, created_by: user.id,
    });
    const current = warehouseItems.find(w => w.id === whItem.id);
    const currentQty = current?.quantity ?? whItem.quantity;
    await supabase.from('warehouse_items').update({
      quantity: currentQty + entry.actual_qty, updated_at: new Date().toISOString(),
    }).eq('id', whItem.id);
  };

  const createViceprace = async (name: string, qty: number, unitPrice: number, unit: string) => {
    if (!user) return;
    const amount = qty * unitPrice;
    const { data: vp } = await supabase.from('viceprace').insert({
      project_id: projectId, title: `Vícepráce: ${name}`,
      description: `Automaticky vytvořeno ze spotřeby materialu mimo plán`,
      status: 'pending', requested_by: '', amount, created_by: user.id,
    }).select('id').maybeSingle();
    if (vp) {
      await supabase.from('viceprace_items').insert({
        viceprace_id: vp.id, name, unit, quantity: qty, unit_price: unitPrice, sort_order: 0,
      });
    }
  };

  const getPurchasePrice = (productId: string | null, sellingPrice: number): number => {
    if (productId) {
      const pp = productPriceMap.get(productId);
      if (pp && pp > 0) return pp;
    }
    return sellingPrice * 0.7;
  };

  const handleAdd = async () => {
    if (!user || !addName.trim()) return;
    setSaving(true);
    const qty = parseFloat(addQty) || 0;
    const planned = plannedItems.find(p => p.name === addName);
    const unitPrice = planned?.sellingPrice || (parseFloat(addPrice) || 0);
    const unplanned = isUnplanned(addName);
    const productId = addProductId || planned?.productId || null;
    const purchasePrice = getPurchasePrice(productId, unitPrice);
    const autoQuoteId = includedQuotes.length === 1 ? includedQuotes[0].id : null;
    const sourceQuoteId = addSourceQuoteId || planned?.quoteId || autoQuoteId || null;
    const trade = addTrade || planned?.trade || null;

    const { error } = await supabase.from('job_material_entries').insert({
      job_id: jobId, product_id: productId, material_name: addName,
      unit: addUnit, planned_qty: planned?.quantity || 0, actual_qty: qty,
      unit_price: unitPrice, purchase_price: purchasePrice,
      note: addNote, is_unplanned: unplanned, created_by: user.id,
      source_quote_id: sourceQuoteId, trade,
    });

    if (error) {
      console.error('Material insert error:', error);
      toast('Chyba při ukládání: ' + (error.message || 'neznámá chyba'), 'error');
    } else {
      await deductFromWarehouse(addName, productId, qty, addNote);
      if (unplanned) {
        await createViceprace(addName, qty, unitPrice, addUnit);
        toast('Spotřeba uložena + odepsáno ze skladu + vícepráce');
      } else {
        toast('Spotřeba uložena + odepsáno ze skladu');
      }
      await logAudit('job_material', jobId, 'consumption_added', { name: addName, qty, unplanned });
      resetForm();
      loadData();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setShowAddModal(false);
    setAddMode('quote');
    setAddName('');
    setAddUnit('ks');
    setAddQty('1');
    setAddPrice('0');
    setAddNote('');
    setAddProductId(null);
    setAddSourceQuoteId(null);
    setAddTrade('');
    setCatalogSearch('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat záznam?')) return;
    const entry = entries.find(e => e.id === id);
    await supabase.from('job_material_entries').delete().eq('id', id);
    if (entry) await returnToWarehouse(entry);
    toast('Smazáno + vráceno na sklad');
    loadData();
  };

  const handleBulkSave = async (rows: { name: string; unit: string; plannedQty: number; actualQty: number; unitPrice: number; productId: string | null; note: string; sourceQuoteId?: string | null; trade?: string | null }[]) => {
    if (!user || rows.length === 0) return;
    setBulkSaving(true);
    const inserts = rows.map(r => ({
      job_id: jobId, product_id: r.productId, material_name: r.name,
      unit: r.unit, planned_qty: r.plannedQty, actual_qty: r.actualQty,
      unit_price: r.unitPrice, purchase_price: getPurchasePrice(r.productId, r.unitPrice),
      note: r.note, is_unplanned: false, created_by: user.id,
      source_quote_id: r.sourceQuoteId || null, trade: r.trade || null,
    }));
    const { error } = await supabase.from('job_material_entries').insert(inserts);
    if (error) {
      console.error('Bulk material insert error:', error);
      toast('Chyba při ukládání: ' + (error.message || ''), 'error');
    } else {
      for (const r of rows) await deductFromWarehouse(r.name, r.productId, r.actualQty, r.note);
      toast(`Uloženo ${rows.length} položek + odepsáno ze skladu`);
      await logAudit('job_material', jobId, 'bulk_consumption_added', { count: rows.length });
      loadData();
    }
    setBulkSaving(false);
  };

  const selectCatalogProduct = (p: CatalogProduct) => {
    setAddName(p.name);
    setAddPrice(String(p.price));
    setAddUnit('ks');
    setAddProductId(p.id);
    setAddMode('catalog');
  };

  const fmtQty = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  const fmtPrice = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  type AggItem = {
    planned: number;
    actual: number;
    unit: string;
    price: number;
    purchasePrice: number;
    isUnplanned: boolean;
    trade: string;
    sectionName: string;
    quoteId: string | null;
  };

  const { quoteGroupedData, overallCosts, overallProgress } = useMemo(() => {
    const quoteMap = new Map<string | null, Map<string, AggItem>>();

    for (const p of plannedItems) {
      const productPP = p.productId ? (productPriceMap.get(p.productId) || 0) : 0;
      const purchasePrice = productPP > 0 ? productPP : p.sellingPrice * 0.7;
      const qId = p.quoteId || null;
      if (!quoteMap.has(qId)) quoteMap.set(qId, new Map());
      const items = quoteMap.get(qId)!;
      const existing = items.get(p.name);
      if (existing) {
        existing.planned += p.quantity;
      } else {
        items.set(p.name, {
          planned: p.quantity, actual: 0, unit: p.unit,
          price: p.sellingPrice, purchasePrice, isUnplanned: false,
          trade: p.trade, sectionName: p.sectionName, quoteId: qId,
        });
      }
    }

    for (const e of entries) {
      const entryPP = e.purchase_price > 0 ? e.purchase_price : (e.product_id ? (productPriceMap.get(e.product_id) || e.unit_price * 0.7) : e.unit_price * 0.7);
      const qId = e.source_quote_id || null;

      let matched = false;
      for (const [, items] of quoteMap) {
        const existing = items.get(e.material_name);
        if (existing) {
          existing.actual += e.actual_qty;
          if (entryPP > 0 && existing.purchasePrice === 0) existing.purchasePrice = entryPP;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (!quoteMap.has(qId)) quoteMap.set(qId, new Map());
        const items = quoteMap.get(qId)!;
        const existing = items.get(e.material_name);
        if (existing) {
          existing.actual += e.actual_qty;
        } else {
          items.set(e.material_name, {
            planned: 0, actual: e.actual_qty, unit: e.unit,
            price: e.unit_price, purchasePrice: entryPP, isUnplanned: true,
            trade: e.trade || 'other', sectionName: 'Vícepráce', quoteId: qId,
          });
        }
      }
    }

    let grandExpected = 0;
    let grandActual = 0;
    let grandPlanned = 0;
    let grandWithActual = 0;

    const quoteGrouped: { quoteId: string | null; quote: ProjectQuote | null; items: Map<string, AggItem>; expected: number; actual: number; sectionGroups: { sectionName: string; trade: string; items: [string, AggItem][] }[] }[] = [];

    const sortedQuoteIds = [...quoteMap.keys()].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return 0;
    });

    for (const qId of sortedQuoteIds) {
      const items = quoteMap.get(qId)!;
      const quote = qId ? allQuotes.find(q => q.id === qId) || null : null;
      let expected = 0;
      let actual = 0;

      const sectionMap = new Map<string, { sectionName: string; trade: string; items: [string, AggItem][] }>();
      for (const [name, data] of items) {
        const eCost = data.planned * data.purchasePrice;
        const aCost = data.actual * data.purchasePrice;
        expected += eCost;
        actual += aCost;
        grandExpected += eCost;
        grandActual += aCost;
        if (data.planned > 0) {
          grandPlanned++;
          if (data.actual > 0) grandWithActual++;
        }
        const secKey = data.sectionName;
        if (!sectionMap.has(secKey)) {
          sectionMap.set(secKey, { sectionName: data.sectionName, trade: data.trade, items: [] });
        }
        sectionMap.get(secKey)!.items.push([name, data]);
      }

      const sectionGroups = [...sectionMap.values()];

      quoteGrouped.push({ quoteId: qId, quote, items, expected, actual, sectionGroups });
    }

    const progress = grandPlanned > 0 ? Math.round((grandWithActual / grandPlanned) * 100) : 0;

    return {
      quoteGroupedData: quoteGrouped,
      overallCosts: { expected: grandExpected, actual: grandActual },
      overallProgress: progress,
    };
  }, [plannedItems, entries, productPriceMap, allQuotes]);

  if (loading) return <div className="h-32 bg-navy-900/50 rounded-xl animate-pulse" />;

  const filteredCatalog = catalogProducts.filter(p => {
    if (!catalogSearch) return true;
    const q = catalogSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  });

  const nameIsUnplanned = addName.trim() ? isUnplanned(addName) : false;

  const quoteItemsBySection = new Map<string, QuoteItem[]>();
  const activeQuotePlanned = addSourceQuoteId
    ? plannedItems.filter(p => p.quoteId === addSourceQuoteId)
    : plannedItems;
  for (const item of activeQuotePlanned) {
    const key = item.sectionName;
    if (!quoteItemsBySection.has(key)) quoteItemsBySection.set(key, []);
    quoteItemsBySection.get(key)!.push(item);
  }

  const costDiff = overallCosts.actual - overallCosts.expected;
  const costDiffPct = overallCosts.expected > 0
    ? Math.round((overallCosts.actual / overallCosts.expected) * 100)
    : 0;

  const hasAnyData = quoteGroupedData.some(g => g.items.size > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Materiál - plán vs. skutečnost
        </h3>
        <div className="flex items-center gap-2">
          {plannedItems.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-emerald-700 transition"
            >
              <ClipboardList className="w-4 h-4" /> Hromadný výkaz
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" /> Přidat spotřebu
          </button>
        </div>
      </div>

      {(overallCosts.expected > 0 || overallCosts.actual > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Předpokládaňé náklady</span>
            </div>
            <p className="text-xl font-extrabold text-white tabular-nums">
              {fmtPrice(overallCosts.expected)} Kc
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Skutečné náklady</span>
            </div>
            <p className="text-xl font-extrabold text-white tabular-nums">
              {fmtPrice(overallCosts.actual)} Kc
            </p>
          </div>

          <div className={`rounded-2xl border p-4 ${
            costDiff > 0 ? 'border-red-500/20 bg-red-500/10'
              : costDiff < 0 ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-white/[0.08] bg-navy-800/60 backdrop-blur-sm'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {costDiff > 0 ? <ArrowUpRight className="w-4 h-4 text-red-400" /> : costDiff < 0 ? <ArrowDownRight className="w-4 h-4 text-emerald-400" /> : <DollarSign className="w-4 h-4 text-slate-400" />}
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Odchylka</span>
            </div>
            <p className={`text-xl font-extrabold tabular-nums ${costDiff > 0 ? 'text-red-400' : costDiff < 0 ? 'text-emerald-400' : 'text-white'}`}>
              {costDiff > 0 ? '+' : ''}{fmtPrice(costDiff)} Kc
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {costDiffPct > 0 ? `${costDiffPct}% plánu` : 'Zatím bez dat'}
            </p>
          </div>
        </div>
      )}

      {hasAnyData && (
        <div className="rounded-2xl border border-white/[0.08] bg-navy-800/60 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Celková spotřeba</span>
            </div>
            <span className="text-sm font-extrabold text-white">{overallProgress}% plánu</span>
          </div>
          <div className="h-3 bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                overallProgress > 120 ? 'bg-red-500' : overallProgress > 100 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {quoteGroupedData.map((group) => {
        const { quoteId, quote, sectionGroups, expected, actual } = group;
        const groupDiff = actual - expected;
        const badgeMeta = quote ? (STATUS_BADGE[quote.status] || STATUS_BADGE.draft) : null;
        const BadgeIcon = badgeMeta?.Icon || FileText;

        return (
          <div key={quoteId || '__unassigned'} className="rounded-2xl border border-white/[0.08] overflow-hidden bg-navy-800/60 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  {quote ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                        <FileText className="w-3 h-3 text-sky-400" />
                        <span className="text-xs font-extrabold text-sky-300">{quote.quote_number}</span>
                      </span>
                      <span className="text-xs text-slate-500">v{quote.version}</span>
                      {badgeMeta && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${badgeMeta.cls}`}>
                          <BadgeIcon className="w-2.5 h-2.5" /> {badgeMeta.label}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Package className="w-3.5 h-3.5" /> Nepřiřazený materiál
                    </span>
                  )}
                </div>
                {(expected > 0 || actual > 0) && (
                  <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
                    <span className="text-slate-400">{fmtPrice(expected)} Kc plán</span>
                    <span className="text-slate-300">{fmtPrice(actual)} Kc skut.</span>
                    {groupDiff !== 0 && (
                      <span className={groupDiff > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {groupDiff > 0 ? '+' : ''}{fmtPrice(groupDiff)} Kc
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.04] border-b border-white/[0.08] text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left font-semibold">Položka</th>
                  <th className="px-4 py-2 text-right font-semibold w-20">Plán</th>
                  <th className="px-4 py-2 text-right font-semibold w-20">Skutečnost</th>
                  <th className="px-4 py-2 text-center font-semibold w-28">Postup</th>
                  <th className="px-4 py-2 text-right font-semibold w-24">Nákl. plán</th>
                  <th className="px-4 py-2 text-right font-semibold w-24">Nákl. skut.</th>
                  <th className="px-4 py-2 text-right font-semibold w-20">Odch.</th>
                </tr>
              </thead>
              <tbody>
                {sectionGroups.map((section) => {
                  const meta = TRADE_META[section.trade];
                  const TradeIcon = meta?.Icon || Package;
                  return (
                    <Fragment key={section.sectionName}>
                      <tr>
                        <td colSpan={7} className="px-4 py-2" style={{ background: meta?.bg || '#0f1520', borderLeft: `3px solid ${meta?.accent || '#94a3b8'}` }}>
                          <div className="flex items-center gap-2">
                            <TradeIcon className="w-3.5 h-3.5" style={{ color: meta?.accent || '#94a3b8' }} />
                            <span className="text-xs font-extrabold" style={{ color: meta?.accent || '#94a3b8' }}>
                              {section.sectionName}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">{section.items.length} pol.</span>
                          </div>
                        </td>
                      </tr>
                      {section.items.map(([name, data]) => {
                        const pct = data.planned > 0 ? Math.round((data.actual / data.planned) * 100) : (data.actual > 0 ? 999 : 0);
                        const barColor = pct > 120 ? 'bg-red-500' : pct > 100 ? 'bg-amber-500' : 'bg-emerald-500';
                        const expectedCost = data.planned * data.purchasePrice;
                        const actualCost = data.actual * data.purchasePrice;
                        const costDelta = actualCost - expectedCost;
                        return (
                          <tr key={name} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition">
                            <td className="px-4 py-2 pl-8">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-300">{name}</span>
                                {data.isUnplanned && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Vícepráce
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-400 tabular-nums">
                              {data.planned > 0 ? `${fmtQty(data.planned)} ${data.unit}` : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-300 tabular-nums">
                              {data.actual > 0 ? `${fmtQty(data.actual)} ${data.unit}` : '-'}
                            </td>
                            <td className="px-4 py-2">
                              {data.planned > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className={`text-[10px] font-bold tabular-nums w-8 text-right ${pct > 120 ? 'text-red-400' : pct > 100 ? 'text-amber-400' : 'text-slate-400'}`}>{pct}%</span>
                                </div>
                              ) : <span className="text-[10px] text-slate-400">-</span>}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{expectedCost > 0 ? `${fmtPrice(expectedCost)} Kc` : '-'}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-300 tabular-nums">{actualCost > 0 ? `${fmtPrice(actualCost)} Kc` : '-'}</td>
                            <td className={`px-4 py-2 text-right font-extrabold tabular-nums ${costDelta > 0 ? 'text-red-400' : costDelta < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {costDelta !== 0 ? `${costDelta > 0 ? '+' : ''}${fmtPrice(costDelta)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {group.items.size === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <Package className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">Žádný materiál</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {!hasAnyData && (
        <div className="rounded-2xl border-2 border-dashed border-white/[0.08] py-12 text-center">
          <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Žádný plánovaný materiál</p>
          <p className="text-xs text-slate-500 mt-1">Přidejte spotřebu ručně nebo napojte nabídku na zakázku</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Poslední záznamy</h4>
          {entries.slice(0, 10).map((e) => {
            const entryCost = e.actual_qty * (e.purchase_price > 0 ? e.purchase_price : e.unit_price * 0.7);
            const srcQuote = e.source_quote_id ? allQuotes.find(q => q.id === e.source_quote_id) : null;
            return (
              <div key={e.id} className="rounded-xl border border-white/[0.06] bg-navy-800/60 backdrop-blur-sm p-2.5 flex items-center gap-3 text-xs hover:bg-white/[0.04] transition">
                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-300">{e.material_name}</span>
                  <span className="text-slate-400 ml-2">{e.actual_qty} {e.unit}</span>
                  {e.is_unplanned && (
                    <span className="ml-2 text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                      Vícepráce
                    </span>
                  )}
                  {srcQuote && (
                    <span className="ml-2 text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full border border-sky-500/20">
                      {srcQuote.quote_number}
                    </span>
                  )}
                  {e.note && <span className="text-slate-400 ml-2">&middot; {e.note}</span>}
                </div>
                <span className="text-[10px] font-bold text-slate-300 shrink-0 tabular-nums">
                  {fmtPrice(entryCost)} Kc
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(e.created_at).toLocaleDateString('cs-CZ')}
                </span>
                {e.created_by === user?.id && (
                  <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showAddModal} onClose={resetForm} title="Přidat spotřebu" size="md"
        footer={
          <>
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.07] rounded-lg transition">Zrušit</button>
            <button onClick={handleAdd} disabled={saving || !addName.trim()} className="px-5 py-2 text-sm font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {includedQuotes.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Zdrojová nabídka</label>
              <select
                value={addSourceQuoteId || ''}
                onChange={(e) => {
                  setAddSourceQuoteId(e.target.value || null);
                  if (addMode === 'quote') setAddName('');
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">{addMode === 'quote' ? 'Všechny nabídky' : '-- Vyberte nabídku --'}</option>
                {includedQuotes.map(q => (
                  <option key={q.id} value={q.id}>{q.quote_number} v{q.version}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
            {([
              { key: 'quote', label: 'Z nabídky' },
              { key: 'catalog', label: 'Z katalogu' },
              { key: 'custom', label: 'Vlastní' },
            ] as { key: AddMode; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setAddMode(tab.key); setAddName(''); setAddPrice('0'); setCatalogSearch(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold transition ${
                  addMode === tab.key ? 'bg-white/[0.10] text-white ' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {addMode === 'quote' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Položka z nabídky</label>
              <select
                value={addName}
                onChange={(e) => {
                  setAddName(e.target.value);
                  const pi = activeQuotePlanned.find(p => p.name === e.target.value);
                  if (pi) {
                    setAddUnit(pi.unit);
                    setAddPrice(String(pi.sellingPrice));
                    setAddProductId(pi.productId || null);
                    setAddSourceQuoteId(pi.quoteId || null);
                    setAddTrade(pi.trade);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">-- Vyberte --</option>
                {[...quoteItemsBySection.entries()].map(([sectionName, sectionItems]) => (
                  <optgroup key={sectionName} label={sectionName}>
                    {sectionItems.map((p, i) => (
                      <option key={`${sectionName}-${i}`} value={p.name}>{p.name} ({p.quantity} {p.unit})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {addMode === 'catalog' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Vybrat z katalogu</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Hledat produkt..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder:text-slate-500"
                />
              </div>
              {addName && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sm font-semibold text-sky-300 flex items-center gap-2">
                  <Package className="w-4 h-4" /> {addName}
                </div>
              )}
              <div className="max-h-40 overflow-y-auto border border-white/[0.08] rounded-xl divide-y divide-white/[0.06]">
                {filteredCatalog.slice(0, 30).map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectCatalogProduct(p)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] transition flex items-center gap-2 ${addName === p.name ? 'bg-sky-500/10' : ''}`}
                  >
                    <span className="flex-1 font-medium text-slate-300 truncate">{p.name}</span>
                    <span className="text-slate-500 shrink-0">{p.brand}</span>
                    <span className="font-bold text-slate-300 shrink-0">{Math.round(p.price).toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
                {filteredCatalog.length === 0 && (
                  <div className="px-3 py-4 text-xs text-slate-500 text-center">Nic nenalezeno</div>
                )}
              </div>
            </div>
          )}

          {addMode === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Název položky *</label>
              <input
                autoFocus
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Zadejte název..."
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder:text-slate-500"
              />
            </div>
          )}

          {nameIsUnplanned && addName.trim() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300">Položka není ve schválené nabídce</span>
                <span className="text-amber-400 ml-1">- bude automaticky zaznamenána jako vícepráce</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Množství</label>
              <input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} min="0" step="0.1" className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Jednotka</label>
              <input value={addUnit} onChange={(e) => setAddUnit(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
            </div>
            {(addMode === 'custom' || (addMode === 'catalog' && nameIsUnplanned)) && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cena/j</label>
                <input type="number" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} min="0" className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka</label>
            <input value={addNote} onChange={(e) => setAddNote(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder:text-slate-500" />
          </div>
        </div>
      </Modal>

      <BulkMaterialModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        plannedItems={plannedItems}
        saving={bulkSaving}
        onSave={handleBulkSave}
        allQuotes={includedQuotes}
      />
    </div>
  );
}
