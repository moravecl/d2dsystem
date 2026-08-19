import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Percent, Wrench, Plus, Trash2, FileDown, X as XIcon, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEpsCatalog } from '../../hooks/useEpsCatalog';
import { useEpsDesign } from '../../hooks/useEpsDesign';
import type { EpsQuoteConfig } from '../../hooks/useEpsDesign';
import { calcTotalPrice, calcCableLengthM } from '../../lib/epsCalculations';
import { polylineLength, normalizedToMeters } from '../../components/catalog/floorplan/geometry';
import { exportEpsQuotePdf } from '../../components/eps/epsQuotePdfExport';
import SaveQuoteModal from '../../components/catalog/SaveQuoteModal';
import type { QuoteSection } from '../../components/catalog/quoteHelpers';
import { useToast } from '../../components/ui/Toast';
import { loadQuoteClientInfo, loadQuoteCompanyInfo, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';

const DEFAULT_MARGIN = 0.3;

export default function EpsQuotePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const catalog = useEpsCatalog();
  const { design, loading, updateDesignData, getDesignData } = useEpsDesign(projectId);
  const [projectName, setProjectName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [quoteClient, setQuoteClient] = useState<QuoteClientInfo | null>(null);
  const [quoteCompany, setQuoteCompany] = useState<QuoteCompanyInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('name').eq('id', projectId).maybeSingle().then(({ data }) => {
      if (data) setProjectName((data as { name: string }).name);
    });
    loadQuoteClientInfo(projectId).then(setQuoteClient);
    loadQuoteCompanyInfo().then(setQuoteCompany);
  }, [projectId]);

  const designData = design?.design_data ?? { layers: [], detectors: [], panels: [], sirens: [], routes: [], accessoryItems: [], zones: [] };
  const quoteConfig = designData.quoteConfig ?? {};

  const updateQuoteConfig = useCallback((updates: Partial<EpsQuoteConfig>) => {
    updateDesignData(prev => ({
      ...prev,
      quoteConfig: { ...prev.quoteConfig, ...updates },
    }));
  }, [updateDesignData]);

  const priceOverrides = quoteConfig.priceOverrides ?? {};
  const costOverrides = quoteConfig.costOverrides ?? {};

  const handlePriceOverride = useCallback((modelId: string, value: number | null) => {
    updateQuoteConfig({
      priceOverrides: value === null
        ? Object.fromEntries(Object.entries(priceOverrides).filter(([k]) => k !== modelId))
        : { ...priceOverrides, [modelId]: value },
    });
  }, [updateQuoteConfig, priceOverrides]);

  const handleCostOverride = useCallback((modelId: string, value: number | null) => {
    updateQuoteConfig({
      costOverrides: value === null
        ? Object.fromEntries(Object.entries(costOverrides).filter(([k]) => k !== modelId))
        : { ...costOverrides, [modelId]: value },
    });
  }, [updateQuoteConfig, costOverrides]);

  const prices = calcTotalPrice(designData, catalog.detectors, catalog.panels, catalog.sirens, catalog.cables, catalog.accessories, catalog.motionSensors, catalog.keypads, catalog.controlDevices, priceOverrides);
  const cableLen = calcCableLengthM(designData);

  const globalDiscount = quoteConfig.globalDiscountPct ?? 0;
  const vatPct = quoteConfig.vatPct ?? 21;
  const laborSellPrice = quoteConfig.laborSellPrice ?? quoteConfig.laborCost ?? 0;
  const laborCostPrice = quoteConfig.laborCostPrice ?? 0;
  const laborDescription = quoteConfig.laborDescription ?? '';
  const customItems = quoteConfig.customItems ?? [];
  const customItemsTotal = customItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const subtotal = prices.totalCost + customItemsTotal + laborSellPrice;
  const discountAmount = Math.round(subtotal * (globalDiscount / 100));
  const priceBeforeVat = subtotal - discountAmount;
  const vatAmount = Math.round(priceBeforeVat * (vatPct / 100));
  const grandTotal = priceBeforeVat + vatAmount;

  const calcTotalCost = () => {
    let cost = 0;
    for (const d of designData.detectors) {
      const model = catalog.detectors.find(m => m.id === d.modelId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const p of designData.panels) {
      const model = catalog.panels.find(m => m.id === p.panelId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const s of designData.sirens) {
      const model = catalog.sirens.find(m => m.id === s.sirenId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const ms of (designData.motionSensors ?? [])) {
      const model = catalog.motionSensors.find(m => m.id === ms.sensorId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const kp of (designData.keypads ?? [])) {
      const model = catalog.keypads.find(m => m.id === kp.keypadId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const cd of (designData.controlDevices ?? [])) {
      const model = catalog.controlDevices.find(m => m.id === cd.deviceId);
      if (model) cost += costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
    }
    for (const route of designData.routes) {
      const cable = catalog.cables.find(c => c.id === route.cableTypeId);
      if (cable && route.points.length >= 2) {
        const normLen = polylineLength(route.points);
        const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
        const meters = effectiveScale ? normalizedToMeters(normLen, effectiveScale) : normLen * 10;
        const costPerM = costOverrides[cable.id] ?? cable.price_per_m * (1 - DEFAULT_MARGIN);
        cost += meters * costPerM;
      }
    }
    for (const item of designData.accessoryItems) {
      const acc = catalog.accessories.find(a => a.id === item.accessoryId);
      if (acc) cost += (costOverrides[acc.id] ?? acc.price * (1 - DEFAULT_MARGIN)) * item.quantity;
    }
    cost += laborCostPrice;
    for (const ci of customItems) {
      cost += ci.qty * (ci.costPrice ?? ci.unitPrice * (1 - DEFAULT_MARGIN));
    }
    return Math.round(cost);
  };

  const totalCost = calcTotalCost();
  const grossProfit = priceBeforeVat - totalCost;
  const marginPct = priceBeforeVat > 0 ? Math.round((grossProfit / priceBeforeVat) * 100) : 0;

  const handleAddCustomItem = () => {
    const id = crypto.randomUUID();
    updateQuoteConfig({
      customItems: [...customItems, { id, name: '', qty: 1, unit: 'ks', unitPrice: 0, costPrice: 0 }],
    });
  };

  const handleUpdateCustomItem = (id: string, field: string, value: string | number) => {
    updateQuoteConfig({
      customItems: customItems.map(i => i.id === id ? { ...i, [field]: value } : i),
    });
  };

  const handleDeleteCustomItem = (id: string) => {
    updateQuoteConfig({ customItems: customItems.filter(i => i.id !== id) });
  };

  const handleExportPdf = () => {
    const data = getDesignData();
    if (!data) return;
    exportEpsQuotePdf({
      projectName,
      designData: data,
      catalog,
      quoteConfig: data.quoteConfig ?? {},
      client: quoteClient,
      company: quoteCompany,
    });
  };

  if (loading || catalog.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  const detectorGroups = new Map<string, { model: typeof catalog.detectors[0]; count: number }>();
  for (const d of designData.detectors) {
    const existing = detectorGroups.get(d.modelId);
    if (existing) existing.count++;
    else {
      const model = catalog.detectors.find(m => m.id === d.modelId);
      if (model) detectorGroups.set(d.modelId, { model, count: 1 });
    }
  }

  const panelGroups = new Map<string, { model: typeof catalog.panels[0]; count: number }>();
  for (const p of designData.panels) {
    const existing = panelGroups.get(p.panelId);
    if (existing) existing.count++;
    else {
      const model = catalog.panels.find(m => m.id === p.panelId);
      if (model) panelGroups.set(p.panelId, { model, count: 1 });
    }
  }

  const sirenGroups = new Map<string, { model: typeof catalog.sirens[0]; count: number }>();
  for (const s of designData.sirens) {
    const existing = sirenGroups.get(s.sirenId);
    if (existing) existing.count++;
    else {
      const model = catalog.sirens.find(m => m.id === s.sirenId);
      if (model) sirenGroups.set(s.sirenId, { model, count: 1 });
    }
  }

  const motionGroups = new Map<string, { model: typeof catalog.motionSensors[0]; count: number }>();
  for (const ms of (designData.motionSensors ?? [])) {
    const existing = motionGroups.get(ms.sensorId);
    if (existing) existing.count++;
    else {
      const model = catalog.motionSensors.find(m => m.id === ms.sensorId);
      if (model) motionGroups.set(ms.sensorId, { model, count: 1 });
    }
  }

  const keypadGroups = new Map<string, { model: typeof catalog.keypads[0]; count: number }>();
  for (const kp of (designData.keypads ?? [])) {
    const existing = keypadGroups.get(kp.keypadId);
    if (existing) existing.count++;
    else {
      const model = catalog.keypads.find(m => m.id === kp.keypadId);
      if (model) keypadGroups.set(kp.keypadId, { model, count: 1 });
    }
  }

  const controlDeviceGroups = new Map<string, { model: typeof catalog.controlDevices[0]; count: number }>();
  for (const cd of (designData.controlDevices ?? [])) {
    const existing = controlDeviceGroups.get(cd.deviceId);
    if (existing) existing.count++;
    else {
      const model = catalog.controlDevices.find(m => m.id === cd.deviceId);
      if (model) controlDeviceGroups.set(cd.deviceId, { model, count: 1 });
    }
  }

  const buildQuoteSections = (): QuoteSection[] => {
    const items: { id: string; code: string; name: string; unit: string; quantity: number; sellingPrice: number; costPrice: number }[] = [];

    for (const [, { model, count }] of detectorGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }
    for (const [, { model, count }] of panelGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }
    for (const [, { model, count }] of sirenGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }
    for (const [, { model, count }] of motionGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }
    for (const [, { model, count }] of keypadGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }
    for (const [, { model, count }] of controlDeviceGroups) {
      const sell = priceOverrides[model.id] ?? model.price;
      const cost = costOverrides[model.id] ?? model.price * (1 - DEFAULT_MARGIN);
      items.push({ id: crypto.randomUUID(), code: model.model_number, name: `${model.model_number} — ${model.name}`, unit: 'ks', quantity: count, sellingPrice: sell, costPrice: cost });
    }

    for (const route of designData.routes) {
      const cable = catalog.cables.find(c => c.id === route.cableTypeId);
      if (!cable || route.points.length < 2) continue;
      const normLen = polylineLength(route.points);
      const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
      const len = effectiveScale ? Math.round(normalizedToMeters(normLen, effectiveScale) * 10) / 10 : Math.round(normLen * 100) / 10;
      items.push({ id: crypto.randomUUID(), code: '', name: cable.name, unit: 'm', quantity: len, sellingPrice: priceOverrides[cable.id] ?? cable.price_per_m, costPrice: costOverrides[cable.id] ?? cable.price_per_m * (1 - DEFAULT_MARGIN) });
    }

    for (const item of designData.accessoryItems) {
      const acc = catalog.accessories.find(a => a.id === item.accessoryId);
      if (!acc || item.quantity <= 0) continue;
      items.push({ id: crypto.randomUUID(), code: '', name: acc.name, unit: 'ks', quantity: item.quantity, sellingPrice: priceOverrides[acc.id] ?? acc.price, costPrice: costOverrides[acc.id] ?? acc.price * (1 - DEFAULT_MARGIN) });
    }

    if (laborSellPrice > 0) {
      items.push({ id: crypto.randomUUID(), code: '', name: laborDescription || 'Montáž a zprovoznění', unit: 'paušál', quantity: 1, sellingPrice: laborSellPrice, costPrice: laborCostPrice });
    }

    for (const ci of customItems) {
      if (ci.qty <= 0) continue;
      items.push({ id: crypto.randomUUID(), code: '', name: ci.name || 'Vlastní položka', unit: ci.unit, quantity: ci.qty, sellingPrice: ci.unitPrice, costPrice: ci.costPrice ?? ci.unitPrice * (1 - DEFAULT_MARGIN) });
    }

    return [{ id: crypto.randomUUID(), name: 'EPS / EZS systém', trade: 'eps', icon: 'shield', items }];
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex items-center gap-3 px-6 py-3 bg-slate-900/95 border-b border-slate-700/50 sticky top-0 z-20">
        <button
          onClick={() => navigate(`/projekty/${projectId}/eps-navrh`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Návrhář
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-extrabold text-white">Kalkulace EPS / EZS — {projectName}</h1>
        </div>
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
        >
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Section title="Detektory">
          {[...detectorGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {detectorGroups.size === 0 && <EmptyLine text="Žádné detektory" />}
        </Section>

        <Section title="Ústředny">
          {[...panelGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {panelGroups.size === 0 && <EmptyLine text="Žádná ústředna" />}
        </Section>

        <Section title="Sirény">
          {[...sirenGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {sirenGroups.size === 0 && <EmptyLine text="Žádné sirény" />}
        </Section>

        <Section title="Pohybová čidla">
          {[...motionGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {motionGroups.size === 0 && <EmptyLine text="Žádná pohybová čidla" />}
        </Section>

        <Section title="Klávesnice">
          {[...keypadGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {keypadGroups.size === 0 && <EmptyLine text="Žádné klávesnice" />}
        </Section>

        <Section title="Ovládací prvky">
          {[...controlDeviceGroups.entries()].map(([id, { model, count }]) => (
            <QuoteLine key={id} modelId={model.id} name={`${model.model_number} — ${model.name}`} qty={count} unit="ks" unitPrice={model.price} overridePrice={priceOverrides[model.id]} overrideCost={costOverrides[model.id]} defaultCost={model.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />
          ))}
          {controlDeviceGroups.size === 0 && <EmptyLine text="Žádné ovládací prvky" />}
        </Section>

        <Section title="Kabeláž">
          {designData.routes.map((route) => {
            const cable = catalog.cables.find(c => c.id === route.cableTypeId);
            if (!cable) return null;
            const len = (() => {
              if (route.points.length < 2) return 0;
              const normLen = polylineLength(route.points);
              const effectiveScale = designData.layers[route.layerIndex]?.scale ?? designData.scale;
              return effectiveScale ? Math.round(normalizedToMeters(normLen, effectiveScale) * 10) / 10 : Math.round(normLen * 100) / 10;
            })();
            return <QuoteLine key={route.id} modelId={cable.id} name={cable.name} qty={len} unit="m" unitPrice={cable.price_per_m} overridePrice={priceOverrides[cable.id]} overrideCost={costOverrides[cable.id]} defaultCost={cable.price_per_m * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />;
          })}
          {designData.routes.length === 0 && <EmptyLine text="Žádné trasy" />}
        </Section>

        <Section title="Příslušenství">
          {designData.accessoryItems.map(item => {
            const acc = catalog.accessories.find(a => a.id === item.accessoryId);
            if (!acc || item.quantity <= 0) return null;
            return <QuoteLine key={item.accessoryId} modelId={acc.id} name={acc.name} qty={item.quantity} unit="ks" unitPrice={acc.price} overridePrice={priceOverrides[acc.id]} overrideCost={costOverrides[acc.id]} defaultCost={acc.price * (1 - DEFAULT_MARGIN)} onOverride={handlePriceOverride} onCostOverride={handleCostOverride} />;
          })}
          {designData.accessoryItems.length === 0 && <EmptyLine text="Žádné příslušenství" />}
        </Section>

        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Wrench className="w-4 h-4 text-slate-400" /> Práce a montáž
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">Popis prací</label>
            <textarea
              value={laborDescription}
              onChange={e => updateQuoteConfig({ laborDescription: e.target.value })}
              rows={2}
              placeholder="Např. montáž EPS/EZS systému, zapojování, programování, zprovoznění…"
              className="w-full px-3 py-2 text-xs bg-white/[0.06] border border-white/[0.08] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500/40 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">Cena prodeje</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={laborSellPrice}
                  onChange={e => updateQuoteConfig({ laborSellPrice: parseFloat(e.target.value) || 0, laborCost: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-red-500/50"
                  placeholder="0"
                />
                <span className="text-xs font-bold text-slate-500 shrink-0">Kč</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">Náklad (interní)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={laborCostPrice}
                  onChange={e => updateQuoteConfig({ laborCostPrice: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-slate-500/50"
                  placeholder="0"
                />
                <span className="text-xs font-bold text-slate-500 shrink-0">Kč</span>
              </div>
            </div>
          </div>

          {laborSellPrice > 0 && (
            <div className="flex items-center gap-4 px-3 py-2 bg-white/[0.03] rounded-lg text-xs">
              <span className="text-slate-400">Zisk z montáže:</span>
              <span className={`font-extrabold ${laborSellPrice - laborCostPrice >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(laborSellPrice - laborCostPrice).toLocaleString('cs-CZ')} Kč
              </span>
              <span className="text-slate-500 ml-auto">
                {Math.round(((laborSellPrice - laborCostPrice) / laborSellPrice) * 100)} % marže
              </span>
            </div>
          )}
        </div>

        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Plus className="w-4 h-4 text-slate-400" /> Vlastní položky
            </div>
            <button onClick={handleAddCustomItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs font-bold text-slate-300 hover:bg-white/[0.1] transition">
              <Plus className="w-3 h-3" /> Přidat
            </button>
          </div>
          {customItems.length > 0 && (
            <div className="grid grid-cols-[1fr_48px_80px_80px_28px] gap-2 text-[10px] text-slate-600 font-bold uppercase px-1">
              <span>Název</span>
              <span className="text-center">Mn.</span>
              <span className="text-right">Prodej/ks</span>
              <span className="text-right">Náklad/ks</span>
              <span />
            </div>
          )}
          {customItems.map(item => (
            <div key={item.id} className="grid grid-cols-[1fr_48px_80px_80px_28px] gap-2 items-center">
              <input
                value={item.name}
                onChange={e => handleUpdateCustomItem(item.id, 'name', e.target.value)}
                placeholder="Název"
                className="px-3 py-2 text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg text-white focus:outline-none"
              />
              <input
                type="number"
                value={item.qty}
                onChange={e => handleUpdateCustomItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                className="px-2 py-2 text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg text-white text-center focus:outline-none"
              />
              <input
                type="number"
                value={item.unitPrice}
                onChange={e => handleUpdateCustomItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="px-2 py-2 text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg text-white text-right focus:outline-none"
                placeholder="Prodej"
                title="Cena prodeje"
              />
              <input
                type="number"
                value={item.costPrice ?? 0}
                onChange={e => handleUpdateCustomItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)}
                className="px-2 py-2 text-xs bg-white/[0.06] border border-slate-600/40 rounded-lg text-slate-400 text-right focus:outline-none"
                placeholder="Náklad"
                title="Náklad (interní)"
              />
              <button onClick={() => handleDeleteCustomItem(item.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Percent className="w-4 h-4 text-slate-400" /> Sleva a DPH
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-400 w-32">Sleva</label>
            <input
              type="number"
              value={globalDiscount}
              onChange={e => updateQuoteConfig({ globalDiscountPct: parseFloat(e.target.value) || 0 })}
              min={0}
              max={100}
              className="w-20 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-center focus:outline-none focus:border-red-500/50"
            />
            <span className="text-xs font-bold text-slate-500">%</span>
            {discountAmount > 0 && (
              <span className="text-xs font-bold text-emerald-400">-{discountAmount.toLocaleString('cs-CZ')} Kč</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-400 w-32">DPH</label>
            <input
              type="number"
              value={vatPct}
              onChange={e => updateQuoteConfig({ vatPct: parseFloat(e.target.value) || 0 })}
              min={0}
              max={100}
              className="w-20 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-center focus:outline-none focus:border-red-500/50"
            />
            <span className="text-xs font-bold text-slate-500">%</span>
            {vatAmount > 0 && (
              <span className="text-xs font-bold text-amber-400">+{vatAmount.toLocaleString('cs-CZ')} Kč DPH</span>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl border border-red-500/20 p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Cena bez DPH</div>
              <div className="text-xl font-extrabold text-slate-300 mt-1">{priceBeforeVat.toLocaleString('cs-CZ')} Kč</div>
              {vatPct > 0 && (
                <div className="text-xs text-slate-500 mt-1">DPH {vatPct}%: +{vatAmount.toLocaleString('cs-CZ')} Kč</div>
              )}
              <div className="text-xs font-bold text-slate-400 uppercase mt-3">Celkem včetně DPH</div>
              <div className="text-3xl font-extrabold text-white mt-1">{grandTotal.toLocaleString('cs-CZ')} Kč</div>
              {globalDiscount > 0 && (
                <div className="text-xs text-slate-500 mt-1">mezisouček: {subtotal.toLocaleString('cs-CZ')} Kč</div>
              )}
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-slate-400">{designData.detectors.length} detektorů</div>
              <div className="text-xs text-slate-400">{designData.panels.length} ústředna</div>
              <div className="text-xs text-slate-400">{designData.sirens.length} sirén</div>
              <div className="text-xs text-slate-400">{(designData.motionSensors ?? []).length} pohybových čidel</div>
              <div className="text-xs text-slate-400">{(designData.keypads ?? []).length} klávesnic</div>
              <div className="text-xs text-slate-400">{(designData.controlDevices ?? []).length} ovládacích prvků</div>
              <div className="text-xs text-slate-400">{cableLen} m kabeláže</div>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Ziskovost nabídky
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Interní přehled — nezobrazuje se v PDF</div>
          <div className="grid grid-cols-3 gap-3">
            <ProfitCard label="Cena (bez DPH)" value={priceBeforeVat} color="text-white" suffix="Kč" />
            <ProfitCard label="Celkový náklad" value={totalCost} color="text-slate-300" suffix="Kč" />
            <ProfitCard
              label="Hrubý zisk"
              value={grossProfit}
              color={grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}
              suffix="Kč"
            />
          </div>
          <div className="flex items-center justify-between mt-2 px-3 py-2.5 bg-white/[0.03] rounded-xl">
            <span className="text-xs font-bold text-slate-400">Marže</span>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${marginPct >= 30 ? 'bg-emerald-500' : marginPct >= 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.max(0, Math.min(100, marginPct))}%` }}
                />
              </div>
              <span className={`text-sm font-extrabold ${marginPct >= 30 ? 'text-emerald-400' : marginPct >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                {marginPct} %
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            Náklady jsou odvozené ze skladových/nákupních cen. Kliknutím na náklad u položky je můžete upravit.
          </div>
        </div>

        <button
          onClick={() => setShowSaveModal(true)}
          className="w-full py-3.5 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700 transition flex items-center justify-center gap-2"
        >
          <FileDown className="w-4 h-4" /> Uložit jako nabídku projektu
        </button>
      </div>

      <SaveQuoteModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        projectId={projectId!}
        sections={buildQuoteSections()}
        globalDiscount={globalDiscount}
        sourceType="eps"
        sourceMeta={{ sourceType: 'eps', epsDesignId: design?.id }}
        summaries={[{
          type: 'eps',
          data: {
            'Detektory': designData.detectors.length,
            'Ústředny': designData.panels.length,
            'Sirény': designData.sirens.length,
            'Pohyb. čidla': (designData.motionSensors ?? []).length,
            'Klávesnice': (designData.keypads ?? []).length,
            'Kabeláž': `${cableLen} m`,
          },
        }]}
        onSaved={() => {
          toast('Nabídka uložena do projektu');
          navigate(`/projekty/${projectId}`);
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.06]">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">{title}</h3>
      </div>
      <div>
        <div className="grid grid-cols-[1fr_56px_100px_80px_100px_28px] gap-1 px-5 py-1.5 border-b border-white/[0.04]">
          <span className="text-[9px] font-bold text-slate-600 uppercase">Položka</span>
          <span className="text-[9px] font-bold text-slate-600 uppercase text-center">Mn.</span>
          <span className="text-[9px] font-bold text-slate-600 uppercase text-right">Prodej/j.</span>
          <span className="text-[9px] font-bold text-slate-600 uppercase text-right">Náklad/j.</span>
          <span className="text-[9px] font-bold text-slate-600 uppercase text-right">Celkem</span>
          <span />
        </div>
        <div className="divide-y divide-white/[0.04]">{children}</div>
      </div>
    </div>
  );
}

function QuoteLine({ modelId, name, qty, unit, unitPrice, overridePrice, overrideCost, defaultCost, onOverride, onCostOverride }: {
  modelId: string; name: string; qty: number; unit: string; unitPrice: number;
  overridePrice?: number; overrideCost?: number; defaultCost: number;
  onOverride: (id: string, val: number | null) => void;
  onCostOverride: (id: string, val: number | null) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [costDraft, setCostDraft] = useState('');
  const effectivePrice = overridePrice ?? unitPrice;
  const effectiveCost = overrideCost ?? defaultCost;
  const total = Math.round(qty * effectivePrice);
  const isPriceOverridden = overridePrice !== undefined;
  const isCostOverridden = overrideCost !== undefined;

  const startEditPrice = () => { setPriceDraft(String(effectivePrice)); setEditingPrice(true); };
  const startEditCost = () => { setCostDraft(String(Math.round(effectiveCost))); setEditingCost(true); };

  const commitPrice = () => {
    const val = parseFloat(priceDraft);
    if (!isNaN(val) && val !== unitPrice) onOverride(modelId, val);
    else if (!isNaN(val) && val === unitPrice) onOverride(modelId, null);
    setEditingPrice(false);
  };

  const commitCost = () => {
    const val = parseFloat(costDraft);
    if (!isNaN(val)) onCostOverride(modelId, val);
    setEditingCost(false);
  };

  return (
    <div className="grid grid-cols-[1fr_56px_100px_80px_100px_28px] gap-1 items-center px-5 py-2.5 group hover:bg-white/[0.02]">
      <div className="text-xs font-bold text-white truncate min-w-0">{name}</div>
      <div className="text-xs text-slate-400 font-medium text-center shrink-0">{qty} {unit}</div>

      {editingPrice ? (
        <input autoFocus type="number" value={priceDraft} onChange={e => setPriceDraft(e.target.value)}
          onBlur={commitPrice} onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false); }}
          className="px-2 py-1 text-xs bg-white/[0.1] border border-red-500/50 rounded-lg text-white text-right focus:outline-none w-full"
        />
      ) : (
        <button onClick={startEditPrice}
          className={`text-xs text-right px-2 py-1 rounded-lg transition hover:bg-white/[0.06] w-full ${isPriceOverridden ? 'text-amber-400 font-bold' : 'text-slate-300 font-medium group-hover:text-white'}`}
          title="Kliknutím upravit prodejní cenu"
        >
          {effectivePrice.toLocaleString('cs-CZ')} Kč
          {isPriceOverridden && (
            <span className="ml-1 text-[9px] text-slate-500 line-through">{unitPrice.toLocaleString('cs-CZ')}</span>
          )}
        </button>
      )}

      {editingCost ? (
        <input autoFocus type="number" value={costDraft} onChange={e => setCostDraft(e.target.value)}
          onBlur={commitCost} onKeyDown={e => { if (e.key === 'Enter') commitCost(); if (e.key === 'Escape') setEditingCost(false); }}
          className="px-2 py-1 text-xs bg-white/[0.08] border border-slate-500/40 rounded-lg text-slate-400 text-right focus:outline-none w-full"
        />
      ) : (
        <button onClick={startEditCost}
          className={`text-xs text-right px-2 py-1 rounded-lg transition hover:bg-white/[0.04] w-full ${isCostOverridden ? 'text-sky-400 font-bold' : 'text-slate-600 font-medium group-hover:text-slate-500'}`}
          title="Kliknutím upravit nákladovou cenu"
        >
          {Math.round(effectiveCost).toLocaleString('cs-CZ')} Kč
        </button>
      )}

      <div className="text-xs font-extrabold text-white text-right shrink-0">{total.toLocaleString('cs-CZ')} Kč</div>

      <div className="flex items-center justify-end">
        {(isPriceOverridden || isCostOverridden) && (
          <button
            onClick={() => { onOverride(modelId, null); onCostOverride(modelId, null); }}
            className="text-slate-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100 p-0.5"
            title="Obnovit původní ceny"
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ProfitCard({ label, value, color, suffix }: { label: string; value: number; color: string; suffix: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/[0.05]">
      <div className={`text-lg font-extrabold ${color}`}>{value.toLocaleString('cs-CZ')} {suffix}</div>
      <div className="text-[9px] font-bold text-slate-600 uppercase mt-0.5">{label}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="px-5 py-3 text-xs text-slate-500 italic">{text}</div>;
}
