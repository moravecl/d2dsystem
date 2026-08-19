import type { Product } from '../types/database';
import type {
  ProjectDesignElement,
  DesignElementType,
  ProductAssignment,
  MountingGroup,
  MountingGroupSlot,
  DesignSeriesProductLink,
} from '../types/designElements';
import type { Room, Floor } from '../hooks/useProjectState';
import {
  resolveAssignmentForElement,
  type ResolvedAssignment,
  type AssignmentItemType,
  type AssignmentSourceLevel,
} from './assignmentResolver';
import type { QuoteSection, QuoteItem, QuoteWarning } from '../components/catalog/quoteHelpers';

export interface MountingGroupWithSlots extends MountingGroup {
  slots: MountingGroupSlot[];
}

export interface SchematicSummaryRow {
  elementTypeId: string;
  elementTypeName: string;
  category: string;
  roomId: string | null;
  roomName: string | null;
  floorId: string | null;
  floorName: string | null;
  quantity: number;
  assignmentType: AssignmentItemType;
  sourceLevel: AssignmentSourceLevel;
  inherited: boolean;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  productPrice: number;
  productCost: number;
  designSeriesId: string | null;
  designSeriesName: string | null;
  targetProductIds: string[];
  targetProductNames: string[];
  mountingGroupId: string | null;
  mountingGroupSize: number | null;
  mountingGroupOrientation: 'horizontal' | 'vertical' | null;
  frameContribution: boolean;
  warnings: SchematicWarning[];
  fallbackUsed: boolean;
  elementIds: string[];
}

export interface GeneratedFrameRow {
  designSeriesId: string;
  designSeriesName: string;
  designSeriesBrand: string | null;
  frameSize: number;
  orientation: 'horizontal' | 'vertical';
  colorName: string | null;
  quantity: number;
  hasMapping: boolean;
  targetProductId: string | null;
  targetProductName: string | null;
  targetProductCode: string | null;
  unitPrice: number;
  unitCost: number;
  warnings: SchematicWarning[];
  fallbackUsed: boolean;
}

export interface ModuleAggregateRow {
  moduleName: string;
  designSeriesId: string;
  designSeriesName: string;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  warnings: SchematicWarning[];
}

export interface SchematicWarning {
  type: 'no_assignment' | 'no_mapping' | 'no_price' | 'missing_frame' | 'incompatible' | 'fallback';
  severity: 'error' | 'warning' | 'info';
  message: string;
  elementId?: string;
  productId?: string;
  elementTypeId?: string;
}

export interface SchematicSummaryOutput {
  elementRows: SchematicSummaryRow[];
  aggregatedRows: AggregatedElementRow[];
  frameRows: GeneratedFrameRow[];
  moduleRows: ModuleAggregateRow[];
  warnings: SchematicWarning[];
  stats: SchematicSummaryStats;
}

export interface AggregatedElementRow {
  elementTypeId: string;
  elementTypeName: string;
  category: string;
  quantity: number;
  assignmentType: AssignmentItemType;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  productPrice: number;
  productCost: number;
  designSeriesId: string | null;
  designSeriesName: string | null;
  roomBreakdown: Array<{ roomId: string | null; roomName: string | null; count: number }>;
  hasWarnings: boolean;
  elementIds: string[];
}

export interface SchematicSummaryStats {
  totalElements: number;
  assignedElements: number;
  unassignedElements: number;
  designSeriesElements: number;
  directProductElements: number;
  elementsInGroups: number;
  totalGroups: number;
  totalFrames: number;
  totalModules: number;
  warningCount: number;
  errorCount: number;
}

export interface BuildSchematicSummaryParams {
  designElements: ProjectDesignElement[];
  elementTypes: DesignElementType[];
  assignments: ProductAssignment[];
  mountingGroups: MountingGroupWithSlots[];
  designSeriesLinks: DesignSeriesProductLink[];
  products: Product[];
  productKindMap: Map<string, string>;
  rooms: Room[];
  floors: Floor[];
}

function deriveFrameRoleKey(frameSize: number, orientation: 'horizontal' | 'vertical'): string {
  if (frameSize === 1) return 'frame_1';
  return `frame_${frameSize}_${orientation}`;
}

export function buildSchematicSummary(params: BuildSchematicSummaryParams): SchematicSummaryOutput {
  const {
    designElements,
    elementTypes,
    assignments,
    mountingGroups,
    designSeriesLinks,
    products,
    productKindMap,
    rooms,
    floors,
  } = params;

  const typeMap = new Map(elementTypes.map((t) => [t.id, t]));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const floorMap = new Map(floors.map((f) => [f.id, f]));

  const elementInGroup = new Map<string, MountingGroupWithSlots>();
  for (const group of mountingGroups) {
    for (const slot of group.slots) {
      if (slot.element_id) {
        elementInGroup.set(slot.element_id, group);
      }
    }
  }

  const warnings: SchematicWarning[] = [];
  const elementRows: SchematicSummaryRow[] = [];

  for (const element of designElements) {
    const elType = typeMap.get(element.element_type_id);
    if (!elType) continue;

    const resolved = resolveAssignmentForElement({
      elementId: element.id,
      elementTypeId: element.element_type_id,
      roomId: element.room_id,
      assignments,
      productKindMap,
    });

    const room = element.room_id ? roomMap.get(element.room_id) : null;
    const floor = element.floor_id ? floorMap.get(element.floor_id) : null;
    const group = elementInGroup.get(element.id);

    const product = resolved.effectiveProductId ? productMap.get(resolved.effectiveProductId) : null;
    const isDesignSeries = resolved.itemType === 'design_series';

    const rowWarnings: SchematicWarning[] = [];

    if (!resolved.effectiveProductId) {
      rowWarnings.push({
        type: 'no_assignment',
        severity: 'warning',
        message: `${elType.name} nema prirazeny produkt`,
        elementId: element.id,
        elementTypeId: element.element_type_id,
      });
    } else if (product && product.price === 0 && product.price === null) {
      rowWarnings.push({
        type: 'no_price',
        severity: 'info',
        message: `Produkt "${product.name}" nema nastavenou cenu`,
        productId: product.id,
      });
    }

    if (resolved.compatibilityStatus === 'incompatible') {
      rowWarnings.push({
        type: 'incompatible',
        severity: 'warning',
        message: `Produkt "${product?.name || ''}" neni kompatibilni s ${elType.name}`,
        elementId: element.id,
        productId: product?.id,
      });
    }

    const targetProductIds: string[] = [];
    const targetProductNames: string[] = [];

    if (isDesignSeries && resolved.effectiveProductId) {
      const links = designSeriesLinks.filter((l) => l.design_series_id === resolved.effectiveProductId);
      for (const link of links) {
        const targetProd = productMap.get(link.product_id);
        if (targetProd && !targetProductIds.includes(targetProd.id)) {
          targetProductIds.push(targetProd.id);
          targetProductNames.push(targetProd.name);
        }
      }
    }

    elementRows.push({
      elementTypeId: element.element_type_id,
      elementTypeName: elType.name,
      category: elType.category,
      roomId: element.room_id,
      roomName: room?.name ?? null,
      floorId: element.floor_id,
      floorName: floor?.name ?? null,
      quantity: element.quantity || 1,
      assignmentType: resolved.itemType,
      sourceLevel: resolved.sourceLevel,
      inherited: resolved.inherited,
      productId: resolved.effectiveProductId,
      productName: product?.name ?? null,
      productCode: product?.code ?? null,
      productPrice: product?.price ?? 0,
      productCost: product?.purchase_price ?? 0,
      designSeriesId: isDesignSeries ? resolved.effectiveProductId : null,
      designSeriesName: isDesignSeries ? product?.name ?? null : null,
      targetProductIds,
      targetProductNames,
      mountingGroupId: group?.id ?? null,
      mountingGroupSize: group?.frame_size ?? null,
      mountingGroupOrientation: group?.orientation ?? null,
      frameContribution: !!group,
      warnings: rowWarnings,
      fallbackUsed: false,
      elementIds: [element.id],
    });

    warnings.push(...rowWarnings);
  }

  const aggregatedRows = aggregateElementRows(elementRows);

  const { frameRows, moduleRows, frameWarnings } = buildFrameAndModuleRows({
    mountingGroups,
    designSeriesLinks,
    products,
    productMap,
    roomMap,
  });
  warnings.push(...frameWarnings);

  const stats = computeStats(elementRows, mountingGroups, frameRows, moduleRows, warnings);

  return {
    elementRows,
    aggregatedRows,
    frameRows,
    moduleRows,
    warnings,
    stats,
  };
}

function aggregateElementRows(rows: SchematicSummaryRow[]): AggregatedElementRow[] {
  const aggregateMap = new Map<string, AggregatedElementRow>();

  for (const row of rows) {
    const key = `${row.elementTypeId}_${row.productId ?? 'unassigned'}`;

    if (aggregateMap.has(key)) {
      const agg = aggregateMap.get(key)!;
      agg.quantity += row.quantity;
      agg.elementIds.push(...row.elementIds);

      const roomEntry = agg.roomBreakdown.find((rb) => rb.roomId === row.roomId);
      if (roomEntry) {
        roomEntry.count += row.quantity;
      } else {
        agg.roomBreakdown.push({
          roomId: row.roomId,
          roomName: row.roomName,
          count: row.quantity,
        });
      }

      if (row.warnings.length > 0) {
        agg.hasWarnings = true;
      }
    } else {
      aggregateMap.set(key, {
        elementTypeId: row.elementTypeId,
        elementTypeName: row.elementTypeName,
        category: row.category,
        quantity: row.quantity,
        assignmentType: row.assignmentType,
        productId: row.productId,
        productName: row.productName,
        productCode: row.productCode,
        productPrice: row.productPrice,
        productCost: row.productCost,
        designSeriesId: row.designSeriesId,
        designSeriesName: row.designSeriesName,
        roomBreakdown: [{ roomId: row.roomId, roomName: row.roomName, count: row.quantity }],
        hasWarnings: row.warnings.length > 0,
        elementIds: [...row.elementIds],
      });
    }
  }

  return [...aggregateMap.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.elementTypeName.localeCompare(b.elementTypeName);
  });
}

interface BuildFrameParams {
  mountingGroups: MountingGroupWithSlots[];
  designSeriesLinks: DesignSeriesProductLink[];
  products: Product[];
  productMap: Map<string, Product>;
  roomMap: Map<string, Room>;
}

function buildFrameAndModuleRows(params: BuildFrameParams): {
  frameRows: GeneratedFrameRow[];
  moduleRows: ModuleAggregateRow[];
  frameWarnings: SchematicWarning[];
} {
  const { mountingGroups, designSeriesLinks, productMap, roomMap } = params;
  const frameWarnings: SchematicWarning[] = [];

  const frameAgg = new Map<string, GeneratedFrameRow>();
  const moduleAgg = new Map<string, ModuleAggregateRow>();

  for (const group of mountingGroups) {
    if (!group.design_series_id) {
      const room = group.room_id ? roomMap.get(group.room_id) : null;
      const hint = group.label || room?.name || '';
      frameWarnings.push({
        type: 'missing_frame',
        severity: 'warning',
        message: `Viceramecek${hint ? ` "${hint}"` : ''} nema prirazenou designovou radu`,
      });
      continue;
    }

    const dsProduct = productMap.get(group.design_series_id);
    if (!dsProduct) continue;

    const seriesLinks = designSeriesLinks.filter((l) => l.design_series_id === group.design_series_id);
    const frameRoleKey = deriveFrameRoleKey(group.frame_size, group.orientation);

    const frameLinks = seriesLinks
      .filter((l) => l.role_key === frameRoleKey)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return b.priority - a.priority;
      });

    const targetFrameProduct = frameLinks.length > 0 ? productMap.get(frameLinks[0].product_id) : null;
    const hasMapping = !!targetFrameProduct;
    let fallbackUsed = false;

    if (!hasMapping && group.frame_size > 1) {
      fallbackUsed = true;
      frameWarnings.push({
        type: 'no_mapping',
        severity: 'info',
        message: `Rada "${dsProduct.name}" nema mapovani pro ${frameRoleKey}`,
      });
    }

    const frameKey = `${group.design_series_id}_${group.frame_size}_${group.orientation}_${group.color_name || ''}`;

    if (frameAgg.has(frameKey)) {
      frameAgg.get(frameKey)!.quantity++;
    } else {
      let unitPrice = 0;
      let unitCost = 0;

      if (targetFrameProduct) {
        unitPrice = targetFrameProduct.price ?? 0;
        unitCost = targetFrameProduct.purchase_price ?? unitPrice * 0.7;
      } else {
        const framePrices = (dsProduct.frame_prices as Record<string, number> | null) ?? {};
        unitPrice = framePrices[String(group.frame_size)] || 0;
        unitCost = unitPrice * 0.7;
      }

      const rowWarnings: SchematicWarning[] = [];
      if (unitPrice === 0 && !fallbackUsed) {
        rowWarnings.push({
          type: 'no_price',
          severity: 'info',
          message: `Ramecek ${group.frame_size}R nema nastavenou cenu`,
        });
      }

      frameAgg.set(frameKey, {
        designSeriesId: group.design_series_id,
        designSeriesName: dsProduct.name,
        designSeriesBrand: dsProduct.brand,
        frameSize: group.frame_size,
        orientation: group.orientation,
        colorName: group.color_name,
        quantity: 1,
        hasMapping,
        targetProductId: targetFrameProduct?.id ?? null,
        targetProductName: targetFrameProduct?.name ?? null,
        targetProductCode: targetFrameProduct?.code ?? null,
        unitPrice,
        unitCost,
        warnings: rowWarnings,
        fallbackUsed,
      });
    }

    for (const slot of group.slots) {
      const moduleName = slot.module_name;
      if (!moduleName) continue;

      const moduleLinks = seriesLinks
        .filter((l) => l.role_key === moduleName)
        .sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return b.priority - a.priority;
        });

      const moduleProduct = moduleLinks.length > 0 ? productMap.get(moduleLinks[0].product_id) : null;
      const moduleKey = `${group.design_series_id}_${moduleName}`;

      if (moduleAgg.has(moduleKey)) {
        moduleAgg.get(moduleKey)!.quantity++;
      } else {
        const rowWarnings: SchematicWarning[] = [];

        if (!moduleProduct) {
          rowWarnings.push({
            type: 'no_mapping',
            severity: 'warning',
            message: `Modul "${moduleName}" nema prirazeny produkt v rade "${dsProduct.name}"`,
          });
        }

        moduleAgg.set(moduleKey, {
          moduleName,
          designSeriesId: group.design_series_id,
          designSeriesName: dsProduct.name,
          productId: moduleProduct?.id ?? null,
          productName: moduleProduct?.name ?? null,
          productCode: moduleProduct?.code ?? null,
          quantity: 1,
          unitPrice: moduleProduct?.price ?? 0,
          unitCost: moduleProduct?.purchase_price ?? 0,
          warnings: rowWarnings,
        });
      }
    }
  }

  const frameRows = [...frameAgg.values()].sort((a, b) => {
    if (a.designSeriesName !== b.designSeriesName) return a.designSeriesName.localeCompare(b.designSeriesName);
    if (a.frameSize !== b.frameSize) return a.frameSize - b.frameSize;
    return a.orientation.localeCompare(b.orientation);
  });

  const moduleRows = [...moduleAgg.values()].sort((a, b) => {
    if (a.designSeriesName !== b.designSeriesName) return a.designSeriesName.localeCompare(b.designSeriesName);
    return a.moduleName.localeCompare(b.moduleName);
  });

  return { frameRows, moduleRows, frameWarnings };
}

function computeStats(
  elementRows: SchematicSummaryRow[],
  mountingGroups: MountingGroupWithSlots[],
  frameRows: GeneratedFrameRow[],
  moduleRows: ModuleAggregateRow[],
  warnings: SchematicWarning[]
): SchematicSummaryStats {
  let totalElements = 0;
  let assignedElements = 0;
  let unassignedElements = 0;
  let designSeriesElements = 0;
  let directProductElements = 0;
  const elementsInGroupsSet = new Set<string>();

  for (const row of elementRows) {
    totalElements += row.quantity;
    if (row.productId) {
      assignedElements += row.quantity;
      if (row.assignmentType === 'design_series') {
        designSeriesElements += row.quantity;
      } else {
        directProductElements += row.quantity;
      }
    } else {
      unassignedElements += row.quantity;
    }
    if (row.mountingGroupId) {
      for (const elId of row.elementIds) {
        elementsInGroupsSet.add(elId);
      }
    }
  }

  const totalFrames = frameRows.reduce((sum, f) => sum + f.quantity, 0);
  const totalModules = moduleRows.reduce((sum, m) => sum + m.quantity, 0);

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;

  return {
    totalElements,
    assignedElements,
    unassignedElements,
    designSeriesElements,
    directProductElements,
    elementsInGroups: elementsInGroupsSet.size,
    totalGroups: mountingGroups.length,
    totalFrames,
    totalModules,
    warningCount,
    errorCount,
  };
}

export function schematicSummaryToQuoteSections(
  summary: SchematicSummaryOutput,
  products: Product[]
): { sections: QuoteSection[]; warnings: QuoteWarning[] } {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const quoteWarnings: QuoteWarning[] = [];

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

  const categoryItems = new Map<string, QuoteItem[]>();

  for (const row of summary.aggregatedRows) {
    if (!row.productId) {
      quoteWarnings.push({
        type: 'unassigned_element',
        severity: 'warning',
        message: `${row.elementTypeName} (${row.quantity} ks) nema prirazeny produkt`,
      });
      continue;
    }

    const product = productMap.get(row.productId);
    if (!product) continue;

    const cat = row.category;
    if (!categoryItems.has(cat)) {
      categoryItems.set(cat, []);
    }

    categoryItems.get(cat)!.push({
      id: crypto.randomUUID(),
      code: product.code,
      name: product.name,
      unit: 'ks',
      quantity: row.quantity,
      sellingPrice: product.price ?? 0,
      costPrice: product.purchase_price ?? 0,
      productId: product.id,
    });
  }

  const sections: QuoteSection[] = [];

  for (const [category, items] of categoryItems) {
    if (items.length === 0) continue;

    const mergedItems = mergeQuoteItems(items);

    sections.push({
      id: crypto.randomUUID(),
      name: CATEGORY_LABELS[category] || category,
      items: mergedItems,
      trade: CATEGORY_TRADE[category] || 'electric',
    });
  }

  if (summary.frameRows.length > 0 || summary.moduleRows.length > 0) {
    const frameModuleItems: QuoteItem[] = [];

    for (const frame of summary.frameRows) {
      let name: string;
      let code = '';
      let price = frame.unitPrice;
      let cost = frame.unitCost;
      let productId = frame.designSeriesId;

      if (frame.targetProductId && frame.targetProductName) {
        name = frame.targetProductName;
        const targetProd = productMap.get(frame.targetProductId);
        if (targetProd) {
          code = targetProd.code;
          price = targetProd.price ?? 0;
          cost = targetProd.purchase_price ?? price * 0.7;
          productId = targetProd.id;
        }
      } else {
        const brandPrefix = frame.designSeriesBrand ? `${frame.designSeriesBrand} ` : '';
        const orientLabel = frame.frameSize > 1 ? (frame.orientation === 'horizontal' ? ' H' : ' V') : '';
        const colorSuffix = frame.colorName ? ` - ${frame.colorName}` : '';
        name = `Ramecek ${frame.frameSize}R${orientLabel}${colorSuffix} - ${brandPrefix}${frame.designSeriesName}`;
      }

      frameModuleItems.push({
        id: crypto.randomUUID(),
        code,
        name,
        unit: 'ks',
        quantity: frame.quantity,
        sellingPrice: price,
        costPrice: cost,
        productId: productId ?? undefined,
      });
    }

    for (const mod of summary.moduleRows) {
      if (!mod.productId) {
        quoteWarnings.push({
          type: 'unassigned_element',
          severity: 'warning',
          message: `Modul "${mod.moduleName}" v rade "${mod.designSeriesName}" nema prirazeny produkt`,
        });
        continue;
      }

      const product = productMap.get(mod.productId);
      if (!product) continue;

      frameModuleItems.push({
        id: crypto.randomUUID(),
        code: product.code,
        name: product.name,
        unit: 'ks',
        quantity: mod.quantity,
        sellingPrice: product.price ?? 0,
        costPrice: product.purchase_price ?? 0,
        productId: product.id,
      });
    }

    if (frameModuleItems.length > 0) {
      sections.push({
        id: crypto.randomUUID(),
        name: 'Viceramecky a moduly',
        items: mergeQuoteItems(frameModuleItems),
        trade: 'electric',
        icon: 'grid',
      });
    }
  }

  for (const w of summary.warnings) {
    quoteWarnings.push({
      type: w.type === 'no_assignment' ? 'unassigned_element' : w.type === 'missing_frame' ? 'missing_frame' : 'no_price',
      severity: w.severity,
      message: w.message,
      elementId: w.elementId,
      productId: w.productId,
    });
  }

  return { sections, warnings: quoteWarnings };
}

function mergeQuoteItems(items: QuoteItem[]): QuoteItem[] {
  const merged = new Map<string, QuoteItem>();

  for (const item of items) {
    const key = `${item.productId ?? ''}_${item.name}_${item.sellingPrice}`;
    if (merged.has(key)) {
      merged.get(key)!.quantity += item.quantity;
    } else {
      merged.set(key, { ...item });
    }
  }

  return [...merged.values()];
}

export function getUnassignedElementTypes(summary: SchematicSummaryOutput): Array<{
  elementTypeId: string;
  elementTypeName: string;
  count: number;
}> {
  const unassigned = summary.aggregatedRows.filter((r) => !r.productId);
  return unassigned.map((r) => ({
    elementTypeId: r.elementTypeId,
    elementTypeName: r.elementTypeName,
    count: r.quantity,
  }));
}

export function getWarningsByType(
  summary: SchematicSummaryOutput,
  type: SchematicWarning['type']
): SchematicWarning[] {
  return summary.warnings.filter((w) => w.type === type);
}
