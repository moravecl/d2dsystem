import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Monitor, Network, Cable, Package, HardDrive, Percent, Plus, Trash2, PenLine, FileDown, Calculator, List, ChevronDown, ChevronUp, Wrench, CreditCard as Edit2, Save, Layers, Printer, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCameraCatalog } from '../../hooks/useCameraCatalog';
import { useCameraDesign } from '../../hooks/useCameraDesign';
import type { CameraQuoteConfig, CameraCustomItem } from '../../hooks/useCameraDesign';
import type { CameraCatalogData } from '../../hooks/useCameraCatalog';
import { calculateStorage, calcTotalPoePowerW } from '../../lib/cameraCalculations';
import { polylineLength, normalizedToMeters } from '../../components/catalog/floorplan/geometry';
import { metersPerPixelAtZoom } from '../../components/camera/CameraCanvas';
import type { QuoteSection } from '../../components/catalog/quoteHelpers';
import { exportCameraQuotePdf } from '../../components/camera/cameraQuotePdfExport';
import { useToast } from '../../components/ui/Toast';
import SaveQuoteModal from '../../components/catalog/SaveQuoteModal';
import { loadQuoteClientInfo, loadQuoteCompanyInfo, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';

interface QuoteLineItem {
  key: string;
  category: string;
  categoryIcon: typeof Camera;
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  totalPrice: number;
  isCustom?: boolean;
  imageUrl?: string | null;
  capacityTb?: number;
}

const CAT_LABELS: Record<string, string> = {
  cameras: 'Kamery',
  nvrs: 'NVR záznamníky',
  switches: 'PoE switche',
  cabling: 'Kabeláž',
  storage: 'Úložiště / HDD',
  accessories: 'Příslušenství',
  labor: 'Montážní práce',
  custom: 'Vlastní položky',
};

const CAT_ICONS: Record<string, typeof Camera> = {
  cameras: Camera,
  nvrs: Monitor,
  switches: Network,
  cabling: Cable,
  storage: HardDrive,
  accessories: Package,
  labor: Wrench,
  custom: PenLine,
};

function useRouteLengths(
  designData: ReturnType<typeof useCameraDesign>['design']
) {
  return useMemo(() => {
    if (!designData?.design_data) return { getRouteLengthM: () => 0, totalCableLengthM: 0 };

    const dd = designData.design_data;
    const mapLayer = dd.layers.find(l => l.type === 'map' && l.mapCenter && l.mapZoom);
    const mapScale = mapLayer?.mapCenter && mapLayer?.mapZoom
      ? { metersPerPixel: metersPerPixelAtZoom(mapLayer.mapCenter.lat, mapLayer.mapZoom) }
      : undefined;

    const getRouteLengthM = (points: { x: number; y: number }[], layerIndex?: number): number => {
      if (points.length < 2) return 0;
      const normLen = polylineLength(points);
      const layerScale = layerIndex !== undefined ? dd.layers[layerIndex]?.scale : undefined;
      const effectiveScale = layerScale ?? dd.scale;
      if (effectiveScale) return normalizedToMeters(normLen, effectiveScale);
      if (mapScale) return normLen * 1000 * mapScale.metersPerPixel;
      return 0;
    };

    const totalCableLengthM = dd.routes.reduce((sum, r) => sum + getRouteLengthM(r.points, r.layerIndex), 0);

    return { getRouteLengthM, totalCableLengthM };
  }, [designData]);
}

function useQuoteLines(
  design: ReturnType<typeof useCameraDesign>['design'],
  catalog: CameraCatalogData,
  getRouteLengthM: (points: { x: number; y: number }[], layerIndex?: number) => number,
  quoteConfig: CameraQuoteConfig
): QuoteLineItem[] {
  return useMemo(() => {
    if (!design?.design_data) return [];
    const dd = design.design_data;
    const items: QuoteLineItem[] = [];

    const camGroups = new Map<string, number>();
    dd.cameras.forEach(cam => {
      camGroups.set(cam.modelId, (camGroups.get(cam.modelId) ?? 0) + 1);
    });
    camGroups.forEach((count, modelId) => {
      const model = catalog.cameras.find(m => m.id === modelId);
      if (!model) return;
      items.push({
        key: `cam-${modelId}`, category: 'cameras', categoryIcon: Camera,
        name: `${model.name} (${model.resolution_label}, ${model.camera_type})`,
        qty: count, unit: 'ks',
        unitCost: model.purchase_price || model.price * 0.7, unitPrice: model.price, totalPrice: model.price * count,
        imageUrl: model.image_url,
      });
    });

    dd.nvrs.forEach(nvr => {
      const model = catalog.nvrs.find(n => n.id === nvr.nvrId);
      if (!model) return;
      items.push({
        key: `nvr-${nvr.id}`, category: 'nvrs', categoryIcon: Monitor,
        name: `${model.name} (${model.channels}ch, ${model.poe_ports} PoE)`,
        qty: 1, unit: 'ks',
        unitCost: model.purchase_price || model.price * 0.7, unitPrice: model.price, totalPrice: model.price,
        imageUrl: model.image_url,
      });
    });

    dd.switches.forEach(sw => {
      const model = catalog.poeSwitches.find(s => s.id === sw.switchId);
      if (!model) return;
      items.push({
        key: `sw-${sw.id}`, category: 'switches', categoryIcon: Network,
        name: `${model.name} (${model.poe_ports} PoE, ${model.poe_budget_w}W)`,
        qty: 1, unit: 'ks',
        unitCost: model.purchase_price || model.price * 0.7, unitPrice: model.price, totalPrice: model.price,
        imageUrl: model.image_url,
      });
    });

    const cableGroups = new Map<string, { cable: (typeof catalog.cables)[0]; totalM: number }>();
    dd.routes.forEach(route => {
      if (route.points.length < 2) return;
      const cable = catalog.cables.find(c => c.id === route.cableTypeId);
      if (!cable) return;
      const len = getRouteLengthM(route.points, route.layerIndex);
      const existing = cableGroups.get(cable.id);
      if (existing) existing.totalM += len;
      else cableGroups.set(cable.id, { cable, totalM: len });
    });
    cableGroups.forEach(({ cable, totalM }) => {
      const roundedM = Math.ceil(totalM);
      items.push({
        key: `cable-${cable.id}`, category: 'cabling', categoryIcon: Cable,
        name: `${cable.name} (${cable.cable_type.replace('_', ' ').toUpperCase()})`,
        qty: roundedM, unit: 'm',
        unitCost: cable.purchase_price_per_m || cable.price_per_m * 0.7, unitPrice: cable.price_per_m, totalPrice: cable.price_per_m * roundedM,
      });
    });

    const storage = calculateStorage(dd.cameras, catalog.cameras, dd.storageConfig);

    const manualHddItems = dd.accessoryItems.filter(ai => {
      const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
      return acc?.accessory_type === 'hdd' && ai.quantity > 0;
    });

    if (manualHddItems.length > 0) {
      manualHddItems.forEach(ai => {
        const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
        if (!acc) return;
        items.push({
          key: `hdd-manual-${ai.accessoryId}`, category: 'storage', categoryIcon: HardDrive,
          name: `${acc.name}${acc.capacity_tb ? ` (${acc.capacity_tb} TB)` : ''}`,
          qty: ai.quantity, unit: 'ks',
          unitCost: acc.purchase_price || acc.price * 0.7, unitPrice: acc.price, totalPrice: acc.price * ai.quantity,
          imageUrl: acc.image_url,
          capacityTb: acc.capacity_tb ?? 0,
        });
      });
    } else {
      const hddAccessories = catalog.accessories.filter(a => a.accessory_type === 'hdd');
      if (hddAccessories.length > 0 && storage.recommendedHddCount > 0) {
        const bestHdd = hddAccessories
          .filter(h => (h.capacity_tb ?? 0) >= storage.recommendedHddSizeTb)
          .sort((a, b) => (a.capacity_tb ?? 0) - (b.capacity_tb ?? 0))[0]
          ?? hddAccessories.sort((a, b) => (b.capacity_tb ?? 0) - (a.capacity_tb ?? 0))[0];
        if (bestHdd) {
          items.push({
            key: `hdd-${bestHdd.id}`, category: 'storage', categoryIcon: HardDrive,
            name: `${bestHdd.name}${bestHdd.capacity_tb ? ` (${bestHdd.capacity_tb} TB)` : ''}`,
            qty: storage.recommendedHddCount, unit: 'ks',
            unitCost: bestHdd.purchase_price || bestHdd.price * 0.7, unitPrice: bestHdd.price, totalPrice: bestHdd.price * storage.recommendedHddCount,
            imageUrl: bestHdd.image_url,
            capacityTb: bestHdd.capacity_tb ?? 0,
          });
        }
      }
    }

    dd.accessoryItems.forEach(ai => {
      const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
      if (!acc || ai.quantity === 0) return;
      if (acc.accessory_type === 'hdd') return;
      items.push({
        key: `acc-${ai.accessoryId}`, category: 'accessories', categoryIcon: Package,
        name: acc.name, qty: ai.quantity, unit: 'ks',
        unitCost: acc.purchase_price || acc.price * 0.7, unitPrice: acc.price, totalPrice: acc.price * ai.quantity,
        imageUrl: acc.image_url,
      });
    });

    const laborTotal = quoteConfig.laborOverride !== undefined && quoteConfig.laborOverride !== null
      ? quoteConfig.laborOverride
      : (quoteConfig.laborCost ?? 0);
    if (laborTotal > 0) {
      items.push({
        key: 'labor', category: 'labor', categoryIcon: Wrench,
        name: 'Montáž, konfigurace, zprovoznění', qty: 1, unit: 'paušál',
        unitCost: laborTotal * 0.6, unitPrice: laborTotal, totalPrice: laborTotal,
      });
    }

    (quoteConfig.customItems ?? []).forEach(ci => {
      if (ci.qty <= 0) return;
      items.push({
        key: `custom-${ci.id}`, category: 'custom', categoryIcon: PenLine,
        name: ci.name || 'Vlastní položka', qty: ci.qty, unit: ci.unit,
        unitCost: ci.unitPrice * 0.7, unitPrice: ci.unitPrice, totalPrice: ci.unitPrice * ci.qty,
        isCustom: true,
      });
    });

    return items;
  }, [design, catalog, getRouteLengthM, quoteConfig]);
}

function useQuoteCategories(lines: QuoteLineItem[]) {
  return useMemo(() => {
    const map = new Map<string, { icon: typeof Camera; label: string; items: QuoteLineItem[] }>();
    for (const line of lines) {
      if (!map.has(line.category)) {
        map.set(line.category, {
          icon: CAT_ICONS[line.category] ?? Package,
          label: CAT_LABELS[line.category] ?? line.category,
          items: [],
        });
      }
      map.get(line.category)!.items.push(line);
    }
    return Array.from(map.entries());
  }, [lines]);
}

export default function CameraQuotePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const catalog = useCameraCatalog();
  const { design, loading, saving, updateDesignData, saveDesign } = useCameraDesign(projectId);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [editingLabor, setEditingLabor] = useState(false);
  const [projectName, setProjectName] = useState('Projekt');
  const [showImages, setShowImages] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [quoteClient, setQuoteClient] = useState<QuoteClientInfo | null>(null);
  const [quoteCompany, setQuoteCompany] = useState<QuoteCompanyInfo | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('name').eq('id', projectId).maybeSingle().then(({ data }) => {
      if (data?.name) setProjectName(data.name);
    });
    loadQuoteClientInfo(projectId).then(setQuoteClient);
    loadQuoteCompanyInfo().then(setQuoteCompany);
  }, [projectId]);

  const dd = design?.design_data;
  const qc: CameraQuoteConfig = dd?.quoteConfig ?? {};

  const quoteMode = qc.quoteMode ?? 'itemized';
  const itemDiscounts = qc.itemDiscounts ?? {};
  const globalDiscountPct = qc.globalDiscountPct ?? 0;
  const vatRate = qc.vatRate ?? 21;
  const customItems = qc.customItems ?? [];

  const updateQuoteConfig = useCallback((patch: Partial<CameraQuoteConfig>) => {
    updateDesignData(prev => ({
      ...prev,
      quoteConfig: { ...(prev.quoteConfig ?? {}), ...patch },
    }));
  }, [updateDesignData]);

  const { getRouteLengthM, totalCableLengthM } = useRouteLengths(design);
  const lines = useQuoteLines(design, catalog, getRouteLengthM, qc);
  const categories = useQuoteCategories(lines);

  const effectiveLabor = qc.laborOverride !== undefined && qc.laborOverride !== null
    ? qc.laborOverride
    : (qc.laborCost ?? 0);

  const getItemDiscount = (key: string): number => itemDiscounts[key] ?? 0;

  const setItemDiscount = (key: string, pct: number) => {
    const next = { ...itemDiscounts, [key]: Math.max(0, Math.min(100, pct)) };
    if (pct === 0) delete next[key];
    updateQuoteConfig({ itemDiscounts: next });
  };

  const setGlobalDiscount = (pct: number) => {
    updateQuoteConfig({ globalDiscountPct: Math.max(0, Math.min(100, pct)) });
  };

  const setMode = (mode: 'itemized' | 'total') => {
    updateQuoteConfig({ quoteMode: mode });
  };

  const computeDiscountedPrice = (item: QuoteLineItem): number => {
    const itemDisc = getItemDiscount(item.key);
    const afterItemDisc = item.totalPrice * (1 - itemDisc / 100);
    return afterItemDisc * (1 - globalDiscountPct / 100);
  };

  const addCustomItem = () => {
    const next: CameraCustomItem[] = [...customItems, { id: crypto.randomUUID(), name: '', qty: 1, unit: 'ks', unitPrice: 0 }];
    updateQuoteConfig({ customItems: next });
  };

  const updateCustomItem = (id: string, patch: Partial<CameraCustomItem>) => {
    const next = customItems.map(ci => ci.id === id ? { ...ci, ...patch } : ci);
    updateQuoteConfig({ customItems: next });
  };

  const removeCustomItem = (id: string) => {
    updateQuoteConfig({ customItems: customItems.filter(ci => ci.id !== id) });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat); else n.add(cat);
      return n;
    });
  };

  const totalBeforeDiscount = lines.reduce((s, l) => s + l.totalPrice, 0);
  const totalAfterDiscount = lines.reduce((s, l) => s + computeDiscountedPrice(l), 0);
  const totalCost = lines.reduce((s, l) => s + l.unitCost * l.qty, 0);
  const totalProfit = totalAfterDiscount - totalCost;
  const profitMarginPct = totalAfterDiscount > 0 ? Math.round((totalProfit / totalAfterDiscount) * 100) : 0;

  const storage = dd ? calculateStorage(dd.cameras, catalog.cameras, dd.storageConfig) : null;
  const totalPoe = dd ? calcTotalPoePowerW(dd.cameras, catalog.cameras) : 0;
  const hddTotalTb = lines.filter(l => l.category === 'storage').reduce((sum, l) => sum + l.qty * (l.capacityTb ?? 0), 0);
  const hddDetail = lines.find(l => l.category === 'storage' && (l.capacityTb ?? 0) > 0);
  const hddBubbleValue = hddTotalTb > 0 ? hddTotalTb : (storage?.recommendedHddCount ?? 1) * (storage?.recommendedHddSizeTb ?? 0);
  const hddBubbleDetail = hddDetail ? `${hddDetail.qty}x${hddDetail.capacityTb}TB` : (storage ? `${storage.recommendedHddCount}x${storage.recommendedHddSizeTb}TB` : undefined);

  const buildQuoteSections = (): QuoteSection[] => {
    const items = lines.map(line => {
      const disc = getItemDiscount(line.key);
      const discPrice = line.unitPrice * (1 - disc / 100) * (1 - globalDiscountPct / 100);
      return {
        id: crypto.randomUUID(), code: '', name: line.name, unit: line.unit,
        quantity: line.qty, sellingPrice: Math.round(discPrice * 100) / 100, costPrice: line.unitCost,
      };
    });

    return [{
      id: crypto.randomUUID(), name: 'Kamerový systém', trade: 'camera', icon: 'camera', items,
    }];
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!dd || exportingPdf) return;
    setExportingPdf(true);
    const pdfLines = lines.map(line => ({
      category: line.category,
      name: line.name,
      qty: line.qty,
      unit: line.unit,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
      discountedTotal: computeDiscountedPrice(line),
      imageUrl: line.imageUrl,
      capacityTb: line.capacityTb,
    }));
    await exportCameraQuotePdf({
      projectName,
      designData: dd,
      catalog,
      quoteConfig: qc,
      lines: pdfLines,
      totalBeforeDiscount,
      totalAfterDiscount,
      vatRate,
      quoteMode,
      showImages,
      client: quoteClient,
      company: quoteCompany,
    });
    setExportingPdf(false);
  };

  if (loading || catalog.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white/[0.04]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!dd || dd.cameras.length === 0) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex flex-col">
        <header className="flex items-center gap-3 px-6 py-4 bg-navy-800/60 border-b border-white/[0.08]">
          <button onClick={() => navigate(`/projekty/${projectId}/kamerovy-system`)} className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Camera className="w-5 h-5 text-blue-500" />
          <h1 className="text-sm font-extrabold text-white">Kalkulace kamerového systému</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-extrabold text-slate-300 mb-1">Žádné kamery v návrhu</h3>
            <p className="text-xs text-slate-400">Nejdříve umístěte kamery v kamerovém designéru.</p>
            <button
              onClick={() => navigate(`/projekty/${projectId}/kamerovy-system`)}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-700 transition"
            >
              Zpět na designer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white/[0.04] flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 bg-navy-800/60 border-b border-white/[0.08] sticky top-0 z-30">
        <button onClick={() => navigate(`/projekty/${projectId}/kamerovy-system`)} className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-500" />
          <h1 className="text-sm font-extrabold text-white">Kalkulace kamerového systému</h1>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-2" />}
        <div className="flex-1" />
        <button
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] text-slate-300 rounded-xl text-xs font-extrabold hover:bg-white/[0.08] transition disabled:opacity-60 disabled:cursor-wait"
        >
          {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          {exportingPdf ? 'Generuji PDF...' : 'Export PDF'}
        </button>
        <button
          onClick={() => saveDesign()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-700 transition"
        >
          <Save className="w-3.5 h-3.5" /> Uložit
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="grid grid-cols-5 gap-3">
            <StatCard label="Kamery" value={dd.cameras.length} suffix="ks" color="blue" icon={Camera} />
            <StatCard label="Kabeláž" value={Math.round(totalCableLengthM)} suffix="m" color="emerald" icon={Cable} />
            <StatCard label="PoE příkon" value={Math.round(totalPoe)} suffix="W" color="amber" icon={Network} />
            <StatCard
              label="Úložiště"
              value={hddBubbleValue > 0 ? hddBubbleValue.toString() : '0'}
              suffix="TB"
              color="slate"
              icon={HardDrive}
              detail={hddBubbleDetail}
            />
            <StatCard
              label="Celkem"
              value={Math.round(totalAfterDiscount).toLocaleString('cs-CZ')}
              suffix="Kč"
              color="blue"
              icon={Calculator}
              highlight
            />
          </div>

          <LayerPreviewSection designData={dd} catalog={catalog} />

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.06] p-0.5 gap-0.5">
                <button
                  onClick={() => setMode('itemized')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-extrabold transition ${
                    quoteMode === 'itemized' ? 'bg-white/[0.06] text-blue-400 ' : 'text-slate-400 hover:text-slate-400'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Položková nabídka
                </button>
                <button
                  onClick={() => setMode('total')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-extrabold transition ${
                    quoteMode === 'total' ? 'bg-white/[0.06] text-blue-400 ' : 'text-slate-400 hover:text-slate-400'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" /> Celková cena
                </button>
              </div>

              <div className="bg-slate-900 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    {quoteMode === 'itemized' ? 'Položková cenová nabídka' : 'Cenová nabídka'}
                  </div>
                  <button
                    onClick={() => setShowImages(!showImages)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition ${
                      showImages ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span className="text-[10px] font-extrabold">Obrázky</span>
                  </button>
                  <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
                    <Percent className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-extrabold text-slate-400">Sleva</span>
                    <input
                      type="number" min="0" max="100" value={globalDiscountPct}
                      onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                      className="w-12 bg-transparent text-sm font-extrabold text-blue-400 text-right focus:outline-none"
                    />
                    <span className="text-[10px] font-extrabold text-slate-500">%</span>
                  </div>
                </div>

                <div className="px-5 py-3">
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
                      showImages={showImages}
                    />
                  ) : (
                    <TotalView categories={categories} showImages={showImages} />
                  )}

                  <div className="border-t border-slate-700 pt-4 mt-4 space-y-2">
                    {totalBeforeDiscount !== totalAfterDiscount && (
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-slate-500">Před slevou</span>
                        <span className="font-extrabold text-slate-500 line-through">{totalBeforeDiscount.toLocaleString('cs-CZ')} Kč</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="font-extrabold text-slate-300">Celkem bez DPH</span>
                      <span className="font-extrabold text-white text-lg">{Math.round(totalAfterDiscount).toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-500">DPH</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={vatRate}
                          onChange={(e) => updateQuoteConfig({ vatRate: Math.max(0, Math.min(100, Number(e.target.value))) })}
                          className="w-10 bg-slate-700 text-slate-200 text-xs font-extrabold text-center rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="font-extrabold text-slate-500">%</span>
                      </div>
                      <span className="font-extrabold text-slate-400">{Math.round(totalAfterDiscount * (vatRate / 100)).toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                      <span className="font-extrabold text-slate-200">Celkem s DPH</span>
                      <span className="font-extrabold text-blue-400 text-lg">{Math.round(totalAfterDiscount * (1 + vatRate / 100)).toLocaleString('cs-CZ')} Kč</span>
                    </div>
                  </div>
                </div>
              </div>

              <LaborSection
                effectiveLabor={effectiveLabor}
                editingLabor={editingLabor}
                setEditingLabor={setEditingLabor}
                quoteConfig={qc}
                updateQuoteConfig={updateQuoteConfig}
              />

              <CustomItemsSection
                customItems={customItems}
                addCustomItem={addCustomItem}
                updateCustomItem={updateCustomItem}
                removeCustomItem={removeCustomItem}
              />

              <button
                onClick={() => setShowSaveModal(true)}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <FileDown className="w-4 h-4" /> Uložit jako nabídku projektu
              </button>
            </div>

            <div className="space-y-4">
              <ProfitCard totalProfit={totalProfit} profitMarginPct={profitMarginPct} totalCost={totalCost} />
              <SystemOverview dd={dd} catalog={catalog} storage={storage} totalPoe={totalPoe} totalCableLengthM={totalCableLengthM} />
            </div>
          </div>
        </div>
      </div>

      <SaveQuoteModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        projectId={projectId!}
        sections={buildQuoteSections()}
        sourceType="camera"
        sourceMeta={{ sourceType: 'camera', cameraDesignId: design?.id }}
        summaries={dd ? [{
          type: 'camera',
          data: {
            'Kamery': dd.cameras.length,
            'NVR': dd.nvrs.length,
            'Switche': dd.switches.length,
            'Kabeláž': `${Math.round(totalCableLengthM)} m`,
            'PoE': `${Math.round(totalPoe)} W`,
          },
        }] : []}
        onSaved={() => {
          toast('Nabídka uložena do projektu');
          navigate(`/projekty/${projectId}`);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, suffix, color, icon: Icon, detail, highlight }: {
  label: string; value: string | number; suffix: string; color: string; icon: typeof Camera; detail?: string; highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: highlight ? 'bg-blue-600 text-white' : 'bg-blue-500/10',
    emerald: 'bg-emerald-500/10',
    amber: 'bg-amber-500/10',
    slate: 'bg-white/[0.06]',
  };
  const textMap: Record<string, string> = {
    blue: highlight ? 'text-white' : 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-300',
  };
  const labelMap: Record<string, string> = {
    blue: highlight ? 'text-blue-200' : 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-500',
  };

  return (
    <div className={`${colorMap[color] ?? 'bg-white/[0.06]'} rounded-xl p-4`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${labelMap[color] ?? 'text-slate-500'}`} />
        <div className={`text-[9px] font-extrabold uppercase tracking-widest ${labelMap[color] ?? 'text-slate-500'}`}>{label}</div>
      </div>
      <div className={`text-xl font-extrabold ${textMap[color] ?? 'text-slate-300'}`}>
        {value} <span className="text-sm font-bold">{suffix}</span>
      </div>
      {detail && <div className={`text-[10px] font-bold mt-0.5 ${labelMap[color] ?? 'text-slate-400'}`}>{detail}</div>}
    </div>
  );
}

function ProfitCard({ totalProfit, profitMarginPct, totalCost }: {
  totalProfit: number; profitMarginPct: number; totalCost: number;
}) {
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Ziskovost</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Nákladová cena</span>
          <span className="text-xs font-extrabold text-slate-300">{Math.round(totalCost).toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Zisk</span>
          <span className={`text-sm font-extrabold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Math.round(totalProfit).toLocaleString('cs-CZ')} Kč
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Marže</span>
          <span className={`text-sm font-extrabold ${profitMarginPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profitMarginPct}%
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${profitMarginPct >= 0 ? 'bg-emerald-500/100' : 'bg-red-500/100'}`}
            style={{ width: `${Math.max(0, Math.min(100, profitMarginPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SystemOverview({ dd, catalog, storage, totalPoe, totalCableLengthM }: {
  dd: NonNullable<ReturnType<typeof useCameraDesign>['design']>['design_data'];
  catalog: CameraCatalogData;
  storage: ReturnType<typeof calculateStorage> | null;
  totalPoe: number;
  totalCableLengthM: number;
}) {
  const camGroups = useMemo(() => {
    const groups = new Map<string, { model: (typeof catalog.cameras)[0]; count: number }>();
    dd.cameras.forEach(cam => {
      const model = catalog.cameras.find(m => m.id === cam.modelId);
      if (!model) return;
      const existing = groups.get(model.id);
      if (existing) existing.count++;
      else groups.set(model.id, { model, count: 1 });
    });
    return Array.from(groups.values());
  }, [dd.cameras, catalog.cameras]);

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Přehled systému</h3>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Kamery</div>
          {camGroups.map(g => (
            <div key={g.model.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-400 truncate flex-1">{g.model.name}</span>
              <span className="font-extrabold text-white ml-2">{g.count}x</span>
            </div>
          ))}
        </div>

        {dd.nvrs.length > 0 && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">NVR</div>
            {dd.nvrs.map(nvr => {
              const model = catalog.nvrs.find(n => n.id === nvr.nvrId);
              return model ? (
                <div key={nvr.id} className="text-xs text-slate-400 py-0.5">{model.name} ({model.channels}ch)</div>
              ) : null;
            })}
          </div>
        )}

        {dd.switches.length > 0 && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">PoE switche</div>
            {dd.switches.map(sw => {
              const model = catalog.poeSwitches.find(s => s.id === sw.switchId);
              return model ? (
                <div key={sw.id} className="text-xs text-slate-400 py-0.5">{model.name} ({model.poe_ports} PoE)</div>
              ) : null;
            })}
          </div>
        )}

        <div className="border-t border-white/[0.06] pt-2 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">PoE příkon</span>
            <span className="font-extrabold text-slate-300">{Math.round(totalPoe)} W</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Kabeláž celkem</span>
            <span className="font-extrabold text-slate-300">{Math.round(totalCableLengthM)} m</span>
          </div>
          {storage && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Úložiště ({dd.storageConfig.retentionDays}d)</span>
                <span className="font-extrabold text-slate-300">{storage.totalStorageTb} TB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Kodek</span>
                <span className="font-extrabold text-slate-300">{dd.storageConfig.codec.toUpperCase()}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LaborSection({ effectiveLabor, editingLabor, setEditingLabor, quoteConfig, updateQuoteConfig }: {
  effectiveLabor: number;
  editingLabor: boolean;
  setEditingLabor: (v: boolean) => void;
  quoteConfig: CameraQuoteConfig;
  updateQuoteConfig: (patch: Partial<CameraQuoteConfig>) => void;
}) {
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Montážní práce</h3>
        </div>
        <button
          onClick={() => setEditingLabor(!editingLabor)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/100/10 transition"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {editingLabor ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Cena montáže (Kč)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step="100" autoFocus
                value={quoteConfig.laborOverride ?? effectiveLabor}
                onChange={e => updateQuoteConfig({ laborOverride: parseFloat(e.target.value) || 0 })}
                className="flex-1 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              />
              <span className="text-xs text-slate-400">Kč</span>
            </div>
          </div>
          {quoteConfig.laborOverride !== undefined && quoteConfig.laborOverride !== null && (
            <button
              onClick={() => updateQuoteConfig({ laborOverride: null })}
              className="text-xs font-extrabold text-slate-400 hover:text-red-500 transition"
            >
              Obnovit výchozí
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Montáž, konfigurace, zprovoznění</span>
          <span className="text-sm font-extrabold text-white">{effectiveLabor.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}
    </div>
  );
}

function CustomItemsSection({ customItems, addCustomItem, updateCustomItem, removeCustomItem }: {
  customItems: CameraCustomItem[];
  addCustomItem: () => void;
  updateCustomItem: (id: string, patch: Partial<CameraCustomItem>) => void;
  removeCustomItem: (id: string) => void;
}) {
  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Vlastní položky</h3>
        </div>
        <button
          onClick={addCustomItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-xs font-extrabold text-slate-400 transition"
        >
          <Plus className="w-3 h-3" /> Přidat
        </button>
      </div>

      {customItems.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">Zatím žádné vlastní položky</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_50px_100px_32px] gap-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
            <span>Název</span>
            <span className="text-right">Počet</span>
            <span className="text-center">J.</span>
            <span className="text-right">Cena/ks</span>
            <span />
          </div>
          {customItems.map(ci => (
            <div key={ci.id} className="grid grid-cols-[1fr_80px_50px_100px_32px] gap-2 items-center">
              <input
                className="text-xs font-extrabold border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 transition"
                placeholder="Název položky"
                value={ci.name}
                onChange={e => updateCustomItem(ci.id, { name: e.target.value })}
              />
              <input
                type="number" min="0" step="1"
                className="text-xs font-extrabold border border-white/10 rounded-lg px-2 py-2 text-right focus:outline-none focus:border-blue-400 transition"
                value={ci.qty}
                onChange={e => updateCustomItem(ci.id, { qty: parseFloat(e.target.value) || 0 })}
              />
              <input
                className="text-xs font-extrabold border border-white/10 rounded-lg px-1.5 py-2 text-center focus:outline-none focus:border-blue-400 transition"
                value={ci.unit}
                onChange={e => updateCustomItem(ci.id, { unit: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" step="100"
                  className="w-full text-xs font-extrabold border border-white/10 rounded-lg px-2 py-2 text-right focus:outline-none focus:border-blue-400 transition"
                  value={ci.unitPrice}
                  onChange={e => updateCustomItem(ci.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <button
                onClick={() => removeCustomItem(ci.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/100/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemizedView({
  categories, expandedCategories, toggleCategory, getItemDiscount, setItemDiscount,
  editingDiscount, setEditingDiscount, computeDiscountedPrice, globalDiscountPct, showImages,
}: {
  categories: [string, { icon: typeof Camera; label: string; items: QuoteLineItem[] }][];
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  getItemDiscount: (key: string) => number;
  setItemDiscount: (key: string, pct: number) => void;
  editingDiscount: string | null;
  setEditingDiscount: (key: string | null) => void;
  computeDiscountedPrice: (item: QuoteLineItem) => number;
  globalDiscountPct: number;
  showImages: boolean;
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
              className="w-full flex items-center gap-2.5 py-2.5 px-1 hover:bg-slate-800/50 rounded-lg transition"
            >
              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs font-extrabold text-slate-300 flex-1 text-left">{cat.label}</span>
              <span className="text-[10px] font-extrabold text-slate-500 mr-2">{catQty} ks</span>
              <span className="text-xs font-extrabold text-blue-400 mr-1">
                {Math.round(catTotal).toLocaleString('cs-CZ')} Kč
              </span>
              {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
            </button>

            {isExpanded && (
              <div className="ml-7 mb-2 space-y-0.5">
                {cat.items.map(item => {
                  const disc = getItemDiscount(item.key);
                  const discPrice = computeDiscountedPrice(item);
                  const isEditing = editingDiscount === item.key;

                  return (
                    <div key={item.key} className="flex items-center gap-2 py-1.5 pl-1 pr-0.5 rounded-lg hover:bg-slate-800/30 group">
                      {showImages && item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-lg shrink-0 border border-slate-700"
                        />
                      )}
                      {showImages && !item.imageUrl && (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                          <Package className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-extrabold text-slate-400 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.qty} {item.unit} x {item.unitPrice.toLocaleString('cs-CZ')} Kč
                          {disc > 0 && <span className="text-blue-500 ml-1">(-{disc}%)</span>}
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
                              className="w-12 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-blue-400 text-right focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-[9px] text-slate-500">%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingDiscount(item.key)}
                            className={`text-[10px] font-extrabold rounded px-1.5 py-0.5 transition ${
                              disc > 0
                                ? 'text-blue-400 bg-blue-500/100/10'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-blue-400'
                            }`}
                          >
                            {disc > 0 ? `-${disc}%` : 'Sleva'}
                          </button>
                        )}
                        <span className={`text-[11px] font-extrabold w-20 text-right ${disc > 0 || globalDiscountPct > 0 ? 'text-blue-300' : 'text-slate-300'}`}>
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
  showImages,
}: {
  categories: [string, { icon: typeof Camera; label: string; items: QuoteLineItem[] }][];
  showImages: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {categories.map(([catKey, cat]) => {
        const Icon = cat.icon;
        const catQty = cat.items.reduce((s, l) => s + l.qty, 0);

        return (
          <div key={catKey}>
            <div className="flex items-center gap-2.5 py-2.5 px-1">
              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs font-extrabold text-slate-300 flex-1 text-left">{cat.label}</span>
              <span className="text-[10px] font-extrabold text-slate-500">{catQty} ks</span>
            </div>
            <div className="ml-7 mb-2 space-y-0.5">
              {cat.items.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-0.5 pl-1">
                  {showImages && item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-8 h-8 object-cover rounded-lg shrink-0 border border-slate-700"
                    />
                  )}
                  {showImages && !item.imageUrl && (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                      <Package className="w-3 h-3 text-slate-600" />
                    </div>
                  )}
                  <div className="text-[11px] font-extrabold text-slate-500 flex-1 truncate">{item.name}</div>
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

const CAMERA_TYPE_COLORS_HEX: Record<string, string> = {
  dome: '#3b82f6', bullet: '#10b981', ptz: '#f59e0b', fisheye: '#ec4899', box: '#8b5cf6',
};

function layerStringToColor(str: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function LayerPreviewSection({ designData, catalog }: {
  designData: NonNullable<ReturnType<typeof useCameraDesign>['design']>['design_data'];
  catalog: CameraCatalogData;
}) {
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const visibleLayers = designData.layers.filter(l => l.visible !== false);

  if (visibleLayers.length === 0) return null;

  const activeLayer = visibleLayers[activePreviewIdx] ?? visibleLayers[0];
  const realIdx = designData.layers.indexOf(activeLayer);

  const layerCameras = designData.cameras.filter(c => c.layerIndex === realIdx);
  const layerRoutes = designData.routes.filter(r => r.layerIndex === realIdx);
  const layerNvrs = designData.nvrs.filter(n => n.layerIndex === realIdx);
  const layerSwitches = designData.switches.filter(s => s.layerIndex === realIdx);

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Náhled vrstev</h3>
        </div>
        {visibleLayers.length > 1 && (
          <div className="flex items-center gap-1">
            {visibleLayers.map((layer, idx) => (
              <button
                key={layer.id}
                onClick={() => setActivePreviewIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition ${
                  idx === activePreviewIdx
                    ? 'bg-blue-600 text-white '
                    : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300'
                }`}
              >
                {layer.name || `Vrstva ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative bg-slate-900">
        <LayerCanvasPreview
          layer={activeLayer}
          cameras={layerCameras}
          routes={layerRoutes}
          nvrs={layerNvrs}
          switches={layerSwitches}
          catalog={catalog}
          designScale={designData.scale}
        />

        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {layerCameras.length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
              <Camera className="w-3 h-3 inline mr-1" />{layerCameras.length} kamer
            </div>
          )}
          {layerRoutes.length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
              <Cable className="w-3 h-3 inline mr-1" />{layerRoutes.length} tras
            </div>
          )}
          {layerNvrs.length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
              <Monitor className="w-3 h-3 inline mr-1" />{layerNvrs.length} NVR
            </div>
          )}
          {layerSwitches.length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
              <Network className="w-3 h-3 inline mr-1" />{layerSwitches.length} SW
            </div>
          )}
        </div>

        {visibleLayers.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg">
            {activePreviewIdx + 1} / {visibleLayers.length}
          </div>
        )}
      </div>

      {layerCameras.length > 0 && (
        <div className="px-5 py-3 border-t border-white/[0.06]">
          <div className="flex flex-wrap gap-2">
            {layerCameras.map(cam => {
              const model = catalog.cameras.find(m => m.id === cam.modelId);
              if (!model) return null;
              const color = CAMERA_TYPE_COLORS_HEX[model.camera_type] ?? '#3b82f6';
              return (
                <div
                  key={cam.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04]"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-extrabold text-slate-300">{cam.label}</span>
                  <span className="text-[9px] text-slate-400">{model.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LayerCanvasPreview({ layer, cameras, routes, nvrs, switches, catalog, designScale }: {
  layer: import('../../hooks/useCameraDesign').DesignLayer;
  cameras: import('../../hooks/useCameraDesign').PlacedCamera[];
  routes: import('../../hooks/useCameraDesign').CableRoute[];
  nvrs: import('../../hooks/useCameraDesign').PlacedNvr[];
  switches: import('../../hooks/useCameraDesign').PlacedSwitch[];
  catalog: CameraCatalogData;
  designScale?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };
}) {
  const VW = layer.canvasWidth ?? (layer.canvasAspect ? Math.round(600 * layer.canvasAspect) : 1067);
  const VH = layer.canvasHeight ?? 600;
  const isMap = layer.type === 'map' && layer.mapCenter && layer.mapZoom;

  const tiles = useMemo(() => {
    if (!isMap || !layer.mapCenter || !layer.mapZoom) return [];
    const zoom = layer.mapZoom;
    const lonToTX = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
    const latToTY = (lat: number, z: number) => {
      const rad = (lat * Math.PI) / 180;
      return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
    };
    const cx = lonToTX(layer.mapCenter.lon, zoom);
    const cy = latToTY(layer.mapCenter.lat, zoom);
    const tileSize = 256;
    const tilesW = Math.ceil(VW / tileSize) + 1;
    const tilesH = Math.ceil(VH / tileSize) + 1;
    const startTX = Math.floor(cx - tilesW / 2);
    const startTY = Math.floor(cy - tilesH / 2);
    const maxT = Math.pow(2, zoom);
    const result: { tx: number; ty: number; x: number; y: number }[] = [];
    for (let tx = startTX; tx <= startTX + tilesW; tx++) {
      for (let ty = startTY; ty <= startTY + tilesH; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        result.push({
          tx: ((tx % maxT) + maxT) % maxT, ty,
          x: (tx - cx) * tileSize + VW / 2,
          y: (ty - cy) * tileSize + VH / 2,
        });
      }
    }
    return result;
  }, [isMap, layer.mapCenter, layer.mapZoom, VW, VH]);

  const toAbs = (nx: number, ny: number) => ({ x: nx * VW, y: ny * VH });

  const getPixelsPerMeter = (): number => {
    if (isMap && layer.mapCenter && layer.mapZoom) {
      return 1 / metersPerPixelAtZoom(layer.mapCenter.lat, layer.mapZoom);
    }
    const scale = layer.scale ?? designScale;
    if (scale) {
      const dx = (scale.p2.x - scale.p1.x) * VW;
      const dy = (scale.p2.y - scale.p1.y) * VH;
      const pxDist = Math.sqrt(dx * dx + dy * dy);
      if (pxDist > 0) return pxDist / scale.realDistanceM;
    }
    return 0;
  };

  const fovRadius = (model: (typeof catalog.cameras)[0]) => {
    const ppm = getPixelsPerMeter();
    if (ppm <= 0) return Math.min(VW, VH) * 0.06;
    const rangeM = Math.min(model.ir_range_m, 60);
    return Math.min(rangeM * ppm, Math.min(VW, VH) * 0.4);
  };

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ aspectRatio: `${VW}/${VH}` }}>
      <rect width={VW} height={VH} fill="#1e293b" />

      {isMap && tiles.map(t => (
        <image
          key={`${layer.mapZoom}-${t.tx}-${t.ty}`}
          href={`https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${layer.mapZoom}/${t.ty}/${t.tx}`}
          x={Math.round(t.x)} y={Math.round(t.y)}
          width={256} height={256}
        />
      ))}

      {!isMap && layer.imageData && (
        <image href={layer.imageData} x={0} y={0} width={VW} height={VH} preserveAspectRatio="xMidYMid meet" />
      )}

      {routes.map(route => {
        if (route.points.length < 2) return null;
        const pts = route.points.map(p => toAbs(p.x, p.y));
        const color = route.label ? layerStringToColor(route.label) : '#f59e0b';
        return (
          <g key={route.id}>
            <polyline
              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={color} strokeWidth={3} strokeDasharray="8 4" opacity={0.85}
            />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
            {route.label && pts.length >= 2 && (
              <text
                x={(pts[0].x + pts[Math.floor(pts.length / 2)].x) / 2}
                y={(pts[0].y + pts[Math.floor(pts.length / 2)].y) / 2 - 8}
                textAnchor="middle" fill="white" fontSize={10} fontWeight="bold"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                {route.label}
              </text>
            )}
          </g>
        );
      })}

      {cameras.map(cam => {
        const model = catalog.cameras.find(m => m.id === cam.modelId);
        if (!model) return null;
        const abs = toAbs(cam.x, cam.y);
        const color = CAMERA_TYPE_COLORS_HEX[model.camera_type] ?? '#3b82f6';
        const halfFov = (model.h_fov_deg / 2) * (Math.PI / 180);
        const rotRad = cam.rotationDeg * (Math.PI / 180);
        const fovR = fovRadius(model);
        return (
          <g key={cam.id}>
            <path
              d={`M ${abs.x} ${abs.y} L ${abs.x + Math.cos(rotRad - halfFov) * fovR} ${abs.y + Math.sin(rotRad - halfFov) * fovR} A ${fovR} ${fovR} 0 ${model.h_fov_deg > 180 ? 1 : 0} 1 ${abs.x + Math.cos(rotRad + halfFov) * fovR} ${abs.y + Math.sin(rotRad + halfFov) * fovR} Z`}
              fill={color} opacity={0.15} stroke={color} strokeWidth={1} strokeOpacity={0.4}
            />
            <circle cx={abs.x} cy={abs.y} r={10} fill={color} stroke="white" strokeWidth={2} />
            <text
              x={abs.x} y={abs.y - 16}
              textAnchor="middle" fill="white" fontSize={9} fontWeight="bold"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
            >
              {cam.label || model.name}
            </text>
          </g>
        );
      })}

      {nvrs.map(nvr => {
        const abs = toAbs(nvr.x, nvr.y);
        return (
          <g key={nvr.id}>
            <rect x={abs.x - 16} y={abs.y - 12} width={32} height={24} rx={4} fill="#1e293b" stroke="#60a5fa" strokeWidth={2} />
            <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">NVR</text>
          </g>
        );
      })}

      {switches.map(sw => {
        const abs = toAbs(sw.x, sw.y);
        return (
          <g key={sw.id}>
            <rect x={abs.x - 14} y={abs.y - 10} width={28} height={20} rx={3} fill="#1e293b" stroke="#10b981" strokeWidth={2} />
            <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="#10b981" fontSize={7} fontWeight="bold">SW</text>
          </g>
        );
      })}
    </svg>
  );
}
