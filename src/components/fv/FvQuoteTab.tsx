import { useState, useMemo } from 'react';
import { Sun, Zap, Battery, Car, Package, Wrench, Percent, FileDown, ChevronDown, ChevronUp, Image, List, Calculator, Plus, Trash2, HardHat, PenLine, CreditCard as Edit2, AlertTriangle } from 'lucide-react';
import type { FvCatalogData } from '../../hooks/useFvCatalog';
import type { FvSystemConfig } from '../../hooks/useFvDesign';
import type { FvCalculationResult, RoofSurface } from '../../lib/fvCalculations';
import type { QuoteSection, QuoteAttachment, QuoteSystemSummary, QuoteItem } from '../catalog/quoteHelpers';
import type { SubsidyProgram } from '../../hooks/useSubsidyPrograms';
import { computeSubsidy } from '../../hooks/useSubsidyPrograms';
import {
  buildFvQuoteLineItems,
  calcAutoLaborCostAndPrice,
  calcConstructionBreakdown,
  type FvQuoteLineItem,
} from '../../lib/fvQuoteLineItems';
import SaveQuoteModal from '../catalog/SaveQuoteModal';
import { useToast } from '../ui/Toast';

interface Props {
  catalog: FvCatalogData;
  config: FvSystemConfig;
  roofs: RoofSurface[];
  result: FvCalculationResult | null;
  roofSnapshots?: Record<string, string>;
  subsidyPrograms: SubsidyProgram[];
  onConfigChange: (config: FvSystemConfig) => void;
  onExportToQuote?: (sections: QuoteSection[]) => void;
  projectId?: string;
  resultsStale?: boolean;
}

const CAT_LABELS: Record<string, string> = {
  panels: 'Panely', inverter: 'Střídač', battery: 'Baterie',
  wallbox: 'Wallbox', accessories: 'Příslušenství',
  construction: 'Montážní konstrukce', labor: 'Montážní práce', custom: 'Vlastní položky',
};

const CAT_ICONS: Record<string, typeof Sun> = {
  panels: Sun, inverter: Zap, battery: Battery,
  wallbox: Car, accessories: Package,
  construction: Wrench, labor: HardHat, custom: PenLine,
};

type QuoteLineItem = FvQuoteLineItem;

interface DisplayLineItem extends QuoteLineItem {
  categoryIcon: typeof Sun;
}

function useQuoteLines(catalog: FvCatalogData, config: FvSystemConfig, roofs: RoofSurface[]): DisplayLineItem[] {
  return useMemo(() => {
    const baseItems = buildFvQuoteLineItems(catalog, config, roofs);
    return baseItems.map(item => ({
      ...item,
      categoryIcon: CAT_ICONS[item.category] ?? Package,
    }));
  }, [catalog, config, roofs]);
}

function useQuoteCategories(lines: DisplayLineItem[]) {
  return useMemo(() => {
    const map = new Map<string, { icon: typeof Sun; label: string; items: DisplayLineItem[] }>();
    for (const line of lines) {
      if (!map.has(line.category)) {
        map.set(line.category, { icon: line.categoryIcon, label: CAT_LABELS[line.category] ?? line.category, items: [] });
      }
      map.get(line.category)!.items.push(line);
    }
    return Array.from(map.entries());
  }, [lines]);
}

export default function FvQuoteTab({ catalog, config, roofs, result, roofSnapshots, subsidyPrograms, onConfigChange, onExportToQuote, projectId, resultsStale }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [editingLabor, setEditingLabor] = useState(false);
  const [editingConstruction, setEditingConstruction] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const { toast } = useToast();

  const quoteMode = config.quoteMode ?? 'itemized';
  const itemDiscounts = config.itemDiscounts ?? {};
  const globalDiscountPct = config.globalDiscountPct ?? 0;
  const customItems = config.customItems ?? [];

  const lines = useQuoteLines(catalog, config, roofs);
  const categories = useQuoteCategories(lines);

  const autoLaborCalc = calcAutoLaborCostAndPrice(catalog, config, roofs);
  const effectiveLabor = config.laborOverride !== undefined && config.laborOverride !== null
    ? config.laborOverride
    : (config.laborCost && config.laborCost > 0 ? config.laborCost : autoLaborCalc.price);

  const constructionBreakdown = calcConstructionBreakdown(roofs, catalog);
  const effectiveConstruction = config.constructionPriceOverride !== undefined && config.constructionPriceOverride !== null
    ? config.constructionPriceOverride
    : constructionBreakdown.totalPrice;

  const setMode = (mode: 'itemized' | 'total') => {
    onConfigChange({ ...config, quoteMode: mode });
  };

  const getItemDiscount = (key: string): number => itemDiscounts[key] ?? 0;

  const setItemDiscount = (key: string, pct: number) => {
    const next = { ...itemDiscounts, [key]: Math.max(0, Math.min(100, pct)) };
    if (pct === 0) delete next[key];
    onConfigChange({ ...config, itemDiscounts: next });
  };

  const setGlobalDiscount = (pct: number) => {
    onConfigChange({ ...config, globalDiscountPct: Math.max(0, Math.min(100, pct)) });
  };

  const computeDiscountedPrice = (item: QuoteLineItem): number => {
    const itemDisc = getItemDiscount(item.key);
    const afterItemDisc = item.totalPrice * (1 - itemDisc / 100);
    return afterItemDisc * (1 - globalDiscountPct / 100);
  };

  const addCustomItem = () => {
    const next = [...customItems, { id: crypto.randomUUID(), name: '', qty: 1, unit: 'ks', unitPrice: 0 }];
    onConfigChange({ ...config, customItems: next });
  };

  const updateCustomItem = (id: string, patch: Partial<typeof customItems[0]>) => {
    const next = customItems.map(ci => ci.id === id ? { ...ci, ...patch } : ci);
    onConfigChange({ ...config, customItems: next });
  };

  const removeCustomItem = (id: string) => {
    onConfigChange({ ...config, customItems: customItems.filter(ci => ci.id !== id) });
  };

  const totalBeforeDiscount = lines.reduce((s, l) => s + l.totalPrice, 0);
  const totalAfterDiscount = lines.reduce((s, l) => s + computeDiscountedPrice(l), 0);
  const totalCost = lines.reduce((s, l) => s + l.unitCost * l.qty, 0);

  const selectedProgram = subsidyPrograms.find(p => p.id === config.subsidyProgramId);
  const subsidyCzk = selectedProgram ? computeSubsidy(selectedProgram, totalAfterDiscount) : (config.subsidyCzk ?? 0);

  const finalPrice = Math.max(0, totalAfterDiscount - subsidyCzk);
  const totalProfit = totalAfterDiscount - totalCost;
  const profitMarginPct = totalAfterDiscount > 0 ? Math.round((totalProfit / totalAfterDiscount) * 100) : 0;

  const annualBenefit = result?.totalAnnualBenefitCzk ?? 0;
  const paybackYears = finalPrice > 0 && annualBenefit > 0 ? Math.round((finalPrice / annualBenefit) * 10) / 10 : null;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat); else n.add(cat);
      return n;
    });
  };

  const roofPreviews = roofs.filter(r => r.panelCount > 0 && (roofSnapshots?.[r.id] || r.snapshotDataUrl));

  const buildExportSections = (): QuoteSection[] => {
    const items: QuoteItem[] = [];

    for (const line of lines) {
      const disc = getItemDiscount(line.key);
      const discPrice = line.unitPrice * (1 - disc / 100) * (1 - globalDiscountPct / 100);

      items.push({
        id: crypto.randomUUID(), code: '', name: line.name, unit: line.unit,
        quantity: line.qty, sellingPrice: Math.round(discPrice * 100) / 100, costPrice: line.unitCost,
      });
    }

    if (subsidyCzk > 0) {
      items.push({
        id: crypto.randomUUID(), code: '', name: 'Dotace (odpočet)', unit: 'pausal',
        quantity: 1, sellingPrice: -subsidyCzk, costPrice: 0,
      });
    }

    return [{
      id: crypto.randomUUID(), name: 'Fotovoltaika', trade: 'fotovoltaika', icon: 'sun', items,
    }];
  };

  const handleExport = () => {
    if (!onExportToQuote) return;
    onExportToQuote(buildExportSections());
  };

  const buildRoofAttachments = (): QuoteAttachment[] => {
    const att: QuoteAttachment[] = [];
    for (const roof of roofs) {
      const snap = roofSnapshots?.[roof.id] || roof.snapshotDataUrl;
      if (!snap) continue;
      att.push({
        id: crypto.randomUUID(),
        type: 'roof_snapshot',
        label: roof.name || 'Střecha',
        imageData: snap,
        annotation: `${roof.panelCount} panelů, ${roof.azimuthDeg ?? 0}\u00B0 azimut, ${roof.tiltDeg ?? 0}\u00B0 sklon`,
      });
    }
    return att;
  };

  const buildFveSummary = (): QuoteSystemSummary[] => {
    const totalPanels = roofs.reduce((s, r) => s + r.panelCount, 0);
    const totalKwp = result?.totalPowerKwp ?? roofs.reduce((s, r) => s + (r.panelCount * r.panelPowerWp) / 1000, 0);
    const inverter = catalog.inverters.find(i => i.id === config.inverterId);
    const masterBat = catalog.batteries.find(b => b.id === config.batteryId);
    const slaveBat = catalog.batteries.find(b => b.id === config.slaveBatteryId);
    const totalBatteryKwh =
      (masterBat ? masterBat.capacity_kwh * (config.batteryCount ?? 0) : 0) +
      (slaveBat ? slaveBat.capacity_kwh * (config.slaveBatteryCount ?? 0) : 0);

    const data: Record<string, string | number> = {
      'Výkon': `${totalKwp.toFixed(1)} kWp`,
      'Panely': totalPanels,
      'Střechy': roofs.filter(r => r.panelCount > 0).length,
    };
    if (inverter) data['Střídač'] = `${inverter.name} (${inverter.power_kw} kW)`;
    if (totalBatteryKwh > 0) data['Baterie'] = `${totalBatteryKwh.toFixed(1)} kWh`;
    if (result?.annualProductionKwh) data['Roční produkce'] = `${Math.round(result.annualProductionKwh)} kWh`;

    return [{ type: 'fve', data }];
  };

  if (lines.length === 0 && customItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-sm text-slate-400 font-extrabold mb-3">Žádné položky k nacenění</div>
        <div className="text-xs text-slate-400">Nakonfigurujte systém v předchozích krocích.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {resultsStale && (
        <div className="bg-amber-500/20 border border-amber-400/50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-extrabold text-amber-300">Výsledky PVGIS jsou neaktuální</div>
            <div className="text-xs text-amber-400/80 mt-0.5">
              Návrh byl změněn. Vraťte se ke kroku "Konfigurace" a proveďte nový výpočet.
            </div>
          </div>
        </div>
      )}

      {roofPreviews.length > 0 && (
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Image className="w-3 h-3" /> Návrh střech
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {roofPreviews.map(roof => (
              <div key={roof.id} className="shrink-0 rounded-xl border border-white/10 overflow-hidden bg-white/[0.04]">
                <img src={roofSnapshots?.[roof.id] || roof.snapshotDataUrl || ''} alt={roof.name} className="w-32 h-20 object-contain bg-white/[0.06]" />
                <div className="px-2 py-1 text-center">
                  <div className="text-[10px] font-extrabold text-slate-300 truncate">{roof.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.06] p-0.5 gap-0.5">
        <button
          onClick={() => setMode('itemized')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition ${
            quoteMode === 'itemized' ? 'bg-white/[0.06] text-orange-600 ' : 'text-slate-400 hover:text-slate-400'
          }`}
        >
          <List className="w-3.5 h-3.5" /> Položková nabídka
        </button>
        <button
          onClick={() => setMode('total')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition ${
            quoteMode === 'total' ? 'bg-white/[0.06] text-orange-600 ' : 'text-slate-400 hover:text-slate-400'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" /> Celková cena
        </button>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {quoteMode === 'itemized' ? 'Položková cenová nabídka' : 'Cenová nabídka FVE'}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
              <Percent className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] font-extrabold text-slate-400">Sleva</span>
              <input
                type="number" min="0" max="100" value={globalDiscountPct}
                onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                className="w-12 bg-transparent text-sm font-extrabold text-orange-400 text-right focus:outline-none"
              />
              <span className="text-[10px] font-extrabold text-slate-500">%</span>
            </div>
          </div>
        </div>

        {quoteMode === 'itemized' ? (
          <ItemizedView
            categories={categories}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            getItemDiscount={getItemDiscount}
            setItemDiscount={setItemDiscount}
            editingDiscount={editingDiscount}
            setEditingDiscount={setEditingDiscount}
            computeDiscountedPrice={computeDiscountedPrice}
            globalDiscountPct={globalDiscountPct}
          />
        ) : (
          <TotalView categories={categories} />
        )}

        {autoLaborCalc.price > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <HardHat className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 flex-1">
              Kalkulace montáže: {autoLaborCalc.price.toLocaleString('cs-CZ')} Kč
              {config.laborOverride !== undefined && config.laborOverride !== null && (
                <span className="text-orange-400 ml-1">(upraveno na {effectiveLabor.toLocaleString('cs-CZ')} Kč)</span>
              )}
            </span>
            <button
              onClick={() => setEditingLabor(!editingLabor)}
              className="text-[9px] font-extrabold text-slate-500 hover:text-orange-400 transition"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {editingLabor && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <input
              type="number" min="0" step="100" autoFocus
              value={config.laborOverride ?? effectiveLabor}
              onChange={e => onConfigChange({ ...config, laborOverride: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs font-extrabold text-orange-400 focus:outline-none focus:border-orange-500"
            />
            <span className="text-[10px] text-slate-500">Kč</span>
            {config.laborOverride !== undefined && config.laborOverride !== null && (
              <button
                onClick={() => onConfigChange({ ...config, laborOverride: null })}
                className="text-[9px] font-extrabold text-slate-500 hover:text-orange-400"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {constructionBreakdown.totalPrice > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Wrench className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 flex-1">
              Kalkulace konstrukce: {constructionBreakdown.totalPrice.toLocaleString('cs-CZ')} Kč
              {config.constructionPriceOverride !== undefined && config.constructionPriceOverride !== null && (
                <span className="text-orange-400 ml-1">(upraveno na {effectiveConstruction.toLocaleString('cs-CZ')} Kč)</span>
              )}
            </span>
            <button
              onClick={() => setEditingConstruction(!editingConstruction)}
              className="text-[9px] font-extrabold text-slate-500 hover:text-orange-400 transition"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {editingConstruction && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <input
              type="number" min="0" step="100" autoFocus
              value={config.constructionPriceOverride ?? effectiveConstruction}
              onChange={e => onConfigChange({ ...config, constructionPriceOverride: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs font-extrabold text-orange-400 focus:outline-none focus:border-orange-500"
            />
            <span className="text-[10px] text-slate-500">Kč</span>
            {config.constructionPriceOverride !== undefined && config.constructionPriceOverride !== null && (
              <button
                onClick={() => onConfigChange({ ...config, constructionPriceOverride: null })}
                className="text-[9px] font-extrabold text-slate-500 hover:text-orange-400"
              >
                Reset
              </button>
            )}
          </div>
        )}

        <QuoteTotals
          totalBeforeDiscount={totalBeforeDiscount}
          totalAfterDiscount={totalAfterDiscount}
          subsidyCzk={subsidyCzk}
          finalPrice={finalPrice}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <PenLine className="w-3 h-3" /> Vlastní položky
          </div>
          <button
            onClick={addCustomItem}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-xs font-extrabold text-slate-400 transition"
          >
            <Plus className="w-3 h-3" /> Přidat
          </button>
        </div>
        {customItems.length > 0 && (
          <div className="space-y-1.5">
            {customItems.map(ci => (
              <div key={ci.id} className="flex items-center gap-2 bg-navy-800/60 border border-white/[0.08] rounded-xl p-2.5">
                <div className="flex-1 grid grid-cols-4 gap-2 min-w-0">
                  <input
                    className="col-span-2 text-xs font-extrabold border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
                    placeholder="Název položky"
                    value={ci.name}
                    onChange={e => updateCustomItem(ci.id, { name: e.target.value })}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="1"
                      className="w-full text-xs font-extrabold border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
                      value={ci.qty}
                      onChange={e => updateCustomItem(ci.id, { qty: parseFloat(e.target.value) || 0 })}
                    />
                    <input
                      className="w-12 text-xs font-extrabold border border-white/10 rounded-lg px-1.5 py-1.5 focus:outline-none focus:border-orange-400 text-center"
                      value={ci.unit}
                      onChange={e => updateCustomItem(ci.id, { unit: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="100"
                      className="w-full text-xs font-extrabold border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 text-right"
                      value={ci.unitPrice}
                      onChange={e => updateCustomItem(ci.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-[10px] text-slate-400 shrink-0">Kč</span>
                  </div>
                </div>
                <button
                  onClick={() => removeCustomItem(ci.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-500/10 rounded-xl p-3">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 mb-0.5">Zisk</div>
          <div className="text-lg font-extrabold text-emerald-400">{Math.round(totalProfit).toLocaleString('cs-CZ')} Kč</div>
          <div className="text-[10px] font-extrabold text-emerald-500">Marže {profitMarginPct}%</div>
        </div>
        {paybackYears !== null && (
          <div className="bg-blue-500/10 rounded-xl p-3">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-blue-400 mb-0.5">Návratnost</div>
            <div className="text-lg font-extrabold text-blue-400">{paybackYears} let</div>
            <div className="text-[10px] font-extrabold text-blue-500">pro zákazníka</div>
          </div>
        )}
        {annualBenefit > 0 && (
          <div className="bg-orange-500/10 rounded-xl p-3">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600 mb-0.5">Roční úspory</div>
            <div className="text-lg font-extrabold text-orange-700">{annualBenefit.toLocaleString('cs-CZ')} Kč</div>
            <div className="text-[10px] font-extrabold text-orange-500">pro zákazníka</div>
          </div>
        )}
      </div>

      {projectId && (
        <button
          onClick={() => setShowSaveModal(true)}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2"
        >
          <FileDown className="w-4 h-4" /> Uložit jako nabídku projektu
        </button>
      )}

      {projectId && (
        <SaveQuoteModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          projectId={projectId}
          sections={buildExportSections()}
          globalDiscount={globalDiscountPct}
          sourceType="fve"
          sourceMeta={{ sourceType: 'fve' }}
          attachments={buildRoofAttachments()}
          summaries={buildFveSummary()}
          onSaved={() => toast('Nabídka uložena do projektu')}
        />
      )}
    </div>
  );
}

function ItemizedView({
  categories, expandedCategories, toggleCategory, getItemDiscount, setItemDiscount,
  editingDiscount, setEditingDiscount, computeDiscountedPrice, globalDiscountPct,
}: {
  categories: [string, { icon: typeof Sun; label: string; items: QuoteLineItem[] }][];
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  getItemDiscount: (key: string) => number;
  setItemDiscount: (key: string, pct: number) => void;
  editingDiscount: string | null;
  setEditingDiscount: (key: string | null) => void;
  computeDiscountedPrice: (item: QuoteLineItem) => number;
  globalDiscountPct: number;
}) {
  return (
    <>
      {categories.map(([catKey, cat]) => {
        const Icon = cat.icon;
        const isExpanded = expandedCategories.has(catKey);
        const catTotal = cat.items.reduce((s, l) => s + computeDiscountedPrice(l), 0);
        const catQty = cat.items.reduce((s, l) => s + l.qty, 0);

        return (
          <div key={catKey}>
            <button
              onClick={() => toggleCategory(catKey)}
              className="w-full flex items-center gap-2.5 py-2 px-1 hover:bg-slate-800/50 rounded-lg transition"
            >
              <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-300 flex-1 text-left">{cat.label}</span>
              <span className="text-[10px] font-extrabold text-slate-500 mr-1">{catQty} ks</span>
              <span className="text-[11px] font-extrabold text-orange-400 mr-1">
                {Math.round(catTotal).toLocaleString('cs-CZ')} Kč
              </span>
              {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
            </button>

            {isExpanded && (
              <div className="ml-6 mb-2 space-y-0.5">
                {cat.items.map(item => {
                  const disc = getItemDiscount(item.key);
                  const discPrice = computeDiscountedPrice(item);
                  const isEditing = editingDiscount === item.key;

                  return (
                    <div key={item.key} className="flex items-center gap-2 py-1 pl-1 pr-0.5 rounded-lg hover:bg-slate-800/30 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-extrabold text-slate-400 truncate">{item.name}</div>
                        <div className="text-[9px] text-slate-400">
                          {item.qty} {item.unit} x {item.unitPrice.toLocaleString('cs-CZ')} Kč
                          {disc > 0 && <span className="text-orange-500 ml-1">(-{disc}%)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number" min="0" max="100" autoFocus value={disc}
                              onChange={e => setItemDiscount(item.key, parseFloat(e.target.value) || 0)}
                              onBlur={() => setEditingDiscount(null)}
                              onKeyDown={e => { if (e.key === 'Enter') setEditingDiscount(null); }}
                              className="w-10 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-orange-400 text-right focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-[9px] text-slate-500">%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingDiscount(item.key)}
                            className={`text-[9px] font-extrabold rounded px-1 py-0.5 transition ${
                              disc > 0
                                ? 'text-orange-400 bg-orange-500/10'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-orange-400'
                            }`}
                          >
                            {disc > 0 ? `-${disc}%` : 'sleva'}
                          </button>
                        )}
                        <span className={`text-[10px] font-extrabold w-16 text-right ${disc > 0 || globalDiscountPct > 0 ? 'text-orange-300' : 'text-slate-300'}`}>
                          {Math.round(discPrice).toLocaleString('cs-CZ')} Kč
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function TotalView({
  categories,
}: {
  categories: [string, { icon: typeof Sun; label: string; items: QuoteLineItem[] }][];
}) {
  return (
    <div className="space-y-0.5">
      {categories.map(([catKey, cat]) => {
        const Icon = cat.icon;
        const catQty = cat.items.reduce((s, l) => s + l.qty, 0);

        return (
          <div key={catKey}>
            <div className="flex items-center gap-2.5 py-2 px-1">
              <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-300 flex-1 text-left">{cat.label}</span>
              <span className="text-[10px] font-extrabold text-slate-500">{catQty} ks</span>
            </div>
            <div className="ml-6 mb-1.5 space-y-0.5">
              {cat.items.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-0.5 pl-1">
                  <div className="text-[10px] font-extrabold text-slate-500 flex-1 truncate">{item.name}</div>
                  <span className="text-[10px] font-extrabold text-slate-500 shrink-0">{item.qty} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuoteTotals({
  totalBeforeDiscount, totalAfterDiscount, subsidyCzk, finalPrice,
}: {
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
  subsidyCzk: number;
  finalPrice: number;
}) {
  return (
    <div className="border-t border-slate-700 pt-3 mt-3 space-y-1.5">
      {totalBeforeDiscount !== totalAfterDiscount && (
        <div className="flex justify-between text-[11px]">
          <span className="font-extrabold text-slate-500">Před slevou</span>
          <span className="font-extrabold text-slate-500 line-through">{totalBeforeDiscount.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}
      <div className="flex justify-between text-[11px]">
        <span className="font-extrabold text-slate-300">Celkem bez DPH</span>
        <span className="font-extrabold text-white text-sm">{Math.round(totalAfterDiscount).toLocaleString('cs-CZ')} Kč</span>
      </div>
      {subsidyCzk > 0 && (
        <>
          <div className="flex justify-between text-[11px]">
            <span className="font-extrabold text-emerald-400">Dotace</span>
            <span className="font-extrabold text-emerald-400">-{subsidyCzk.toLocaleString('cs-CZ')} Kč</span>
          </div>
          <div className="flex justify-between border-t border-slate-700 pt-1.5">
            <span className="text-xs font-extrabold text-emerald-300">Vlastní investice</span>
            <span className="text-sm font-extrabold text-emerald-400">{finalPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>
        </>
      )}
    </div>
  );
}
