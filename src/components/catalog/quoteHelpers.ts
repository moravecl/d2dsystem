import type { Product, Category, Material } from '../../types/database';
import type { SelectionState, Floor } from '../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import type { ProductAssignment, ProjectDesignElement, DesignElementType, DesignSeriesProductLink } from '../../types/designElements';
import type { MountingGroupWithSlots } from '../../hooks/useMountingGroups';
import { calculateHeatingMaterials } from '../../hooks/useHeatingSystems';
import { calculateLighting } from '../../hooks/useLightingNorms';
import { polylineLength, normalizedToMeters, polygonAreaM2, polygonPerimeterM, analyzeBends, countTPieces } from './floorplan/geometry';
import { supabase } from '../../lib/supabase';
import { resolveAssignmentForElement } from '../../lib/assignmentResolver';
import { buildSchematicSummary, schematicSummaryToQuoteSections, type SchematicSummaryOutput } from '../../lib/schematicSummaryBuilder';

export interface QuoteItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
  discount?: number;
  productId?: string;
  isAutoMaterial?: boolean;
  vatRate?: number;
}

export interface QuoteSection {
  id: string;
  name: string;
  items: QuoteItem[];
  collapsed?: boolean;
  color?: string;
  icon?: string;
  trade?: string;
  discount?: number;
}

export interface QuoteAttachment {
  id: string;
  type: 'roof_snapshot' | 'camera_layout' | 'custom';
  label: string;
  imageData: string;
  annotation?: string;
}

export interface QuoteSystemSummary {
  type: 'fve' | 'camera' | 'eps';
  data: Record<string, string | number>;
}

export interface QuoteSourceMeta {
  sourceType: 'fve' | 'camera' | 'eps' | 'mixed' | 'manual';
  fvDesignId?: string;
  fvVersionId?: string;
  cameraDesignId?: string;
  cameraVersionId?: string;
  epsDesignId?: string;
  summaries?: QuoteSystemSummary[];
}

export interface QuoteData {
  sections: QuoteSection[];
  globalDiscount?: number;
  globalVatRate?: number;
  attachments?: QuoteAttachment[];
  sourceMeta?: QuoteSourceMeta;
  notes?: string;
}

export const TRADE_OPTIONS: { value: string; label: string }[] = [
  { value: 'electric', label: 'Elektro' },
  { value: 'water', label: 'Voda' },
  { value: 'heating', label: 'Topení' },
  { value: 'recuperation', label: 'Rekuperace' },
  { value: 'lighting', label: 'Osvětlení' },
  { value: 'fotovoltaika', label: 'Fotovoltaika' },
  { value: 'camera', label: 'Kamerový systém' },
];

export function calcItemTotal(item: QuoteItem): number {
  const base = (item.quantity || 0) * (item.sellingPrice || 0);
  const result = item.discount ? base * (1 - item.discount / 100) : base;
  return Number.isFinite(result) ? result : 0;
}

export function calcItemCostTotal(item: QuoteItem): number {
  const result = (item.quantity || 0) * (item.costPrice || 0);
  return Number.isFinite(result) ? result : 0;
}

export function calcSectionTotal(section: QuoteSection): number {
  const base = section.items.reduce((s, i) => s + calcItemTotal(i), 0);
  const result = section.discount ? base * (1 - section.discount / 100) : base;
  return Number.isFinite(result) ? result : 0;
}

export function calcSectionCostTotal(section: QuoteSection): number {
  const result = section.items.reduce((s, i) => s + calcItemCostTotal(i), 0);
  return Number.isFinite(result) ? result : 0;
}

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  electric: { bg: '#fefce8', border: '#fde68a', text: '#713f12', accent: '#eab308' },
  water: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a5f', accent: '#3b82f6' },
  heating: { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', accent: '#ef4444' },
  recuperation: { bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d', accent: '#22c55e' },
  lighting: { bg: '#fffbeb', border: '#fed7aa', text: '#78350f', accent: '#f59e0b' },
  fotovoltaika: { bg: '#fff7ed', border: '#fed7aa', text: '#7c2d12', accent: '#f97316' },
  camera: { bg: '#f0f9ff', border: '#bae6fd', text: '#0c4a6e', accent: '#0ea5e9' },
  default: { bg: '#f8fafc', border: '#e2e8f0', text: '#0f172a', accent: '#475569' },
};

export const COLOR_PRESETS = [
  { key: 'yellow', accent: '#eab308', bg: '#fefce8', border: '#fde68a', text: '#713f12' },
  { key: 'blue', accent: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a5f' },
  { key: 'red', accent: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d' },
  { key: 'green', accent: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d' },
  { key: 'amber', accent: '#f59e0b', bg: '#fffbeb', border: '#fed7aa', text: '#78350f' },
  { key: 'teal', accent: '#14b8a6', bg: '#f0fdfa', border: '#99f6e4', text: '#134e4a' },
  { key: 'rose', accent: '#f43f5e', bg: '#fff1f2', border: '#fecdd3', text: '#881337' },
  { key: 'cyan', accent: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', text: '#164e63' },
  { key: 'slate', accent: '#475569', bg: '#f8fafc', border: '#e2e8f0', text: '#0f172a' },
  { key: 'orange', accent: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#7c2d12' },
];

export function getSectionColor(trade?: string, customColor?: string) {
  if (customColor) {
    const preset = COLOR_PRESETS.find(c => c.key === customColor);
    if (preset) return { bg: preset.bg, border: preset.border, text: preset.text, accent: preset.accent };
  }
  return SECTION_COLORS[trade || 'default'] || SECTION_COLORS.default;
}

export function parseQuoteData(jsonData: any): QuoteData {
  if (typeof jsonData === 'string') {
    return JSON.parse(jsonData);
  }
  return jsonData as QuoteData;
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

async function fetchDesignModulePrices(dsProductIds: string[]): Promise<{
  modulePriceMap: Record<string, Record<string, { price: number; cost: number }>>;
  globalModulePrices: Record<string, { price: number }>;
}> {
  const modulePriceMap: Record<string, Record<string, { price: number; cost: number }>> = {};
  const globalModulePrices: Record<string, { price: number }> = {};

  if (dsProductIds.length === 0) return { modulePriceMap, globalModulePrices };

  const [pdmRes, dmRes] = await Promise.all([
    supabase.from('product_design_modules').select('product_id, design_module_id, price').in('product_id', dsProductIds),
    supabase.from('design_modules').select('id, name, price'),
  ]);

  const dmById = new Map((dmRes.data || []).map((dm: any) => [dm.id, dm]));

  for (const dm of (dmRes.data || [])) {
    globalModulePrices[dm.name] = { price: safeNum(dm.price) };
  }

  for (const pdm of (pdmRes.data || [])) {
    const dm = dmById.get(pdm.design_module_id);
    if (!dm) continue;
    if (!modulePriceMap[pdm.product_id]) modulePriceMap[pdm.product_id] = {};
    modulePriceMap[pdm.product_id][dm.name] = {
      price: safeNum(pdm.price) || safeNum(dm.price),
      cost: (safeNum(pdm.price) || safeNum(dm.price)) * 0.7,
    };
  }

  return { modulePriceMap, globalModulePrices };
}

function explodeDesignSeries(
  product: Product,
  selected: SelectionState,
  modulePriceMap: Record<string, Record<string, { price: number; cost: number }>>,
  globalModulePrices: Record<string, { price: number }>,
): QuoteItem[] {
  const placements = selected[product.id]?.placements ?? [];
  if (placements.length === 0) return [];

  const frameCounts: Record<string, { size: number; colorName: string; count: number }> = {};
  const moduleCounts: Record<string, number> = {};

  for (const pl of placements) {
    if (!pl.config) continue;
    const colorName = pl.config.colorName || '';
    const key = `${pl.config.frameSize}_${colorName}`;
    if (!frameCounts[key]) frameCounts[key] = { size: pl.config.frameSize, colorName, count: 0 };
    frameCounts[key].count++;
    for (const m of pl.config.modules) {
      moduleCounts[m] = (moduleCounts[m] || 0) + 1;
    }
  }

  const items: QuoteItem[] = [];
  const framePrices = (product.frame_prices as Record<string, number> | null) ?? {};
  const productModPrices = modulePriceMap[product.id] || {};
  const brandPrefix = product.brand ? `${product.brand} ` : '';

  for (const entry of Object.values(frameCounts).sort((a, b) => a.size - b.size || a.colorName.localeCompare(b.colorName))) {
    const frameUnitPrice = safeNum(framePrices[String(entry.size)]);
    const colorSuffix = entry.colorName ? ` - ${entry.colorName}` : '';
    items.push({
      id: crypto.randomUUID(),
      code: product.code,
      name: `Rámeček ${entry.size}R${colorSuffix} - ${brandPrefix}${product.name}`,
      unit: 'ks',
      quantity: entry.count,
      sellingPrice: frameUnitPrice,
      costPrice: frameUnitPrice * 0.7,
      productId: product.id,
    });
  }

  for (const [moduleName, count] of Object.entries(moduleCounts).sort(([a], [b]) => a.localeCompare(b))) {
    const modPrice = productModPrices[moduleName]?.price
      ?? globalModulePrices[moduleName]?.price
      ?? 0;
    const modCost = productModPrices[moduleName]?.cost
      ?? modPrice * 0.7;
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `${moduleName} - ${brandPrefix}${product.name}`,
      unit: 'ks',
      quantity: count,
      sellingPrice: modPrice,
      costPrice: modCost,
      productId: product.id,
    });
  }

  return items;
}

function getPlacementColorLabel(pl: { config?: { colorName?: string }; colorName?: string }): string {
  return pl.config?.colorName ?? pl.colorName ?? '';
}

export async function buildSectionsFromCatalog(
  selected: SelectionState,
  products: Product[],
  categories: Category[],
  materials: Material[],
  floors: Floor[],
  heatingSystems: HeatingSystemFull[],
): Promise<QuoteSection[]> {
  const sections: QuoteSection[] = [];
  const categoryMap = new Map<string, { cat: Category; items: QuoteItem[]; productTrades: string[] }>();

  const objectCounts: Record<string, number> = {};
  for (const floor of floors) {
    for (const obj of floor.objects ?? []) {
      objectCounts[obj.productId] = (objectCounts[obj.productId] || 0) + 1;
    }
  }

  const allProductIds = new Set([...Object.keys(selected), ...Object.keys(objectCounts)]);

  const dsProductIds = [...allProductIds].filter(id => {
    const p = products.find(pr => pr.id === id);
    return p && p.kind === 'design_series';
  });

  const { modulePriceMap, globalModulePrices } = await fetchDesignModulePrices(dsProductIds);

  allProductIds.forEach((productId) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const category = categories.find((c) => c.id === product.category_id);
    const catId = category?.id || 'none';

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, { cat: category!, items: [], productTrades: [] });
    }
    if (product.trade) categoryMap.get(catId)!.productTrades.push(product.trade);

    if (product.kind === 'design_series' && selected[productId]?.placements?.some(p => p.config)) {
      const exploded = explodeDesignSeries(product, selected, modulePriceMap, globalModulePrices);
      categoryMap.get(catId)!.items.push(...exploded);
    } else {
      const placements = selected[productId]?.placements ?? [];
      const objQty = objectCounts[productId] ?? 0;

      const colorGroups: Record<string, number> = {};
      let noColorCount = 0;
      for (const pl of placements) {
        const cn = getPlacementColorLabel(pl);
        if (cn) {
          colorGroups[cn] = (colorGroups[cn] || 0) + 1;
        } else {
          noColorCount++;
        }
      }

      const hasColors = Object.keys(colorGroups).length > 0;

      if (hasColors) {
        for (const [colorName, count] of Object.entries(colorGroups).sort(([a], [b]) => a.localeCompare(b))) {
          categoryMap.get(catId)!.items.push({
            id: crypto.randomUUID(),
            code: product.code,
            name: `${product.name} - ${colorName}`,
            unit: 'ks',
            quantity: count,
            sellingPrice: product.price || 0,
            costPrice: product.purchase_price || 0,
            productId: product.id,
          });
        }
        if (noColorCount + objQty > 0) {
          categoryMap.get(catId)!.items.push({
            id: crypto.randomUUID(),
            code: product.code,
            name: product.name,
            unit: 'ks',
            quantity: noColorCount + objQty,
            sellingPrice: product.price || 0,
            costPrice: product.purchase_price || 0,
            productId: product.id,
          });
        }
      } else {
        const qty = (placements.length + objQty) || 1;
        categoryMap.get(catId)!.items.push({
          id: crypto.randomUUID(),
          code: product.code,
          name: product.name,
          unit: 'ks',
          quantity: qty,
          sellingPrice: product.price || 0,
          costPrice: product.purchase_price || 0,
          productId: product.id,
        });
      }
    }
  });

  categoryMap.forEach(({ cat, items, productTrades }) => {
    const tradeCounts: Record<string, number> = {};
    for (const t of productTrades) tradeCounts[t] = (tradeCounts[t] || 0) + 1;
    const topTrade = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    sections.push({
      id: crypto.randomUUID(),
      name: cat?.name || 'Bez kategorie',
      items,
      trade: topTrade || guessTradeFromCategory(cat?.slug || ''),
    });
  });

  const materialSection = buildMaterialSection(materials, floors);
  if (materialSection) sections.push(materialSection);

  const fittingsSection = buildFittingsSection(materials, floors);
  if (fittingsSection) sections.push(fittingsSection);

  const heatingSection = buildHeatingSection(floors, heatingSystems);
  if (heatingSection) sections.push(heatingSection);

  const lightingSection = buildLightingSection(selected, products, floors);
  if (lightingSection) sections.push(lightingSection);

  return sections;
}

function guessTradeFromCategory(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes('light') || s.includes('osvetl') || s.includes('svet') || s.includes('svit') || s.includes('sv_t')) return 'lighting';
  if (s.includes('water') || s.includes('vod')) return 'water';
  if (s.includes('heat') || s.includes('top') || s.includes('vytap') || s.includes('vyt_p')) return 'heating';
  if (s.includes('recup') || s.includes('rekup') || s.includes('vzd') || s.includes('vent')) return 'recuperation';
  if (s.includes('foto') || s.includes('solar')) return 'electric';
  return 'electric';
}

function buildMaterialSection(
  materials: Material[],
  floors: Floor[],
): QuoteSection | null {
  const materialTotals: Record<string, { meters: number | null; normalized: number; type: string }> = {};
  const anyScale = floors.find((f) => f.scale)?.scale;

  for (const floor of floors) {
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const circuit = (floor.circuits ?? []).find((c) => c.id === cable.circuitId);
      const len = polylineLength(cable.points);
      const metersLen = floor.scale ? normalizedToMeters(len, floor.scale) : null;
      if (!materialTotals[cable.materialName]) {
        materialTotals[cable.materialName] = { normalized: 0, type: circuit?.type ?? 'electric', meters: null };
      }
      materialTotals[cable.materialName].normalized += len;
      if (metersLen !== null) {
        materialTotals[cable.materialName].meters = (materialTotals[cable.materialName].meters ?? 0) + metersLen;
      }
    }
  }

  if (Object.keys(materialTotals).length === 0) return null;

  const items: QuoteItem[] = [];
  for (const [name, data] of Object.entries(materialTotals).sort(([a], [b]) => a.localeCompare(b))) {
    const lengthM = data.meters ?? (anyScale ? normalizedToMeters(data.normalized, anyScale) : null);
    if (!lengthM || lengthM <= 0) continue;
    const mat = materials.find(m => m.name === name);
    const pricePerM = mat?.price_per_unit ?? 0;
    const costPerM = mat?.purchase_price ?? pricePerM * 0.7;
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: `${name}`,
      unit: 'm',
      quantity: Math.round(lengthM * 10) / 10,
      sellingPrice: pricePerM,
      costPrice: costPerM,
      isAutoMaterial: true,
    });
  }

  if (items.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name: 'Trasování - kabely a trubky',
    items,
    trade: 'electric',
    icon: 'cable',
  };
}

interface TradeStats {
  totalBends: number;
  totalTees: number;
  totalEndpoints: number;
  totalMeters: number;
}

function buildFittingsSection(
  materials: Material[],
  floors: Floor[],
): QuoteSection | null {
  const fittingMaterials = materials.filter(m => m.material_type === 'fitting' && m.is_active && m.fitting_calc_rule);
  if (fittingMaterials.length === 0) return null;

  const anyScale = floors.find((f) => f.scale)?.scale;
  const tradeStats: Record<string, TradeStats> = {};

  for (const floor of floors) {
    const cables = floor.cables ?? [];
    const circuits = floor.circuits ?? [];

    const cablesByTrade: Record<string, typeof cables> = {};

    for (const cable of cables) {
      const circuit = circuits.find((c) => c.id === cable.circuitId);
      const trade = circuit?.type ?? 'electric';
      if (!cablesByTrade[trade]) cablesByTrade[trade] = [];
      cablesByTrade[trade].push(cable);
    }

    for (const [trade, tradeCables] of Object.entries(cablesByTrade)) {
      if (!tradeStats[trade]) {
        tradeStats[trade] = { totalBends: 0, totalTees: 0, totalEndpoints: 0, totalMeters: 0 };
      }
      const stats = tradeStats[trade];

      for (const cable of tradeCables) {
        const bends = analyzeBends(cable.points);
        stats.totalBends += bends.length;

        if (cable.points.length >= 2) {
          stats.totalEndpoints += 2;
        }

        const len = polylineLength(cable.points);
        const metersLen = floor.scale ? normalizedToMeters(len, floor.scale) : (anyScale ? normalizedToMeters(len, anyScale) : 0);
        stats.totalMeters += metersLen;
      }

      stats.totalTees += countTPieces(tradeCables);
    }
  }

  if (Object.keys(tradeStats).length === 0) return null;

  const items: QuoteItem[] = [];

  for (const mat of fittingMaterials) {
    const stats = tradeStats[mat.trade];
    if (!stats) continue;

    let qty = 0;
    switch (mat.fitting_calc_rule) {
      case 'per_bend':
        qty = stats.totalBends;
        break;
      case 'per_tee':
        qty = stats.totalTees;
        break;
      case 'per_endpoint':
        qty = stats.totalEndpoints;
        break;
      case 'per_10m':
        qty = Math.ceil(stats.totalMeters / 10);
        break;
    }

    if (qty <= 0) continue;

    items.push({
      id: crypto.randomUUID(),
      code: '',
      name: mat.name,
      unit: mat.unit,
      quantity: qty,
      sellingPrice: mat.price_per_unit || 0,
      costPrice: mat.purchase_price || (mat.price_per_unit * 0.7) || 0,
      isAutoMaterial: true,
    });
  }

  if (items.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name: 'Tvarovky a příslušenství',
    items,
    trade: 'electric',
    icon: 'wrench',
  };
}

function buildHeatingSection(
  floors: Floor[],
  heatingSystems: HeatingSystemFull[],
): QuoteSection | null {
  const heatedRooms = floors.flatMap((floor) =>
    (floor.rooms ?? []).filter((r) => r.heatingSystemId).map((r) => ({ room: r, floor }))
  );

  if (heatedRooms.length === 0) return null;

  const items: QuoteItem[] = [];
  const materialAgg: Record<string, { qty: number; unit: string; price: number }> = {};

  for (const { room, floor } of heatedRooms) {
    const sys = heatingSystems.find((s) => s.system.id === room.heatingSystemId);
    if (!sys || !floor.scale) continue;
    const areaM2 = polygonAreaM2(room.points, floor.scale);
    const perimeterM = polygonPerimeterM(room.points, floor.scale);
    const doorWidths = (room.doors ?? []).reduce((s, d) => s + d.widthM, 0);
    const effectivePerimeter = Math.max(0, perimeterM - doorWidths);
    const lines = calculateHeatingMaterials(sys, room.heatingConfig ?? {}, areaM2, effectivePerimeter);

    for (const line of lines) {
      const key = `${line.name}|${line.unit}`;
      if (!materialAgg[key]) {
        materialAgg[key] = { qty: 0, unit: line.unit, price: line.pricePerUnit };
      }
      materialAgg[key].qty += line.quantity;
    }
  }

  for (const [key, val] of Object.entries(materialAgg).sort(([a], [b]) => a.localeCompare(b))) {
    const name = key.split('|')[0];
    items.push({
      id: crypto.randomUUID(),
      code: '',
      name,
      unit: val.unit,
      quantity: Math.round(val.qty * 10) / 10,
      sellingPrice: val.price,
      costPrice: val.price * 0.7,
      isAutoMaterial: true,
    });
  }

  if (items.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name: 'Podlahové vytápění - materiál',
    items,
    trade: 'heating',
    icon: 'flame',
  };
}

function buildLightingSection(
  selected: SelectionState,
  products: Product[],
  floors: Floor[],
): QuoteSection | null {
  const lightProducts = products.filter(p => p.lumens > 0 && selected[p.id]);
  if (lightProducts.length === 0) return null;

  const roomsWithLux = floors.flatMap(f =>
    (f.rooms ?? []).filter(r => r.requiredLux && r.requiredLux > 0 && f.scale).map(r => ({ room: r, floor: f }))
  );
  if (roomsWithLux.length === 0) return null;

  const items: QuoteItem[] = [];

  for (const { room, floor } of roomsWithLux) {
    const areaM2 = polygonAreaM2(room.points, floor.scale!);
    for (const lp of lightProducts) {
      const needed = calculateLighting(room.requiredLux!, areaM2, lp.lumens);
      if (needed > 0) {
        items.push({
          id: crypto.randomUUID(),
          code: lp.code,
          name: `${lp.name} (${room.name} - ${needed} ks doporučeno)`,
          unit: 'ks',
          quantity: needed,
          sellingPrice: lp.price || 0,
          costPrice: lp.purchase_price || 0,
          productId: lp.id,
          isAutoMaterial: true,
        });
      }
    }
  }

  if (items.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name: 'Osvětlení - světelný návrh',
    items,
    trade: 'lighting',
    icon: 'lightbulb',
  };
}

interface QuoteElementInput {
  id: string;
  element_type_id: string;
  room_id: string | null;
  quantity: number;
}

interface DesignElementTypeMin {
  id: string;
  name: string;
  category: string;
}

export function buildQuoteSectionsFromAssignments(
  elements: QuoteElementInput[],
  assignments: ProductAssignment[],
  elementTypes: DesignElementTypeMin[],
  products: Product[],
  _roomMap: Map<string, string>,
  productKindMap?: Map<string, string>
): QuoteSection[] {
  const productQuantities = new Map<string, { product: Product; quantity: number; category: string }>();
  const typeMap = new Map(elementTypes.map((t) => [t.id, t]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const el of elements) {
    const resolved = resolveAssignmentForElement({
      elementId: el.id,
      elementTypeId: el.element_type_id,
      roomId: el.room_id,
      assignments,
      productKindMap,
    });

    const productId = resolved.effectiveProductId;
    if (!productId) continue;

    const product = productMap.get(productId);
    if (!product) continue;

    const elType = typeMap.get(el.element_type_id);
    const category = elType?.category ?? 'other';

    const existing = productQuantities.get(productId);
    if (existing) {
      existing.quantity += el.quantity;
    } else {
      productQuantities.set(productId, { product, quantity: el.quantity, category });
    }
  }

  const categoryGroups = new Map<string, { product: Product; quantity: number }[]>();
  for (const [, entry] of productQuantities) {
    const cat = entry.category;
    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, []);
    }
    categoryGroups.get(cat)!.push({ product: entry.product, quantity: entry.quantity });
  }

  const CATEGORY_LABELS: Record<string, string> = {
    elektro: 'Elektroinstalace',
    data: 'Datove rozvody',
    camera: 'Kamerovy system',
    eps: 'Zabezpeceni EPS',
    hvac: 'Topeni a klimatizace',
    water: 'Vodovod a kanalizace',
    gas: 'Plynovod',
    slaboproud: 'Slaboproud',
    smart: 'Smart Home',
    other: 'Ostatni',
  };

  const CATEGORY_TRADE: Record<string, string> = {
    elektro: 'electric',
    data: 'electric',
    camera: 'camera',
    eps: 'electric',
    hvac: 'heating',
    water: 'water',
    gas: 'heating',
    slaboproud: 'electric',
    smart: 'electric',
    other: 'default',
  };

  const sections: QuoteSection[] = [];

  for (const [category, items] of categoryGroups) {
    const quoteItems: QuoteItem[] = items.map((item) => ({
      id: crypto.randomUUID(),
      code: item.product.code,
      name: item.product.name,
      unit: 'ks',
      quantity: item.quantity,
      sellingPrice: item.product.price ?? 0,
      costPrice: item.product.purchase_price ?? 0,
      productId: item.product.id,
    }));

    sections.push({
      id: crypto.randomUUID(),
      name: CATEGORY_LABELS[category] || category,
      items: quoteItems,
      trade: CATEGORY_TRADE[category] || 'default',
    });
  }

  return sections;
}

export interface QuoteWarning {
  type: 'unassigned_element' | 'incompatible_product' | 'low_stock' | 'no_price' | 'missing_frame';
  severity: 'error' | 'warning' | 'info';
  message: string;
  elementId?: string;
  productId?: string;
}

export interface MountingGroupQuoteInput {
  id: string;
  frameSize: number;
  orientation: 'horizontal' | 'vertical';
  designSeriesId: string | null;
  colorName: string | null;
  modules: string[];
  label?: string | null;
  roomName?: string | null;
}

function deriveFrameRoleKey(frameSize: number, orientation: 'horizontal' | 'vertical'): string {
  if (frameSize === 1) return 'frame_1';
  return `frame_${frameSize}_${orientation}`;
}

export function buildQuoteSectionsFromMountingGroups(
  mountingGroups: MountingGroupQuoteInput[],
  products: Product[],
  designSeriesLinks: Array<{
    design_series_id: string;
    product_id: string;
    role_key: string;
    is_default: boolean;
    priority: number;
  }>
): { sections: QuoteSection[]; warnings: QuoteWarning[] } {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warnings: QuoteWarning[] = [];

  interface FrameCountEntry {
    product: Product;
    targetProduct: Product | null;
    size: number;
    orientation: 'horizontal' | 'vertical';
    colorName: string;
    count: number;
    usedFallback: boolean;
  }
  const frameCounts: Record<string, FrameCountEntry> = {};
  const moduleCounts: Record<string, { product: Product; count: number }> = {};

  for (const group of mountingGroups) {
    if (!group.designSeriesId) {
      const locationHint = group.label || group.roomName || '';
      warnings.push({
        type: 'missing_frame',
        severity: 'warning',
        message: `Vícerámeček${locationHint ? ` "${locationHint}"` : ''} nemá přiřazenou designovou řadu`,
      });
      continue;
    }

    const dsProduct = productMap.get(group.designSeriesId);
    if (!dsProduct) continue;

    const seriesLinks = designSeriesLinks.filter((l) => l.design_series_id === group.designSeriesId);
    const frameRoleKey = deriveFrameRoleKey(group.frameSize, group.orientation);

    const frameLinks = seriesLinks
      .filter((l) => l.role_key === frameRoleKey)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return b.priority - a.priority;
      });

    let targetFrameProduct: Product | null = null;
    let usedFallback = false;

    if (frameLinks.length > 0) {
      targetFrameProduct = productMap.get(frameLinks[0].product_id) ?? null;
    }

    if (!targetFrameProduct) {
      usedFallback = true;
      warnings.push({
        type: 'missing_frame',
        severity: 'info',
        message: `Řada "${dsProduct.name}" nemá mapování pro ${frameRoleKey} - používám fallback`,
      });
    }

    const colorKey = `${group.designSeriesId}_${group.frameSize}_${group.orientation}_${group.colorName || ''}`;
    if (!frameCounts[colorKey]) {
      frameCounts[colorKey] = {
        product: dsProduct,
        targetProduct: targetFrameProduct,
        size: group.frameSize,
        orientation: group.orientation,
        colorName: group.colorName || '',
        count: 0,
        usedFallback,
      };
    }
    frameCounts[colorKey].count++;

    for (const moduleName of group.modules) {
      if (!moduleName) continue;

      const matchingLinks = seriesLinks
        .filter((l) => l.role_key === moduleName)
        .sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return b.priority - a.priority;
        });

      const selectedLink = matchingLinks[0];
      if (!selectedLink) {
        warnings.push({
          type: 'unassigned_element',
          severity: 'warning',
          message: `Modul "${moduleName}" nemá přiřazeny produkt v designové řadě`,
        });
        continue;
      }

      const moduleProduct = productMap.get(selectedLink.product_id);
      if (!moduleProduct) {
        warnings.push({
          type: 'unassigned_element',
          severity: 'error',
          message: `Produkt pro modul "${moduleName}" neexistuje`,
          productId: selectedLink.product_id,
        });
        continue;
      }

      const moduleKey = `${selectedLink.product_id}_${group.designSeriesId}`;
      if (!moduleCounts[moduleKey]) {
        moduleCounts[moduleKey] = { product: moduleProduct, count: 0 };
      }
      moduleCounts[moduleKey].count++;
    }
  }

  const items: QuoteItem[] = [];

  for (const entry of Object.values(frameCounts).sort((a, b) => {
    if (a.size !== b.size) return a.size - b.size;
    if (a.orientation !== b.orientation) return a.orientation.localeCompare(b.orientation);
    return a.colorName.localeCompare(b.colorName);
  })) {
    const brandPrefix = entry.product.brand ? `${entry.product.brand} ` : '';
    const orientationLabel = entry.size > 1 ? (entry.orientation === 'horizontal' ? ' H' : ' V') : '';
    const colorSuffix = entry.colorName ? ` - ${entry.colorName}` : '';

    let frameUnitPrice = 0;
    let frameCostPrice = 0;
    let frameCode = entry.product.code;
    let frameName = `Ramecek ${entry.size}R${orientationLabel}${colorSuffix} - ${brandPrefix}${entry.product.name}`;
    let productIdForItem = entry.product.id;

    if (entry.targetProduct) {
      frameUnitPrice = entry.targetProduct.price ?? 0;
      frameCostPrice = entry.targetProduct.purchase_price ?? frameUnitPrice * 0.7;
      frameCode = entry.targetProduct.code;
      frameName = `${entry.targetProduct.name}${colorSuffix}`;
      productIdForItem = entry.targetProduct.id;
    } else {
      const framePrices = (entry.product.frame_prices as Record<string, number> | null) ?? {};
      frameUnitPrice = framePrices[String(entry.size)] || 0;
      frameCostPrice = frameUnitPrice * 0.7;
    }

    if (frameUnitPrice === 0 && !entry.usedFallback) {
      warnings.push({
        type: 'no_price',
        severity: 'warning',
        message: `Rámeček ${entry.size}R${orientationLabel} nemá nastavenou cenu`,
        productId: productIdForItem,
      });
    }

    items.push({
      id: crypto.randomUUID(),
      code: frameCode,
      name: frameName,
      unit: 'ks',
      quantity: entry.count,
      sellingPrice: frameUnitPrice,
      costPrice: frameCostPrice,
      productId: productIdForItem,
    });
  }

  for (const { product, count } of Object.values(moduleCounts).sort((a, b) => a.product.name.localeCompare(b.product.name))) {
    const price = product.price ?? 0;
    const cost = product.purchase_price ?? price * 0.7;

    if (price === 0) {
      warnings.push({
        type: 'no_price',
        severity: 'info',
        message: `Produkt "${product.name}" nemá nastavenou prodejní cenu`,
        productId: product.id,
      });
    }

    items.push({
      id: crypto.randomUUID(),
      code: product.code,
      name: product.name,
      unit: 'ks',
      quantity: count,
      sellingPrice: price,
      costPrice: cost,
      productId: product.id,
    });
  }

  if (items.length === 0) {
    return { sections: [], warnings };
  }

  return {
    sections: [
      {
        id: crypto.randomUUID(),
        name: 'Viceramecky a moduly',
        items,
        trade: 'electric',
        icon: 'grid',
      },
    ],
    warnings,
  };
}

export interface FramePreviewEntry {
  seriesName: string;
  seriesBrand: string | null;
  frameSize: number;
  orientation: 'horizontal' | 'vertical';
  colorName: string | null;
  count: number;
  hasMapping: boolean;
  targetProductName: string | null;
}

export function aggregateFramePreview(
  mountingGroups: MountingGroupQuoteInput[],
  products: Product[],
  designSeriesLinks: Array<{
    design_series_id: string;
    product_id: string;
    role_key: string;
    is_default: boolean;
    priority: number;
  }>
): { frames: FramePreviewEntry[]; warnings: string[] } {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warnings: string[] = [];
  const frameMap = new Map<string, FramePreviewEntry>();

  for (const group of mountingGroups) {
    if (!group.designSeriesId) {
      const hint = group.label || group.roomName || '';
      warnings.push(`Viceramecek${hint ? ` "${hint}"` : ''} nema designovou radu`);
      continue;
    }

    const dsProduct = productMap.get(group.designSeriesId);
    if (!dsProduct) continue;

    const frameRoleKey = deriveFrameRoleKey(group.frameSize, group.orientation);
    const seriesLinks = designSeriesLinks.filter((l) => l.design_series_id === group.designSeriesId);

    const frameLinks = seriesLinks
      .filter((l) => l.role_key === frameRoleKey)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return b.priority - a.priority;
      });

    const targetProduct = frameLinks.length > 0 ? productMap.get(frameLinks[0].product_id) : null;
    const hasMapping = !!targetProduct;

    if (!hasMapping && group.frameSize > 1) {
      warnings.push(`Rada "${dsProduct.name}" nema mapovani pro ${frameRoleKey}`);
    }

    const key = `${group.designSeriesId}_${group.frameSize}_${group.orientation}_${group.colorName || ''}`;
    const existing = frameMap.get(key);

    if (existing) {
      existing.count++;
    } else {
      frameMap.set(key, {
        seriesName: dsProduct.name,
        seriesBrand: dsProduct.brand,
        frameSize: group.frameSize,
        orientation: group.orientation,
        colorName: group.colorName,
        count: 1,
        hasMapping,
        targetProductName: targetProduct?.name ?? null,
      });
    }
  }

  const frames = [...frameMap.values()].sort((a, b) => {
    if (a.seriesName !== b.seriesName) return a.seriesName.localeCompare(b.seriesName);
    if (a.frameSize !== b.frameSize) return a.frameSize - b.frameSize;
    if (a.orientation !== b.orientation) return a.orientation.localeCompare(b.orientation);
    return (a.colorName ?? '').localeCompare(b.colorName ?? '');
  });

  return { frames, warnings: [...new Set(warnings)] };
}

export function validateQuoteSections(
  sections: QuoteSection[],
  warehouseStock?: Map<string, number>
): QuoteWarning[] {
  const warnings: QuoteWarning[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (!item.productId) continue;

      if (item.sellingPrice === 0) {
        warnings.push({
          type: 'no_price',
          severity: 'warning',
          message: `Položka "${item.name}" nemá nastavenou cenu`,
          productId: item.productId,
        });
      }

      if (warehouseStock) {
        const stock = warehouseStock.get(item.productId) ?? 0;
        if (stock < item.quantity) {
          warnings.push({
            type: 'low_stock',
            severity: stock === 0 ? 'warning' : 'info',
            message: stock === 0
              ? `Polozka "${item.name}" neni na sklade`
              : `Polozka "${item.name}" - na sklade ${stock} ks, potreba ${item.quantity} ks`,
            productId: item.productId,
          });
        }
      }
    }
  }

  return warnings;
}

export function mergeQuoteSections(
  baseSections: QuoteSection[],
  additionalSections: QuoteSection[]
): QuoteSection[] {
  // B6: hluboká kopie — původní pole (React state) se nesmí mutovat,
  // jinak se při opakovaném merge tiše zdvojnásobovala množství.
  const merged: QuoteSection[] = baseSections.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i })),
  }));

  for (const addSection of additionalSections) {
    const existing = merged.find((s) => s.trade === addSection.trade);
    if (existing) {
      for (const item of addSection.items) {
        const existingItem = existing.items.find((i) => i.productId === item.productId && i.name === item.name);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          existing.items.push({ ...item });
        }
      }
    } else {
      merged.push({ ...addSection, items: addSection.items.map((i) => ({ ...i })) });
    }
  }

  return merged;
}

export interface BuildSchematicQuoteParams {
  designElements: ProjectDesignElement[];
  elementTypes: DesignElementType[];
  assignments: ProductAssignment[];
  mountingGroups: MountingGroupWithSlots[];
  designSeriesLinks: DesignSeriesProductLink[];
  products: Product[];
  productKindMap: Map<string, string>;
  rooms: Array<{ id: string; name: string }>;
  floors: Floor[];
}

export function buildSchematicQuoteSections(params: BuildSchematicQuoteParams): {
  sections: QuoteSection[];
  warnings: QuoteWarning[];
  summary: SchematicSummaryOutput | null;
} {
  const { designElements, elementTypes, assignments, mountingGroups, designSeriesLinks, products, productKindMap, rooms, floors } = params;

  if (designElements.length === 0 && mountingGroups.length === 0) {
    return { sections: [], warnings: [], summary: null };
  }

  const summary = buildSchematicSummary({
    designElements,
    elementTypes,
    assignments,
    mountingGroups,
    designSeriesLinks,
    products,
    productKindMap,
    rooms: rooms.map(r => ({ id: r.id, name: r.name, points: [] })),
    floors,
  });

  const { sections, warnings } = schematicSummaryToQuoteSections(summary, products);

  return { sections, warnings, summary };
}

export { type SchematicSummaryOutput } from '../../lib/schematicSummaryBuilder';

export function mergeSectionLists(catalogSections: QuoteSection[], schematicSections: QuoteSection[]): QuoteSection[] {
  if (catalogSections.length === 0) return schematicSections;
  if (schematicSections.length === 0) return catalogSections;
  const result = [...catalogSections];
  for (const schSection of schematicSections) {
    const existing = result.find(s => s.trade === schSection.trade && s.name === schSection.name);
    if (existing) {
      const merged = [...existing.items];
      for (const item of schSection.items) {
        const dup = merged.find(i => i.productId && i.productId === item.productId);
        if (dup) {
          dup.quantity += item.quantity;
        } else {
          merged.push({ ...item });
        }
      }
      existing.items = merged;
    } else {
      result.push({ ...schSection });
    }
  }
  return result;
}
