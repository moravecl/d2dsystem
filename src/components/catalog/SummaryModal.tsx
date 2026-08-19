import { useState, useEffect } from 'react';
import { MapPin, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { renderPinIcon } from './floorplan/iconLibrary';
import type { Product, Category, Material, DesignModule, ProductDesignModule } from '../../types/database';
import type { SelectionState, ProjectMeta, Floor } from '../../hooks/useProjectState';
import type { BathroomSymbol } from './floorplan/BathroomDesigner';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import { listAllPinsGlobal, listAllPins } from './floorplan/pinUtils';
import { polylineLength, normalizedToMeters, analyzeBends, countTPieces, STANDARD_BEND_ANGLES } from './floorplan/geometry';
import { CIRCUIT_TYPE_LABELS } from './floorplan/materialLibrary';
import type { CircuitType } from '../../hooks/useProjectState';
import { getPrintColor, getCableLengthStr } from './summary/summaryUtils';
import type { PdfSections } from './summary/summaryUtils';
import SummaryHeader from './summary/SummaryHeader';
import SummaryFloorplanView from './summary/SummaryFloorplanView';
import SummaryTradePrint from './summary/SummaryTradePrint';
import SummaryHeatingPrint from './summary/SummaryHeatingPrint';
import SummaryFvPrint from './summary/SummaryFvPrint';
import SummaryCameraPrint from './summary/SummaryCameraPrint';
import SummaryEpsPrint from './summary/SummaryEpsPrint';
import type { ProjectDesignElement, DesignElementType, MountingGroup, MountingGroupSlot } from '../../types/designElements';
import type { MountingGroupWithSlots } from '../../hooks/useMountingGroups';

interface ProductModuleEntry extends ProductDesignModule {
  module: DesignModule;
}
type ProductModulesMap = Record<string, ProductModuleEntry[]>;

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  meta: ProjectMeta;
  onMetaChange: (meta: ProjectMeta) => void;
  onStartPlacing: (productId: string) => void;
  floors: Floor[];
  materials: Material[];
  heatingSystems: HeatingSystemFull[];
  designModules: DesignModule[];
  pinSize?: number;
  schematicSymbolScale?: number;
  projectId?: string | null;
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function getModPrice(name: string, productId: string, pMap: ProductModulesMap, designModules: DesignModule[]): number {
  const pm = pMap[productId];
  if (pm && pm.length > 0) {
    return safeNum(pm.find((p) => p.module.name === name)?.price);
  }
  return safeNum(designModules.find((m) => m.name === name)?.price);
}

function getModIcon(name: string, productId: string, pMap: ProductModulesMap, designModules: DesignModule[]): string | null {
  const pm = pMap[productId];
  if (pm && pm.length > 0) {
    const entry = pm.find((p) => p.module.name === name);
    return entry?.icon_url || entry?.module.icon_url || null;
  }
  return designModules.find((m) => m.name === name)?.icon_url ?? null;
}

function getPlacementColor(pl: { config?: { colorName?: string; colorHex?: string }; colorName?: string; colorHex?: string }): { name: string; hex: string } | null {
  const name = pl.config?.colorName ?? pl.colorName;
  if (!name) return null;
  return { name, hex: pl.config?.colorHex ?? pl.colorHex ?? '#ccc' };
}

function renderRegularColorBreakdown(productId: string, selected: SelectionState) {
  const placements = selected[productId]?.placements ?? [];
  const colorCounts: Record<string, { count: number; hex: string }> = {};
  let hasAny = false;

  for (const pl of placements) {
    const c = getPlacementColor(pl);
    if (c) {
      hasAny = true;
      if (!colorCounts[c.name]) colorCounts[c.name] = { count: 0, hex: c.hex };
      colorCounts[c.name].count++;
    }
  }

  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2 print:gap-1">
      {Object.entries(colorCounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, { count, hex }]) => (
        <span key={name} className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-lg print:text-[9px] print:px-1 print:py-0.5">
          <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0 print:w-2 print:h-2" style={{ backgroundColor: hex }} />
          {count}x {name}
        </span>
      ))}
    </div>
  );
}

function getFramePrice(productId: string, frameSize: number, products: Product[]): number {
  const product = products.find((p) => p.id === productId);
  const fp = (product?.frame_prices as Record<string, number> | null) ?? {};
  return safeNum(fp[String(frameSize)]);
}

function renderDesignCounts(productId: string, selected: SelectionState, designModules: DesignModule[], pMap: ProductModulesMap, products: Product[]) {
  const placements = selected[productId]?.placements ?? [];
  const frameCounts: Record<number, number> = {};
  const moduleCounts: Record<string, number> = {};
  const colorCounts: Record<string, { count: number; hex: string }> = {};

  for (const pl of placements) {
    if (!pl.config) continue;
    frameCounts[pl.config.frameSize] = (frameCounts[pl.config.frameSize] || 0) + 1;
    for (const m of pl.config.modules) {
      moduleCounts[m] = (moduleCounts[m] || 0) + 1;
    }
    if (pl.config.colorName) {
      if (!colorCounts[pl.config.colorName]) {
        colorCounts[pl.config.colorName] = { count: 0, hex: pl.config.colorHex ?? '#ccc' };
      }
      colorCounts[pl.config.colorName].count += 1;
    }
  }

  const moduleKeys = Object.keys(moduleCounts).sort();
  const colorKeys = Object.keys(colorCounts).sort();
  const totalModulesPrice = moduleKeys.reduce((sum, k) => sum + moduleCounts[k] * getModPrice(k, productId, pMap, designModules), 0);

  let totalFramesPrice = 0;
  for (const [size, count] of Object.entries(frameCounts)) {
    totalFramesPrice += getFramePrice(productId, Number(size), products) * count;
  }

  const frames = [1, 2, 3, 4, 5].map((n) => `${n}R: ${frameCounts[n] || 0}`).join(' | ');

  return (
    <div className="mt-3 bg-navy-800/60 rounded-2xl border border-white/[0.06] p-4 print:p-2 print:mt-1 print:rounded-none print:border-0 print:bg-white/[0.04]">
      <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1">{`Automatické počty \u2013 design řada`}</div>
      <div className="text-sm text-slate-300">{frames}</div>
      {totalFramesPrice > 0 && (
        <div className="flex items-center justify-end gap-2 mt-1">
          <span className="text-xs font-extrabold text-slate-500">Rámečky celkem:</span>
          <span className="text-sm font-extrabold text-blue-400">{totalFramesPrice.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}
      {colorKeys.length > 0 && (
        <div className="mt-3 print:mt-1">
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1">{`Zvolená barva`}</div>
          <div className="flex flex-wrap gap-2">
            {colorKeys.map((name) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0 print:w-3 print:h-3" style={{ backgroundColor: colorCounts[name].hex }} />
                <span className="text-xs font-extrabold text-slate-300">{name}</span>
                <span className="text-xs font-extrabold text-slate-400">{colorCounts[name].count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {moduleKeys.length > 0 && (
        <div className="mt-3 print:mt-1">
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1">{`Vložky (součet)`}</div>
          {moduleKeys.map((k) => {
            const unitPrice = getModPrice(k, productId, pMap, designModules);
            const icon = getModIcon(k, productId, pMap, designModules);
            const lineTotal = unitPrice * moduleCounts[k];
            return (
              <div key={k} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                  {icon && (
                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
                      {renderPinIcon(icon, 16, 'text-slate-400')}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-300">{k}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-extrabold text-white">{moduleCounts[k]} ks</span>
                  {unitPrice > 0 && (
                    <span className="text-xs font-extrabold text-blue-400">{lineTotal.toLocaleString('cs-CZ')} Kč</span>
                  )}
                </div>
              </div>
            );
          })}
          {totalModulesPrice > 0 && (
            <div className="flex items-center justify-end gap-2 pt-2 mt-1">
              <span className="text-xs font-extrabold text-slate-500">Vložky celkem:</span>
              <span className="text-sm font-extrabold text-blue-400">{totalModulesPrice.toLocaleString('cs-CZ')} Kč</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SummaryModal({
  open, onClose, products, categories, selected, meta, onMetaChange, onStartPlacing, floors, materials, heatingSystems, designModules, pinSize, schematicSymbolScale = 24, projectId,
}: Props) {
  const [wastePercents, setWastePercents] = useState<Record<string, number>>({});
  const [pdfSections, setPdfSections] = useState<PdfSections>({
    items: true, rooms: true, routes: true, fittings: true, summary: true, floorplans: true, trades: true, heating: true, fv: true, camera: true, eps: true,
  });
  const [productModulesMap, setProductModulesMap] = useState<ProductModulesMap>({});
  const [bathroomSymbols, setBathroomSymbols] = useState<BathroomSymbol[]>([]);
  const [designElements, setDesignElements] = useState<ProjectDesignElement[]>([]);
  const [elementTypes, setElementTypes] = useState<DesignElementType[]>([]);
  const [mountingGroups, setMountingGroups] = useState<MountingGroupWithSlots[]>([]);

  useEffect(() => {
    if (!open) return;
    const hasBathroomLayouts = floors.some(f => (f.rooms ?? []).some(r => (r.bathroomLayout ?? []).length > 0));
    if (!hasBathroomLayouts) return;
    supabase.from('bathroom_symbols').select('*').order('category').order('sort_order').then(({ data }) => {
      if (data) setBathroomSymbols(data as BathroomSymbol[]);
    });
  }, [open, floors]);

  useEffect(() => {
    if (!open || !projectId) return;
    Promise.all([
      supabase.from('project_design_elements').select('*').eq('project_id', projectId),
      supabase.from('design_element_types').select('*').order('sort_order'),
      supabase.from('mounting_groups').select('*').eq('project_id', projectId).order('created_at'),
    ]).then(async ([elemRes, typesRes, groupsRes]) => {
      setDesignElements((elemRes.data || []) as ProjectDesignElement[]);
      setElementTypes((typesRes.data || []) as DesignElementType[]);
      const loadedGroups = (groupsRes.data || []) as MountingGroup[];
      if (loadedGroups.length > 0) {
        const groupIds = loadedGroups.map((g) => g.id);
        const { data: slotsData } = await supabase.from('mounting_group_slots').select('*').in('mounting_group_id', groupIds).order('slot_index');
        const slots = (slotsData || []) as MountingGroupSlot[];
        const groupsWithSlots: MountingGroupWithSlots[] = loadedGroups.map((g) => ({
          ...g,
          slots: slots.filter((s) => s.mounting_group_id === g.id),
        }));
        setMountingGroups(groupsWithSlots);
      } else {
        setMountingGroups([]);
      }
    });
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const dsProductIds = Object.keys(selected)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p && p.kind === 'design_series')
      .map((p) => p.id);
    if (dsProductIds.length === 0) { setProductModulesMap({}); return; }
    supabase
      .from('product_design_modules')
      .select('*')
      .in('product_id', dsProductIds)
      .order('sort_order')
      .then(({ data }) => {
        const pdms = data ?? [];
        const map: ProductModulesMap = {};
        for (const pdm of pdms) {
          const mod = designModules.find((m) => m.id === pdm.design_module_id);
          if (!mod) continue;
          if (!map[pdm.product_id]) map[pdm.product_id] = [];
          map[pdm.product_id].push({ ...pdm, module: mod });
        }
        setProductModulesMap(map);
      });
  }, [open, selected, designModules, products]);

  if (!open) return null;

  const selectedProducts = Object.keys(selected).map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  const allPins = listAllPinsGlobal(selected, products);
  const groupedByCat = categories.map((cat) => ({ cat, items: selectedProducts.filter((p) => p.category_id === cat.id) })).filter((g) => g.items.length > 0);
  const totalPrice = selectedProducts.reduce((sum, p) => sum + safeNum(p.price) * (selected[p.id]?.placements?.length ?? 0), 0);
  const floorsWithImages = floors.filter((f) => f.floorplanImg);

  const allRooms: { id: string; name: string }[] = [];
  for (const floor of floors) {
    for (const room of floor.rooms ?? []) allRooms.push({ id: room.id, name: room.name });
  }
  const roomIdToName = (id: string) => allRooms.find(r => r.id === id)?.name ?? id;
  const hasRoomData = allRooms.length > 0;

  const roomProductMap: Record<string, { product: Product; count: number }[]> = {};
  if (hasRoomData) {
    for (const pid of Object.keys(selected)) {
      const product = products.find((p) => p.id === pid);
      if (!product) continue;
      for (const pl of selected[pid].placements) {
        const roomKey = pl.room ? roomIdToName(pl.room) : 'Nezařazeno';
        if (!roomProductMap[roomKey]) roomProductMap[roomKey] = [];
        const existing = roomProductMap[roomKey].find((rp) => rp.product.id === product.id);
        if (existing) existing.count += 1;
        else roomProductMap[roomKey].push({ product, count: 1 });
      }
    }
  }

  const materialTotals: Record<string, { normalized: number; type: string; meters: number | null }> = {};
  for (const floor of floors) {
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const circuit = (floor.circuits ?? []).find((c) => c.id === cable.circuitId);
      const len = polylineLength(cable.points);
      const metersLen = floor.scale ? normalizedToMeters(len, floor.scale) : null;
      if (!materialTotals[cable.materialName]) materialTotals[cable.materialName] = { normalized: 0, type: circuit?.type ?? 'electric', meters: null };
      materialTotals[cable.materialName].normalized += len;
      if (metersLen !== null) materialTotals[cable.materialName].meters = (materialTotals[cable.materialName].meters ?? 0) + metersLen;
    }
  }

  const anyFloorWithScale = floors.find((f) => f.scale);
  const getMaterialPrice = (name: string) => materials.find(m => m.name === name)?.price_per_unit ?? 0;
  const getWastePercent = (name: string) => wastePercents[name] ?? 0;
  const setWaste = (name: string, val: string) => {
    const num = parseFloat(val.replace(',', '.'));
    setWastePercents(prev => ({ ...prev, [name]: isNaN(num) ? 0 : num }));
  };

  let totalRoutesPrice = 0;

  interface FittingRow { materialName: string; type: string; bendsByAngle: Record<number, number>; totalBends: number; tPieces: number }
  const fittingMap = new Map<string, FittingRow>();
  for (const floor of floors) {
    const fCircuits = floor.circuits ?? [];
    const fCables = floor.cables ?? [];
    for (const circuit of fCircuits) {
      const cType = circuit.type ?? 'electric';
      if (cType !== 'water' && cType !== 'heating') continue;
      const circuitCables = fCables.filter(c => c.circuitId === circuit.id);
      const tPieces = countTPieces(circuitCables);
      for (const cable of circuitCables) {
        const matName = cable.materialName || CIRCUIT_TYPE_LABELS[cType]?.label || cType;
        if (!fittingMap.has(matName)) fittingMap.set(matName, { materialName: matName, type: CIRCUIT_TYPE_LABELS[cType]?.label ?? cType, bendsByAngle: {}, totalBends: 0, tPieces: 0 });
        const row = fittingMap.get(matName)!;
        for (const b of analyzeBends(cable.points)) { row.bendsByAngle[b.angle] = (row.bendsByAngle[b.angle] || 0) + 1; row.totalBends += 1; }
      }
      if (tPieces > 0 && circuitCables.length > 0) {
        const firstMat = circuitCables[0].materialName || CIRCUIT_TYPE_LABELS[cType]?.label || cType;
        if (!fittingMap.has(firstMat)) fittingMap.set(firstMat, { materialName: firstMat, type: CIRCUIT_TYPE_LABELS[cType]?.label ?? cType, bendsByAngle: {}, totalBends: 0, tPieces: 0 });
        fittingMap.get(firstMat)!.tPieces += tPieces;
      }
    }
  }
  const fittingRows = Array.from(fittingMap.values()).filter(r => r.totalBends > 0 || r.tPieces > 0);
  const totalBends = fittingRows.reduce((s, f) => s + f.totalBends, 0);
  const totalTPieces = fittingRows.reduce((s, f) => s + f.tPieces, 0);
  const hasCableData = floors.some(f => (f.cables ?? []).length > 0);

  interface AutoFittingRow { name: string; unit: string; trade: string; quantity: number; pricePerUnit: number; correction: number }
  const autoFittingRows: AutoFittingRow[] = (() => {
    const tradeStats: Record<string, { totalBends: number; totalTees: number; totalEndpoints: number; totalMeters: number }> = {};
    const cablesByTrade: Record<string, typeof floors[0]['cables']> = {};
    for (const floor of floors) {
      for (const cable of floor.cables ?? []) {
        const circuit = (floor.circuits ?? []).find(c => c.id === cable.circuitId);
        const trade = circuit?.type ?? 'electric';
        if (!cablesByTrade[trade]) cablesByTrade[trade] = [];
        cablesByTrade[trade]!.push(cable);
      }
    }
    for (const [trade, tradeCables] of Object.entries(cablesByTrade)) {
      if (!tradeStats[trade]) tradeStats[trade] = { totalBends: 0, totalTees: 0, totalEndpoints: 0, totalMeters: 0 };
      const s = tradeStats[trade];
      for (const cable of tradeCables ?? []) {
        s.totalBends += analyzeBends(cable.points).length;
        if (cable.points.length >= 2) s.totalEndpoints += 2;
        const len = polylineLength(cable.points);
        const floorForCable = floors.find(f => (f.cables ?? []).some(c => c.id === cable.id));
        s.totalMeters += floorForCable?.scale ? normalizedToMeters(len, floorForCable.scale) : 0;
      }
      s.totalTees += countTPieces(tradeCables ?? []);
    }

    const corrections: Record<string, number> = {};
    for (const floor of floors) {
      for (const c of floor.circuits ?? []) {
        for (const [matId, delta] of Object.entries(c.fittingCorrections ?? {})) {
          corrections[matId] = (corrections[matId] ?? 0) + delta;
        }
      }
    }

    const fittingMats = materials.filter(m => m.material_type === 'fitting' && m.is_active && m.fitting_calc_rule);
    const rows: AutoFittingRow[] = [];
    for (const mat of fittingMats) {
      const stats = tradeStats[mat.trade];
      if (!stats) continue;
      let baseQty = 0;
      switch (mat.fitting_calc_rule) {
        case 'per_bend': baseQty = stats.totalBends; break;
        case 'per_tee': baseQty = stats.totalTees; break;
        case 'per_endpoint': baseQty = stats.totalEndpoints; break;
        case 'per_10m': baseQty = Math.ceil(stats.totalMeters / 10); break;
      }
      const corr = corrections[mat.id] ?? 0;
      const finalQty = Math.max(0, baseQty + corr);
      if (finalQty <= 0 && baseQty <= 0) continue;
      rows.push({ name: mat.name, unit: mat.unit, trade: mat.trade, quantity: finalQty, pricePerUnit: mat.price_per_unit, correction: corr });
    }
    return rows;
  })();
  const autoFittingsTotal = autoFittingRows.reduce((s, r) => s + r.quantity * r.pricePerUnit, 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white/[0.04]">
      <SummaryHeader meta={meta} onMetaChange={onMetaChange} pdfSections={pdfSections} onPdfSectionsChange={setPdfSections} onClose={onClose} />

      <div className="p-6 overflow-y-auto flex-1 bg-white/[0.06]" id="print-area">
        <div className="hidden print:block mb-8 pb-6 border-b-2 border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-extrabold text-white">{`HouseSmart \u2013 Standard provádění`}</div>
            <div className="text-xs text-slate-500">{new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <table className="w-full text-sm border border-white/10">
            <tbody>
              <tr>
                <td className="px-3 py-2 font-extrabold text-slate-400 bg-white/[0.04] border border-white/10 w-1/6">Projekt</td>
                <td className="px-3 py-2 text-white border border-white/10">{meta.project || '—'}</td>
                <td className="px-3 py-2 font-extrabold text-slate-400 bg-white/[0.04] border border-white/10 w-1/6">{`Zákazník`}</td>
                <td className="px-3 py-2 text-white border border-white/10">{meta.client || '—'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-extrabold text-slate-400 bg-white/[0.04] border border-white/10">Verze</td>
                <td className="px-3 py-2 text-white border border-white/10">{meta.version || '—'}</td>
                <td className="px-3 py-2 font-extrabold text-slate-400 bg-white/[0.04] border border-white/10">{`Položek`}</td>
                <td className="px-3 py-2 text-white border border-white/10">{`${selectedProducts.length} položek, ${allPins.length} ks (pinů)`}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-extrabold text-slate-400 bg-white/[0.04] border border-white/10">Pater</td>
                <td className="px-3 py-2 text-white border border-white/10" colSpan={3}>{floors.map((f) => f.name).join(', ')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {selectedProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white/[0.04] w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-extrabold text-white">{`Zatím prázdno`}</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">{`Vyber položky a umístuj je do půdorysu.`}</p>
          </div>
        ) : (
          <div className="space-y-7 print:space-y-4">
            {groupedByCat.map(({ cat, items }) => {
              const pc = getPrintColor(cat.pill_color);
              return (
                <div key={cat.id}>
                  <div className="print:hidden">
                    <div className={`rounded-3xl border ${cat.border_color} overflow-hidden`}>
                      <div className={`${cat.soft_color} px-5 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl ${cat.pill_color} text-white flex items-center justify-center shadow`}>
                            <span className="text-xs font-extrabold">{items.length}</span>
                          </div>
                          <div>
                            <div className={`text-sm font-extrabold ${cat.text_color}`}>{cat.name}</div>
                            <div className="text-xs text-slate-500 font-semibold">
                              {`${items.reduce((s, p) => s + (selected[p.id]?.placements?.length ?? 0), 0)} ks (pinů)`}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/[0.06] p-5 space-y-3">
                        {items.map((p) => {
                          const q = selected[p.id]?.placements?.length ?? 0;
                          return (
                            <div key={p.id} className="rounded-3xl border border-white/[0.06] p-4 bg-white/[0.04]">
                              <div className="flex items-start gap-4">
                                {p.image_url && <img src={p.image_url} className="w-14 h-14 object-cover rounded-2xl  border" alt="" />}
                                <div className="flex-grow min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-widest">{p.brand}</span>
                                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">{p.tag}</span>
                                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">{p.code}</span>
                                  </div>
                                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-1">
                                    <div className="font-extrabold text-white text-sm truncate">{p.name}</div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-extrabold text-slate-300">{q} ks</div>
                                      {safeNum(p.price) > 0 && <div className="text-sm font-extrabold text-blue-400">{`${(safeNum(p.price) * q).toLocaleString('cs-CZ')} Kč`}</div>}
                                      <button onClick={() => onStartPlacing(p.id)} className="px-3 py-2 rounded-2xl bg-navy-800/60 border border-white/[0.08] text-slate-300 text-xs font-extrabold hover:bg-white/[0.04] transition flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3" /> {`Umístit`}
                                      </button>
                                    </div>
                                  </div>
                                  {p.kind === 'design_series' && renderDesignCounts(p.id, selected, designModules, productModulesMap, products)}
                                  {p.kind !== 'design_series' && renderRegularColorBreakdown(p.id, selected)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="hidden print:block">
                    <div className="mb-2 mt-4 first:mt-0">
                      <div className="text-sm font-extrabold px-3 py-2 border flex items-center gap-2" style={{ backgroundColor: pc.bg, color: pc.text, borderColor: pc.border }}>
                        <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pc.dot }} />
                        {cat.name} ({items.reduce((s, p) => s + (selected[p.id]?.placements?.length ?? 0), 0)} ks)
                      </div>
                    </div>
                    <table className="w-full text-xs border-collapse border border-white/10">
                      <thead>
                        <tr style={{ backgroundColor: pc.bg }}>
                          <th className="text-left px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>{`Kód`}</th>
                          <th className="text-left px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>{`Název`}</th>
                          <th className="text-left px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>{`Značka`}</th>
                          <th className="text-right px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>Ks</th>
                          <th className="text-right px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>Cena/ks</th>
                          <th className="text-right px-2 py-1.5 border border-white/10 font-extrabold" style={{ color: pc.text }}>Celkem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const q = selected[p.id]?.placements?.length ?? 0;
                          return (
                            <tr key={p.id}>
                              <td className="px-2 py-1.5 border border-white/10 font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pc.dot }} />
                                  {p.code}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 border border-white/10">{p.name}</td>
                              <td className="px-2 py-1.5 border border-white/10">{p.brand}</td>
                              <td className="px-2 py-1.5 border border-white/10 text-right font-extrabold">{q}</td>
                              <td className="px-2 py-1.5 border border-white/10 text-right">{safeNum(p.price) > 0 ? `${safeNum(p.price).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                              <td className="px-2 py-1.5 border border-white/10 text-right font-extrabold">{safeNum(p.price) > 0 ? `${(safeNum(p.price) * q).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {items.some((p) => p.kind === 'design_series') && (
                      <div className="mt-1">
                        {items.filter((p) => p.kind === 'design_series').map((p) => (
                          <div key={p.id}>{renderDesignCounts(p.id, selected, designModules, productModulesMap, products)}</div>
                        ))}
                      </div>
                    )}
                    {items.some((p) => p.kind !== 'design_series') && (
                      <div className="mt-1">
                        {items.filter((p) => p.kind !== 'design_series').map((p) => {
                          const cb = renderRegularColorBreakdown(p.id, selected);
                          if (!cb) return null;
                          return <div key={p.id} className="px-2 py-1"><span className="text-[9px] font-extrabold text-slate-500">{p.name}:</span>{cb}</div>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {hasRoomData && Object.keys(roomProductMap).length > 0 && (
              <div className="mt-6 print:mt-8 print:break-before-page">
                <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3 print:text-sm print:text-white print:mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-teal-500 inline-block" />
                  {`Rozložení podle místností`}
                </div>
                <div className="space-y-3 print:space-y-2">
                  {[...allRooms.map(r => r.name), 'Nezařazeno'].map((roomName) => {
                    const items = roomProductMap[roomName];
                    if (!items || items.length === 0) return null;
                    const totalItems = items.reduce((s, i) => s + i.count, 0);
                    return (
                      <div key={roomName} className="rounded-2xl border border-white/10 overflow-hidden print:rounded-none">
                        <div className={`px-4 py-2.5 flex items-center justify-between ${roomName === 'Nezařazeno' ? 'bg-white/[0.04]' : 'bg-teal-500/10'}`}>
                          <span className={`text-sm font-extrabold ${roomName === 'Nezařazeno' ? 'text-slate-500' : 'text-teal-800'}`}>{roomName}</span>
                          <span className="text-xs font-extrabold text-slate-500">{totalItems} ks</span>
                        </div>
                        <table className="w-full text-xs print:text-[10px]">
                          <tbody>
                            {items.map((rp) => {
                              const cat = categories.find((c) => c.id === rp.product.category_id);
                              const rpc = getPrintColor(cat?.pill_color ?? '');
                              return (
                                <tr key={rp.product.id} className="border-t border-white/[0.06]">
                                  <td className="px-4 py-2 print:px-2 print:py-1">
                                    <span className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rpc.dot }} />
                                      <span className="font-extrabold text-slate-300">{rp.product.name}</span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 print:px-2 print:py-1 text-slate-500">{rp.product.code}</td>
                                  <td className="px-4 py-2 print:px-2 print:py-1 text-right font-extrabold text-white">{rp.count} ks</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hasCableData && (
              <div className="mt-6 print:mt-8 print:break-before-page">
                <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3 print:text-sm print:text-white print:mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                  {`Trasy a materiál`}
                </div>
                {floors.map((floor) => {
                  const fCircuits = floor.circuits ?? [];
                  const fCables = floor.cables ?? [];
                  if (fCircuits.length === 0) return null;
                  return (
                    <div key={floor.id} className="mb-4">
                      <div className="text-xs font-extrabold text-slate-300 mb-2 print:text-[11px]">{floor.name}</div>
                      <table className="w-full text-xs border-collapse border border-white/10 print:text-[10px]">
                        <thead>
                          <tr className="bg-white/[0.04]">
                            <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Okruh</th>
                            <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Typ</th>
                            <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Materiál`}</th>
                            <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Délka`}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fCircuits.map((circuit) => {
                            const circuitCables = fCables.filter((c) => c.circuitId === circuit.id);
                            if (circuitCables.length === 0) return null;
                            const typeLabel = CIRCUIT_TYPE_LABELS[circuit.type ?? 'electric']?.label ?? 'Elektro';
                            return circuitCables.map((cable, idx) => (
                              <tr key={cable.id} className="border-t border-white/10">
                                {idx === 0 && (
                                  <td className="px-3 py-2 border border-white/10 print:px-2 print:py-1 font-extrabold" rowSpan={circuitCables.length}>
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: circuit.color }} />
                                      {circuit.name}
                                    </span>
                                  </td>
                                )}
                                {idx === 0 && (
                                  <td className="px-3 py-2 border border-white/10 print:px-2 print:py-1 text-slate-400" rowSpan={circuitCables.length}>{typeLabel}</td>
                                )}
                                <td className="px-3 py-2 border border-white/10 print:px-2 print:py-1 font-semibold text-slate-300">{cable.materialName || '—'}</td>
                                <td className="px-3 py-2 border border-white/10 print:px-2 print:py-1 text-right font-extrabold">{getCableLengthStr(cable, floor.scale)}</td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {Object.keys(materialTotals).length > 0 && (() => {
                  const usedTrades = [...new Set(Object.values(materialTotals).map(d => d.type))];
                  const tradeNames = usedTrades.map(t => CIRCUIT_TYPE_LABELS[t as CircuitType]?.label ?? t);
                  const materialSectionLabel = tradeNames.length === 1 ? `Celkový součet materiálu – ${tradeNames[0]}` : `Celkový součet materiálu`;
                  return (
                  <div className="mt-4 pt-3 border-t border-white/10 print:mt-2 print:pt-2">
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1">{materialSectionLabel}</div>
                    <table className="w-full text-xs border-collapse border border-white/10 print:text-[10px]">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Materiál`}</th>
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Typ</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Délka`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1 print:hidden">{`Prořez %`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`S prořezem`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Kč/m`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Cena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(materialTotals).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => {
                          const lengthM = data.meters ?? (anyFloorWithScale?.scale ? normalizedToMeters(data.normalized, anyFloorWithScale.scale) : null);
                          const lengthStr = lengthM !== null ? `${lengthM.toFixed(1)} m` : `${(data.normalized * 100).toFixed(0)} j.`;
                          const typeLabel = CIRCUIT_TYPE_LABELS[data.type as keyof typeof CIRCUIT_TYPE_LABELS]?.label ?? data.type;
                          const waste = getWastePercent(name);
                          const adjustedLength = lengthM !== null ? lengthM * (1 + waste / 100) : null;
                          const adjustedStr = adjustedLength !== null ? `${adjustedLength.toFixed(1)} m` : '—';
                          const pricePerM = getMaterialPrice(name);
                          const lineTotal = adjustedLength !== null && pricePerM > 0 ? adjustedLength * pricePerM : 0;
                          totalRoutesPrice += lineTotal;
                          return (
                            <tr key={name} className="border-t border-white/10">
                              <td className="px-3 py-2 border border-white/10 font-extrabold text-slate-300 print:px-2 print:py-1">{name}</td>
                              <td className="px-3 py-2 border border-white/10 text-slate-400 print:px-2 print:py-1">{typeLabel}</td>
                              <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-white print:px-2 print:py-1">{lengthStr}</td>
                              <td className="px-3 py-2 border border-white/10 text-right print:px-2 print:py-1 print:hidden">
                                <input type="text" value={waste || ''} onChange={(e) => setWaste(name, e.target.value)} placeholder="0" className="w-14 px-1.5 py-1 rounded border border-white/10 text-[11px] font-extrabold text-right focus:outline-none focus:ring-1 focus:ring-blue-500/20" />
                              </td>
                              <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-white print:px-2 print:py-1">
                                {adjustedStr}
                                {waste > 0 && <span className="text-[10px] text-amber-400 ml-1">(+{waste}%)</span>}
                              </td>
                              <td className="px-3 py-2 border border-white/10 text-right text-slate-400 print:px-2 print:py-1">{pricePerM > 0 ? `${pricePerM.toLocaleString('cs-CZ')} Kč` : '—'}</td>
                              <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-white print:px-2 print:py-1">{lineTotal > 0 ? `${Math.round(lineTotal).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {totalRoutesPrice > 0 && (
                        <tfoot>
                          <tr className="bg-white/[0.04] border-t-2 border-slate-300">
                            <td colSpan={6} className="px-3 py-2 border border-white/10 font-extrabold text-right text-slate-300 print:px-2 print:py-1">Celkem trasy</td>
                            <td className="px-3 py-2 border border-white/10 font-extrabold text-right text-blue-400 print:px-2 print:py-1">{`${Math.round(totalRoutesPrice).toLocaleString('cs-CZ')} Kč`}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  );
                })()}

                {(totalBends > 0 || totalTPieces > 0) && (
                  <div className="mt-4 pt-3 border-t border-white/10 print:mt-2 print:pt-2">
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1 flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                      Tvarovky (kolena, T-kusy)
                    </div>
                    <table className="w-full text-xs border-collapse border border-white/10 print:text-[10px]">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Materiál</th>
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Typ</th>
                          {STANDARD_BEND_ANGLES.map((a) => (
                            <th key={a} className="text-right px-2 py-2 border border-white/10 font-extrabold print:px-1 print:py-1">{a}°</th>
                          ))}
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">T-kusy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fittingRows.map((row) => (
                          <tr key={row.materialName} className="border-t border-white/10">
                            <td className="px-3 py-2 border border-white/10 font-extrabold text-slate-300 print:px-2 print:py-1">{row.materialName}</td>
                            <td className="px-3 py-2 border border-white/10 text-slate-400 print:px-2 print:py-1">{row.type}</td>
                            {STANDARD_BEND_ANGLES.map((a) => (
                              <td key={a} className="px-2 py-2 border border-white/10 text-right font-extrabold text-white print:px-1 print:py-1">{row.bendsByAngle[a] || '—'}</td>
                            ))}
                            <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-blue-400 print:px-2 print:py-1">{row.tPieces || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/[0.04] border-t-2 border-slate-300">
                          <td colSpan={2} className="px-3 py-2 border border-white/10 font-extrabold text-right text-slate-300 print:px-2 print:py-1">Celkem</td>
                          {STANDARD_BEND_ANGLES.map((a) => {
                            const total = fittingRows.reduce((s, r) => s + (r.bendsByAngle[a] || 0), 0);
                            return <td key={a} className="px-2 py-2 border border-white/10 text-right font-extrabold text-white print:px-1 print:py-1">{total || '—'}</td>;
                          })}
                          <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-blue-400 print:px-2 print:py-1">{totalTPieces || '—'}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {autoFittingRows.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10 print:mt-2 print:pt-2">
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1 flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                      {`Tvarovky a příslušenství`}
                    </div>
                    <table className="w-full text-xs border-collapse border border-white/10 print:text-[10px]">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Tvarovka</th>
                          <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Obor</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Počet`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">{`Kč/ks`}</th>
                          <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Cena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoFittingRows.map((row) => {
                          const tradeLabel = CIRCUIT_TYPE_LABELS[row.trade as CircuitType]?.label ?? row.trade;
                          return (
                            <tr key={`${row.name}-${row.trade}`} className="border-t border-white/10">
                              <td className="px-3 py-2 border border-white/10 font-extrabold text-slate-300 print:px-2 print:py-1">
                                {row.name}
                                {row.correction !== 0 && (
                                  <span className={`ml-1.5 text-[10px] ${row.correction > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                    (korekce {row.correction > 0 ? '+' : ''}{row.correction})
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 border border-white/10 text-slate-400 print:px-2 print:py-1">{tradeLabel}</td>
                              <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-white print:px-2 print:py-1">{row.quantity} {row.unit}</td>
                              <td className="px-3 py-2 border border-white/10 text-right text-slate-400 print:px-2 print:py-1">{row.pricePerUnit > 0 ? `${row.pricePerUnit.toLocaleString('cs-CZ')} Kč` : '—'}</td>
                              <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-white print:px-2 print:py-1">{row.pricePerUnit > 0 ? `${Math.round(row.quantity * row.pricePerUnit).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {autoFittingsTotal > 0 && (
                        <tfoot>
                          <tr className="bg-white/[0.04] border-t-2 border-slate-300">
                            <td colSpan={4} className="px-3 py-2 border border-white/10 font-extrabold text-right text-slate-300 print:px-2 print:py-1">{`Celkem tvarovky`}</td>
                            <td className="px-3 py-2 border border-white/10 font-extrabold text-right text-blue-400 print:px-2 print:py-1">{`${Math.round(autoFittingsTotal).toLocaleString('cs-CZ')} Kč`}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const breakerCircuits = floors.flatMap(f => (f.circuits ?? []).filter(c => c.type === 'electric' && c.breaker));
              if (breakerCircuits.length === 0) return null;
              const breakerCounts: Record<string, number> = {};
              for (const c of breakerCircuits) {
                const key = `${c.breaker!.amperage}A/${c.breaker!.poles}p/${c.breaker!.curve}`;
                breakerCounts[key] = (breakerCounts[key] || 0) + 1;
              }
              return (
                <div className="mt-6 print:mt-8">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3 print:text-sm print:text-white print:mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                    Jištění okruhů
                  </div>
                  <table className="w-full text-xs border-collapse border border-white/10 print:text-[10px]">
                    <thead>
                      <tr className="bg-white/[0.04]">
                        <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Okruh</th>
                        <th className="text-left px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Patro</th>
                        <th className="text-right px-3 py-2 border border-white/10 font-extrabold print:px-2 print:py-1">Jištění</th>
                      </tr>
                    </thead>
                    <tbody>
                      {floors.flatMap(f =>
                        (f.circuits ?? []).filter(c => c.type === 'electric' && c.breaker).map(c => (
                          <tr key={c.id} className="border-t border-white/10">
                            <td className="px-3 py-2 border border-white/10 font-extrabold text-slate-300 print:px-2 print:py-1">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.name}
                              </span>
                            </td>
                            <td className="px-3 py-2 border border-white/10 text-slate-400 print:px-2 print:py-1">{f.name}</td>
                            <td className="px-3 py-2 border border-white/10 text-right font-extrabold text-amber-400 print:px-2 print:py-1">
                              {c.breaker!.amperage}A / {c.breaker!.poles}p / {c.breaker!.curve}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="mt-3 pt-2 border-t border-white/10 print:mt-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 print:mb-1">Soupis jistících prvků</div>
                    <div className="space-y-1">
                      {Object.entries(breakerCounts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => (
                        <div key={key} className="flex items-center justify-between text-xs bg-amber-500/10 rounded-lg px-2.5 py-1.5 border border-amber-500/20 print:rounded-none">
                          <span className="font-extrabold text-amber-800">{key}</span>
                          <span className="font-extrabold text-amber-900">{count}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="hidden print:block mt-4 pt-3 border-t-2 border-slate-300">
              <div className="flex justify-end">
                <table className="text-sm">
                  <tbody>
                    <tr>
                      <td className="px-3 py-1 font-extrabold text-slate-400 text-right">{`Položek celkem:`}</td>
                      <td className="px-3 py-1 font-extrabold text-white text-right">{selectedProducts.length}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1 font-extrabold text-slate-400 text-right">{`Kusů celkem (pinů):`}</td>
                      <td className="px-3 py-1 font-extrabold text-white text-right">{allPins.length}</td>
                    </tr>
                    {totalPrice > 0 && (
                      <tr>
                        <td className="px-3 py-1 font-extrabold text-slate-400 text-right">{`Celková cena položek:`}</td>
                        <td className="px-3 py-1 font-extrabold text-white text-right text-base">{`${totalPrice.toLocaleString('cs-CZ')} Kč`}</td>
                      </tr>
                    )}
                    {totalRoutesPrice > 0 && (
                      <tr>
                        <td className="px-3 py-1 font-extrabold text-slate-400 text-right">{`Celková cena tras:`}</td>
                        <td className="px-3 py-1 font-extrabold text-blue-400 text-right text-base">{`${Math.round(totalRoutesPrice).toLocaleString('cs-CZ')} Kč`}</td>
                      </tr>
                    )}
                    {autoFittingsTotal > 0 && (
                      <tr>
                        <td className="px-3 py-1 font-extrabold text-slate-400 text-right">{`Celkem tvarovky:`}</td>
                        <td className="px-3 py-1 font-extrabold text-amber-400 text-right text-base">{`${Math.round(autoFittingsTotal).toLocaleString('cs-CZ')} Kč`}</td>
                      </tr>
                    )}
                    {(totalPrice > 0 || totalRoutesPrice > 0 || autoFittingsTotal > 0) && (
                      <tr className="border-t-2 border-slate-300">
                        <td className="px-3 py-2 font-extrabold text-white text-right text-base">Celkem:</td>
                        <td className="px-3 py-2 font-extrabold text-white text-right text-lg">{`${Math.round(totalPrice + totalRoutesPrice + autoFittingsTotal).toLocaleString('cs-CZ')} Kč`}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {floorsWithImages.map((floor) => (
              <SummaryFloorplanView
                key={floor.id}
                floor={floor}
                floors={floors}
                floorPins={listAllPins(selected, products, floor.id)}
                products={products}
                categories={categories}
                heatingSystems={heatingSystems}
                roomIdToName={roomIdToName}
                pinSize={pinSize}
                schematicSymbolScale={schematicSymbolScale}
                bathroomSymbols={bathroomSymbols}
                designElements={designElements}
                elementTypes={elementTypes}
                mountingGroups={mountingGroups}
              />
            ))}

            {(hasCableData || allPins.length > 0 || floors.some(f => (f.rooms ?? []).some(r => r.heatingSystemId))) && (
              <SummaryTradePrint
                floors={floors}
                products={products}
                categories={categories}
                selected={selected}
                heatingSystems={heatingSystems}
                roomIdToName={roomIdToName}
                getWastePercent={getWastePercent}
                getMaterialPrice={getMaterialPrice}
                alwaysVisible
                bathroomSymbols={bathroomSymbols}
              />
            )}

            <SummaryHeatingPrint floors={floors} heatingSystems={heatingSystems} alwaysVisible />

            {projectId && (
              <div className={!pdfSections.fv ? 'print:hidden' : ''}>
                <SummaryFvPrint projectId={projectId} />
              </div>
            )}

            {projectId && (
              <div className={!pdfSections.camera ? 'print:hidden' : ''}>
                <SummaryCameraPrint projectId={projectId} />
              </div>
            )}

            {projectId && (
              <div className={!pdfSections.eps ? 'print:hidden' : ''}>
                <SummaryEpsPrint projectId={projectId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
