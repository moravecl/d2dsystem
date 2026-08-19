import { useState, useMemo } from 'react';
import { X, Sun, Zap, Battery, Car, Package, Wrench, Check, FileDown, Image } from 'lucide-react';
import type { FvCatalogData } from '../../hooks/useFvCatalog';
import type { FvSystemConfig } from '../../hooks/useFvDesign';
import type { FvCalculationResult, RoofSurface } from '../../lib/fvCalculations';
import type { QuoteSection } from '../catalog/quoteHelpers';
import { buildConstructionItems, calcConstructionCostBreakdown } from './fvQuoteBuilder';

const TECH_MAP: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná' };

interface QuoteCategory {
  key: string;
  label: string;
  icon: typeof Sun;
  enabled: boolean;
  items: { name: string; qty: number; unit: string; unitPrice: number; total: number }[];
}

interface Props {
  catalog: FvCatalogData;
  config: FvSystemConfig;
  roofs: RoofSurface[];
  roofSnapshots?: Record<string, string>;
  result: FvCalculationResult | null;
  onClose: () => void;
  onExport: (sections: QuoteSection[]) => void;
}

export default function FvQuoteExportModal({ catalog, config, roofs, roofSnapshots, onClose, onExport }: Props) {
  const categories = useMemo(() => {
    const cats: QuoteCategory[] = [];

    const panelItems = roofs.filter(r => r.panelCount > 0).map(r => {
      const panel = catalog.panels.find(p => p.id === r.panelId);
      const unitPrice = panel?.price ?? 0;
      return {
        name: panel
          ? `FV panel ${panel.name} (${panel.power_wp} Wp, ${TECH_MAP[panel.technology] ?? panel.technology}) - ${r.name}`
          : `FV panely ${r.name} (${r.panelPowerWp} Wp)`,
        qty: r.panelCount,
        unit: 'ks',
        unitPrice,
        total: r.panelCount * unitPrice,
      };
    });
    if (panelItems.length > 0) {
      cats.push({ key: 'panels', label: 'Panely', icon: Sun, enabled: true, items: panelItems });
    }

    const inverter = catalog.inverters.find(i => i.id === config.inverterId);
    if (inverter) {
      cats.push({
        key: 'inverter', label: 'Střídač', icon: Zap, enabled: true,
        items: [{ name: `Střídač ${inverter.name} (${inverter.power_kw} kW)`, qty: 1, unit: 'ks', unitPrice: inverter.price, total: inverter.price }],
      });
    }

    const batteryItems: QuoteCategory['items'] = [];
    const masterBat = catalog.batteries.find(b => b.id === config.batteryId);
    if (masterBat && (config.batteryCount ?? 0) > 0) {
      const cnt = config.batteryCount ?? 1;
      batteryItems.push({ name: `Baterie master ${masterBat.name} (${masterBat.capacity_kwh} kWh)`, qty: cnt, unit: 'ks', unitPrice: masterBat.price, total: masterBat.price * cnt });
    }
    const slaveBat = catalog.batteries.find(b => b.id === config.slaveBatteryId);
    if (slaveBat && (config.slaveBatteryCount ?? 0) > 0) {
      const cnt = config.slaveBatteryCount ?? 1;
      batteryItems.push({ name: `Baterie slave ${slaveBat.name} (${slaveBat.capacity_kwh} kWh)`, qty: cnt, unit: 'ks', unitPrice: slaveBat.price, total: slaveBat.price * cnt });
    }
    if (batteryItems.length > 0) {
      cats.push({ key: 'battery', label: 'Baterie', icon: Battery, enabled: true, items: batteryItems });
    }

    const wallbox = catalog.wallboxes.find(w => w.id === config.wallboxId);
    if (wallbox) {
      cats.push({
        key: 'wallbox', label: 'Wallbox', icon: Car, enabled: true,
        items: [{ name: `Wallbox ${wallbox.name} (${wallbox.power_kw} kW)`, qty: 1, unit: 'ks', unitPrice: wallbox.price, total: wallbox.price }],
      });
    }

    const accItems = (config.accessories ?? []).map(a => {
      const acc = catalog.accessories.find(x => x.id === a.accessoryId);
      if (!acc || a.quantity === 0) return null;
      return { name: acc.name, qty: a.quantity, unit: acc.unit, unitPrice: acc.price_per_unit, total: acc.price_per_unit * a.quantity };
    }).filter(Boolean) as QuoteCategory['items'];
    if (accItems.length > 0) {
      cats.push({ key: 'accessories', label: 'Příslušenství', icon: Package, enabled: true, items: accItems });
    }

    const constructionBreakdown = calcConstructionCostBreakdown(roofs, catalog.roofTiles, catalog.hooks, catalog.railProfiles, catalog.clamps);
    if (constructionBreakdown.total > 0) {
      const constItems: QuoteCategory['items'] = [];
      if (constructionBreakdown.hooksCost > 0) constItems.push({ name: 'Háky (střešní uchycení)', qty: 1, unit: 'set', unitPrice: constructionBreakdown.hooksCost, total: constructionBreakdown.hooksCost });
      if (constructionBreakdown.profilesCost > 0) constItems.push({ name: 'Profilové lišty', qty: 1, unit: 'set', unitPrice: constructionBreakdown.profilesCost, total: constructionBreakdown.profilesCost });
      if (constructionBreakdown.midClampsCost > 0) constItems.push({ name: 'Středové příchytky', qty: 1, unit: 'set', unitPrice: constructionBreakdown.midClampsCost, total: constructionBreakdown.midClampsCost });
      if (constructionBreakdown.endClampsCost > 0) constItems.push({ name: 'Krajové příchytky', qty: 1, unit: 'set', unitPrice: constructionBreakdown.endClampsCost, total: constructionBreakdown.endClampsCost });
      cats.push({ key: 'construction', label: 'Montážní konstrukce', icon: Wrench, enabled: true, items: constItems });
    }

    if (config.laborCost && config.laborCost > 0) {
      cats.push({
        key: 'labor', label: 'Práce a montáž', icon: Wrench, enabled: true,
        items: [{ name: 'Montáž FV systému', qty: 1, unit: 'paušál', unitPrice: config.laborCost, total: config.laborCost }],
      });
    }

    return cats;
  }, [catalog, config, roofs]);

  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(() => new Set(categories.map(c => c.key)));
  const [includeSubsidy, setIncludeSubsidy] = useState((config.subsidyCzk ?? 0) > 0);

  const toggleCategory = (key: string) => {
    setEnabledKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedTotal = categories
    .filter(c => enabledKeys.has(c.key))
    .reduce((sum, c) => sum + c.items.reduce((s, i) => s + i.total, 0), 0);

  const subsidyCzk = config.subsidyCzk ?? 0;
  const finalTotal = includeSubsidy && subsidyCzk > 0 ? Math.max(0, selectedTotal - subsidyCzk) : selectedTotal;

  const handleExport = () => {
    const items = [];

    for (const cat of categories) {
      if (!enabledKeys.has(cat.key)) continue;

      if (cat.key === 'construction') {
        const constItems = buildConstructionItems(roofs, catalog.roofTiles, catalog.hooks, catalog.railProfiles, catalog.clamps);
        items.push(...constItems);
        continue;
      }

      for (const item of cat.items) {
        items.push({
          id: crypto.randomUUID(),
          code: '',
          name: item.name,
          unit: item.unit,
          quantity: item.qty,
          sellingPrice: item.unitPrice,
          costPrice: item.unitPrice * 0.75,
        });
      }
    }

    if (includeSubsidy && subsidyCzk > 0) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: 'Dotace NZU (odpočet)',
        unit: 'paušál',
        quantity: 1,
        sellingPrice: -subsidyCzk,
        costPrice: 0,
      });
    }

    const section: QuoteSection = {
      id: crypto.randomUUID(),
      name: 'Fotovoltaika',
      trade: 'fotovoltaika',
      icon: 'sun',
      items,
    };

    onExport([section]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-backdrop-enter" onClick={onClose} />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl shadow-slate-900/10 w-full max-w-lg animate-modal-enter overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Generovat nabidku FVE</h2>
            <p className="text-xs text-slate-500 mt-0.5">Vyberte položky, které chcete zahrnout</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto space-y-3">
          {roofSnapshots && roofs.some(r => r.panelCount > 0 && roofSnapshots[r.id]) && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <Image className="w-3 h-3" /> Náhled střech
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {roofs.filter(r => r.panelCount > 0 && roofSnapshots[r.id]).map(roof => (
                  <div key={roof.id} className="shrink-0 rounded-xl border border-white/10 overflow-hidden bg-white/[0.04]">
                    <img
                      src={roofSnapshots[roof.id]}
                      alt={roof.name}
                      className="w-36 h-24 object-contain bg-white/[0.06]"
                    />
                    <div className="px-2 py-1.5 text-center">
                      <div className="text-[10px] font-extrabold text-slate-300 truncate">{roof.name}</div>
                      <div className="text-[9px] text-slate-400">{roof.panelCount} ks / {Math.round(roof.panelCount * roof.panelPowerWp / 10) / 100} kWp</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {categories.map(cat => {
            const Icon = cat.icon;
            const isEnabled = enabledKeys.has(cat.key);
            const catTotal = cat.items.reduce((s, i) => s + i.total, 0);

            return (
              <div
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`rounded-xl border-2 p-3 cursor-pointer transition ${
                  isEnabled ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isEnabled ? 'bg-orange-500/20' : 'bg-white/[0.06]'}`}>
                    <Icon className={`w-4 h-4 ${isEnabled ? 'text-orange-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-white">{cat.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {cat.items.length === 1 ? cat.items[0].name : `${cat.items.length} položek`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold text-slate-300">{catTotal.toLocaleString('cs-CZ')} Kč</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition ${
                      isEnabled ? 'bg-orange-500 border-orange-500' : 'bg-white/[0.06] border-slate-300'
                    }`}>
                      {isEnabled && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
                {isEnabled && cat.items.length > 1 && (
                  <div className="mt-2 ml-11 space-y-0.5">
                    {cat.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] text-slate-500">
                        <span className="truncate mr-2">{item.name}</span>
                        <span className="shrink-0 font-semibold">{item.qty} {item.unit} / {item.total.toLocaleString('cs-CZ')} Kč</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {subsidyCzk > 0 && (
            <div
              onClick={() => setIncludeSubsidy(!includeSubsidy)}
              className={`rounded-xl border-2 p-3 cursor-pointer transition ${
                includeSubsidy ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${includeSubsidy ? 'bg-emerald-500/20' : 'bg-white/[0.06]'}`}>
                  <FileDown className={`w-4 h-4 ${includeSubsidy ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-white">Dotace NZU</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Odpočet dotace z celkové ceny</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-emerald-400">-{subsidyCzk.toLocaleString('cs-CZ')} Kč</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition ${
                    includeSubsidy ? 'bg-emerald-500 border-emerald-500' : 'bg-white/[0.06] border-slate-300'
                  }`}>
                    {includeSubsidy && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Celková cena nabídky</div>
              {includeSubsidy && subsidyCzk > 0 && (
                <div className="text-[10px] text-slate-400 line-through">{selectedTotal.toLocaleString('cs-CZ')} Kč</div>
              )}
            </div>
            <div className="text-xl font-extrabold text-white">{finalTotal.toLocaleString('cs-CZ')} Kč</div>
          </div>
          <button
            onClick={handleExport}
            disabled={enabledKeys.size === 0}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Vložit do nabídky ({enabledKeys.size} kategorií)
          </button>
        </div>
      </div>
    </div>
  );
}
