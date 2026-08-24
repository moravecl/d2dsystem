import { useState, useEffect, useMemo, useRef } from 'react';
import { Package, MapPin, Layers, DollarSign, FileDown, FileSpreadsheet, GitBranch, Wind, Lightbulb, SlidersHorizontal, Eye, EyeOff, Sun, Camera, GripVertical, ArrowUp, ArrowDown, Check, Info, AlertTriangle, Grid2x2 as Grid } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { renderPinIcon } from '../catalog/floorplan/iconLibrary';
import type { Product, Category, Material, DesignModule, ProductDesignModule } from '../../types/database';
import type { SelectionState, Floor } from '../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import type { FvSummaryData, CameraSummaryData, EpsSummaryData } from '../../pages/projects/ProjectDetailPage';
import type { ProjectDesignElement, ProductAssignment, DesignSeriesProductLink, DesignElementType } from '../../types/designElements';
import type { MountingGroupWithSlots } from '../../hooks/useMountingGroups';
import type { ResolvedAssignment, ProjectAssignmentStats } from '../../lib/assignmentResolver';
import { getCategoryColor } from '../../types/designElements';
import { useCategoryColors } from '../../hooks/useCategoryColors';
import { buildSchematicSummary, type SchematicSummaryOutput } from '../../lib/schematicSummaryBuilder';
import { listAllPinsGlobal, listAllPins } from '../catalog/floorplan/pinUtils';
import { polylineLength, normalizedToMeters, analyzeBends, countTPieces, STANDARD_BEND_ANGLES, polygonAreaM2 } from '../catalog/floorplan/geometry';
import { CIRCUIT_TYPE_LABELS } from '../catalog/floorplan/materialLibrary';
import { getPrintColor } from '../catalog/summary/summaryUtils';
import SummaryFloorplanView from '../catalog/summary/SummaryFloorplanView';
import SummaryTradePrint from '../catalog/summary/SummaryTradePrint';
import SummaryHeatingPrint from '../catalog/summary/SummaryHeatingPrint';
import { exportSelectionPdf } from './selectionPdfExport';
import { calculateRequiredLumens } from '../../hooks/useLightingNorms';
import { exportSupplierQuoteXLS } from './supplierQuoteExport';
import { buildSectionsFromCatalog } from '../catalog/quoteHelpers';
import Modal from '../ui/Modal';

interface PdmEntry extends ProductDesignModule {
  module: DesignModule;
}
type PdmMap = Record<string, PdmEntry[]>;

interface DesignVersionOption {
  id: string;
  label: string;
  version_number: number;
  created_at: string;
}

interface FvVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_panel_kwp: number;
  summary_panel_count: number;
  created_at: string;
}

interface CameraVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_camera_count: number;
  summary_total_price: number;
  created_at: string;
}

interface EpsVersionOption {
  id: string;
  version_number: number;
  note: string;
  summary_detector_count: number;
  summary_total_price: number;
  created_at: string;
}

interface Props {
  selected: SelectionState;
  products: Product[];
  categories: Category[];
  floors: Floor[];
  materials: Material[];
  heatingSystems: HeatingSystemFull[];
  designModules: DesignModule[];
  loading: boolean;
  projectName?: string;
  clientName?: string;
  projectId?: string;
  selectedVersionId?: string | null;
  onVersionChange?: (versionId: string | null) => void;
  pinSize?: number;
  fvVersions?: FvVersionOption[];
  cameraVersions?: CameraVersionOption[];
  selectedFvVersionId?: string | null;
  selectedCameraVersionId?: string | null;
  onFvVersionChange?: (versionId: string | null) => void;
  onCameraVersionChange?: (versionId: string | null) => void;
  fvIncluded?: boolean;
  cameraIncluded?: boolean;
  fvSummary?: FvSummaryData | null;
  cameraSummary?: CameraSummaryData | null;
  fvSummaryLoading?: boolean;
  cameraSummaryLoading?: boolean;
  epsVersions?: EpsVersionOption[];
  selectedEpsVersionId?: string | null;
  onEpsVersionChange?: (versionId: string | null) => void;
  epsIncluded?: boolean;
  epsSummary?: EpsSummaryData | null;
  epsSummaryLoading?: boolean;
  designElements?: ProjectDesignElement[];
  productAssignments?: ProductAssignment[];
  mountingGroups?: MountingGroupWithSlots[];
  designSeriesLinks?: DesignSeriesProductLink[];
  elementTypes?: DesignElementType[];
  resolvedAssignments?: Map<string, ResolvedAssignment>;
  assignmentStats?: ProjectAssignmentStats;
  productKindMap?: Map<string, string>;
  schematicDataLoading?: boolean;
  schematicSymbolScale?: number;
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function getModPrice(name: string, productId: string, pMap: PdmMap, designModules: DesignModule[]): number {
  const pm = pMap[productId];
  if (pm && pm.length > 0) return safeNum(pm.find((p) => p.module.name === name)?.price);
  return safeNum(designModules.find((m) => m.name === name)?.price);
}

function getModIcon(name: string, productId: string, pMap: PdmMap, designModules: DesignModule[]): string | null {
  const pm = pMap[productId];
  if (pm && pm.length > 0) {
    const entry = pm.find((p) => p.module.name === name);
    return entry?.icon_url || entry?.module.icon_url || null;
  }
  return designModules.find((m) => m.name === name)?.icon_url ?? null;
}

function renderDesignCounts(productId: string, selected: SelectionState, designModules: DesignModule[], pMap: PdmMap, showPrices = true) {
  const placements = selected[productId]?.placements ?? [];
  const configCounts: Record<string, { frameSize: number; modules: string[]; colorName?: string; colorHex?: string; count: number }> = {};
  const moduleTotals: Record<string, number> = {};

  for (const pl of placements) {
    if (pl.config) {
      const key = JSON.stringify({ frameSize: pl.config.frameSize, modules: pl.config.modules, colorName: pl.config.colorName });
      if (!configCounts[key]) {
        configCounts[key] = { ...pl.config, count: 0 };
      }
      configCounts[key].count++;
      for (const m of pl.config.modules) {
        moduleTotals[m] = (moduleTotals[m] || 0) + 1;
      }
    }
  }

  const entries = Object.values(configCounts);
  if (entries.length === 0) return null;

  const moduleKeys = Object.keys(moduleTotals).sort();
  const totalModulesPrice = moduleKeys.reduce((sum, k) => sum + moduleTotals[k] * getModPrice(k, productId, pMap, designModules), 0);

  return (
    <div className="mt-3 bg-white/[0.04] rounded-xl p-3 space-y-2">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Konfigurace</div>
      {entries.map((cfg, idx) => {
        const cfgPrice = cfg.modules.reduce((sum, m) => sum + getModPrice(m, productId, pMap, designModules), 0);
        const condensed: Record<string, number> = {};
        for (const m of cfg.modules) condensed[m] = (condensed[m] || 0) + 1;
        return (
          <div key={idx} className="text-xs text-slate-400 flex items-center gap-2">
            <span className="font-extrabold text-white">{cfg.count}x</span>
            <span className="font-semibold">
              {cfg.frameSize}R: {Object.entries(condensed).map(([n, cnt]) => cnt > 1 ? `${cnt}x ${n}` : n).join(', ')}
            </span>
            {cfg.colorName && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border border-white/[0.12]" style={{ backgroundColor: cfg.colorHex || '#ccc' }} />
                <span className="text-[10px] text-slate-400">{cfg.colorName}</span>
              </span>
            )}
            {showPrices && cfgPrice > 0 && (
              <span className="font-extrabold text-blue-400 ml-auto">
                {(cfgPrice * cfg.count).toLocaleString('cs-CZ')} Kč
              </span>
            )}
          </div>
        );
      })}
      {moduleKeys.length > 0 && (
        <div className="pt-2 border-t border-white/[0.08] space-y-1">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Vložky celkem</div>
          {moduleKeys.map((k) => {
            const unitPrice = getModPrice(k, productId, pMap, designModules);
            const icon = getModIcon(k, productId, pMap, designModules);
            const lineTotal = unitPrice * moduleTotals[k];
            return (
              <div key={k} className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  {icon && (
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center shrink-0">
                      {renderPinIcon(icon, 12, 'text-white')}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-300">{k}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-extrabold text-white">{moduleTotals[k]} ks</span>
                  {showPrices && unitPrice > 0 && (
                    <span className="text-xs font-extrabold text-blue-400">{lineTotal.toLocaleString('cs-CZ')} Kč</span>
                  )}
                </div>
              </div>
            );
          })}
          {showPrices && totalModulesPrice > 0 && (
            <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-white/[0.08] mt-1">
              <span className="text-[10px] font-extrabold text-slate-400">Vložky celkem:</span>
              <span className="text-xs font-extrabold text-blue-400">{totalModulesPrice.toLocaleString('cs-CZ')} Kč</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPlacementColorName(pl: { config?: { colorName?: string }; colorName?: string }): string | null {
  return pl.config?.colorName ?? pl.colorName ?? null;
}

function getPlacementColorHex(pl: { config?: { colorHex?: string }; colorHex?: string }): string {
  return pl.config?.colorHex ?? pl.colorHex ?? '#ccc';
}

function renderColorBreakdown(productId: string, selected: SelectionState) {
  const placements = selected[productId]?.placements ?? [];
  const colorCounts: Record<string, { count: number; hex: string }> = {};
  let hasAnyColor = false;

  for (const pl of placements) {
    const name = getPlacementColorName(pl);
    if (name) {
      hasAnyColor = true;
      if (!colorCounts[name]) colorCounts[name] = { count: 0, hex: getPlacementColorHex(pl) };
      colorCounts[name].count++;
    }
  }

  if (!hasAnyColor) return null;

  const entries = Object.entries(colorCounts).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([name, { count, hex }]) => (
        <span key={name} className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 bg-white/[0.04] border border-white/[0.08] px-2 py-1 rounded-lg">
          <span className="w-3 h-3 rounded-full border border-white/[0.12] shrink-0" style={{ backgroundColor: hex }} />
          {count}x {name}
        </span>
      ))}
    </div>
  );
}

const AVAILABLE_TRADES = ['Elektro', 'Topení', 'Voda', 'Rekuperace', 'Vzduchotechnika', 'Chlazení'];

type SectionKey = 'products' | 'rooms' | 'ventilation' | 'lighting' | 'cables' | 'materials' | 'fittings' | 'breakers' | 'floorplans' | 'trades' | 'heating' | 'fv_system' | 'camera_system' | 'schematic';

const SECTION_LABELS: Record<SectionKey, string> = {
  products: 'Produkty',
  rooms: 'Místnosti',
  ventilation: 'Rekuperace',
  lighting: 'Osvětlení',
  cables: 'Trasy a kabely',
  materials: 'Materiál',
  fittings: 'Tvarovky',
  breakers: 'Jištění',
  floorplans: 'Půdorysy',
  trades: 'Obory',
  heating: 'Vytápění',
  fv_system: 'Fotovoltaika',
  camera_system: 'Kamerový systém',
  schematic: 'Schematický návrh',
};

const DEFAULT_SECTIONS: SectionKey[] = ['schematic', 'products', 'rooms', 'ventilation', 'lighting', 'cables', 'materials', 'fittings', 'breakers', 'floorplans', 'trades', 'heating', 'fv_system', 'camera_system'];

export default function ProjectSelectionTab({ selected, products, categories, floors, materials, heatingSystems, designModules, loading, projectName, clientName, projectId, selectedVersionId, onVersionChange, pinSize, fvVersions = [], cameraVersions = [], selectedFvVersionId, selectedCameraVersionId, onFvVersionChange, onCameraVersionChange, fvIncluded = true, cameraIncluded = true, fvSummary, cameraSummary, fvSummaryLoading, cameraSummaryLoading, epsVersions = [], selectedEpsVersionId, onEpsVersionChange, epsIncluded = true, epsSummary, designElements = [], productAssignments = [], mountingGroups = [], designSeriesLinks = [], elementTypes = [], resolvedAssignments, assignmentStats, productKindMap, schematicDataLoading = false, schematicSymbolScale = 24 }: Props) {
  const [wastePercents, setWastePercents] = useState<Record<string, number>>({});
  const { colorMap: categoryColorMap } = useCategoryColors();
  const [pdmMap, setPdmMap] = useState<PdmMap>({});
  const [versions, setVersions] = useState<DesignVersionOption[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || versionsLoaded) return;
    supabase
      .from('design_versions')
      .select('id, label, version_number, created_at')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as DesignVersionOption[]);
        setVersionsLoaded(true);
      });
  }, [projectId, versionsLoaded]);

  useEffect(() => {
    const dsIds = Object.keys(selected)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p && p.kind === 'design_series')
      .map((p) => p.id);
    if (dsIds.length === 0) { setPdmMap({}); return; }
    supabase.from('product_design_modules').select('*').in('product_id', dsIds).order('sort_order').then(({ data }) => {
      const map: PdmMap = {};
      for (const pdm of data ?? []) {
        const mod = designModules.find((m) => m.id === pdm.design_module_id);
        if (!mod) continue;
        if (!map[pdm.product_id]) map[pdm.product_id] = [];
        map[pdm.product_id].push({ ...pdm, module: mod });
      }
      setPdmMap(map);
    });
  }, [selected, designModules, products]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [hiddenSections, setHiddenSections] = useState<Set<SectionKey>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>([...DEFAULT_SECTIONS]);
  const [showReorder, setShowReorder] = useState(false);
  const [showPrices, setShowPrices] = useState(true);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const toggleSection = (key: SectionKey) => {
    setHiddenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const isVisible = (key: SectionKey) => !hiddenSections.has(key);

  const moveSection = (fromIdx: number, toIdx: number) => {
    setSectionOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      moveSection(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const objectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const floor of floors) {
      for (const obj of floor.objects ?? []) {
        counts[obj.productId] = (counts[obj.productId] ?? 0) + 1;
      }
    }
    return counts;
  }, [floors]);

  const qtyOf = (productId: string) => {
    return (selected[productId]?.placements?.length ?? 0) + (objectCounts[productId] ?? 0);
  };

  const selectedProducts = useMemo(() => {
    const ids = new Set([...Object.keys(selected), ...Object.keys(objectCounts)]);
    return Array.from(ids)
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as Product[];
  }, [selected, objectCounts, products]);

  const allPins = useMemo(() => listAllPinsGlobal(selected, products), [selected, products]);

  const totalPlacedCount = useMemo(() => {
    return allPins.length + Object.values(objectCounts).reduce((s, c) => s + c, 0);
  }, [allPins, objectCounts]);

  const groupedByCat = useMemo(() => {
    return categories
      .map((cat) => ({
        cat,
        items: selectedProducts.filter((p) => p.category_id === cat.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [categories, selectedProducts]);

  const totalProductPrice = useMemo(() => {
    return selectedProducts.reduce(
      (sum, p) => sum + safeNum(p.price) * qtyOf(p.id),
      0
    );
  }, [selectedProducts, selected, objectCounts]);

  const allRooms = useMemo(() => {
    const rooms: { id: string; name: string }[] = [];
    for (const floor of floors) {
      for (const room of floor.rooms ?? []) rooms.push({ id: room.id, name: room.name });
    }
    return rooms;
  }, [floors]);

  const roomProductMap = useMemo(() => {
    const map: Record<string, { product: Product; count: number; colorCounts?: Record<string, { count: number; hex: string }> }[]> = {};
    const addToMap = (roomName: string, product: Product, colorName?: string | null, colorHex?: string) => {
      if (!map[roomName]) map[roomName] = [];
      const existing = map[roomName].find((rp) => rp.product.id === product.id);
      if (existing) {
        existing.count += 1;
        if (colorName) {
          if (!existing.colorCounts) existing.colorCounts = {};
          if (!existing.colorCounts[colorName]) existing.colorCounts[colorName] = { count: 0, hex: colorHex || '#ccc' };
          existing.colorCounts[colorName].count++;
        }
      } else {
        const entry: typeof map[string][number] = { product, count: 1 };
        if (colorName) {
          entry.colorCounts = { [colorName]: { count: 1, hex: colorHex || '#ccc' } };
        }
        map[roomName].push(entry);
      }
    };
    for (const pid of Object.keys(selected)) {
      const product = products.find((p) => p.id === pid);
      if (!product) continue;
      for (const pl of selected[pid].placements) {
        const roomName = pl.room
          ? allRooms.find((r) => r.id === pl.room)?.name ?? 'Nezařazeno'
          : 'Nezařazeno';
        const cn = getPlacementColorName(pl);
        const ch = getPlacementColorHex(pl);
        addToMap(roomName, product, cn, ch);
      }
    }
    for (const floor of floors) {
      for (const obj of floor.objects ?? []) {
        const product = products.find((p) => p.id === obj.productId);
        if (!product) continue;
        const roomName = obj.roomId
          ? allRooms.find((r) => r.id === obj.roomId)?.name ?? 'Nezařazeno'
          : 'Nezařazeno';
        addToMap(roomName, product);
      }
    }
    return map;
  }, [selected, products, allRooms, floors]);

  const schematicByRoom = useMemo(() => {
    if (designElements.length === 0) return {};
    const map: Record<string, { element: ProjectDesignElement; type: DesignElementType | undefined; product: Product | null; inherited: boolean }[]> = {};
    const getRoomNameById = (roomId: string | null) => {
      if (!roomId) return 'Nezařazeno';
      return allRooms.find(r => r.id === roomId)?.name ?? 'Nezařazeno';
    };
    for (const el of designElements) {
      const roomName = getRoomNameById(el.room_id);
      if (!map[roomName]) map[roomName] = [];
      const type = elementTypes.find(t => t.id === el.element_type_id);
      const resolved = resolvedAssignments?.get(el.id);
      const product = resolved?.effectiveProductId ? products.find(p => p.id === resolved.effectiveProductId) ?? null : null;
      map[roomName].push({ element: el, type, product, inherited: resolved?.inherited ?? false });
    }
    return map;
  }, [designElements, elementTypes, allRooms, resolvedAssignments, products]);


  const schematicSummary = useMemo<SchematicSummaryOutput | null>(() => {
    if (designElements.length === 0 && mountingGroups.length === 0) return null;
    return buildSchematicSummary({
      designElements,
      elementTypes,
      assignments: productAssignments,
      mountingGroups,
      designSeriesLinks,
      products,
      productKindMap: productKindMap ?? new Map(),
      rooms: allRooms.map(r => ({ id: r.id, name: r.name, points: [] })),
      floors,
    });
  }, [designElements, elementTypes, productAssignments, mountingGroups, designSeriesLinks, products, productKindMap, allRooms, floors]);

  const cablesByFloor = useMemo(() => {
    const result: { floor: Floor; circuits: { circuit: any; cables: { cable: any; lengthM: number }[] }[] }[] = [];
    for (const floor of floors) {
      const circuits: { circuit: any; cables: { cable: any; lengthM: number }[] }[] = [];
      for (const circuit of floor.circuits ?? []) {
        const cablesForCircuit = (floor.cables ?? []).filter((c) => c.circuitId === circuit.id);
        const cables = cablesForCircuit.map((cable) => {
          const normalized = polylineLength(cable.points);
          const lengthM = floor.scale ? normalizedToMeters(normalized, floor.scale) : 0;
          return { cable, lengthM };
        });
        if (cables.length > 0) {
          circuits.push({ circuit, cables });
        }
      }
      if (circuits.length > 0) {
        result.push({ floor, circuits });
      }
    }
    return result;
  }, [floors]);

  const materialTotals = useMemo(() => {
    const totals: Record<string, { name: string; rawLength: number; unit: string; pricePerUnit: number }> = {};
    for (const floor of floors) {
      for (const cable of floor.cables ?? []) {
        if (!cable.materialName) continue;
        const normalized = polylineLength(cable.points);
        const lengthM = floor.scale ? normalizedToMeters(normalized, floor.scale) : 0;
        if (!totals[cable.materialName]) {
          const mat = materials.find((m) => m.name === cable.materialName);
          totals[cable.materialName] = {
            name: cable.materialName,
            rawLength: 0,
            unit: mat?.unit ?? 'm',
            pricePerUnit: mat?.price_per_unit ?? 0,
          };
        }
        totals[cable.materialName].rawLength += lengthM;
      }
    }
    return Object.values(totals);
  }, [floors, materials]);

  const materialWithWaste = useMemo(() => {
    return materialTotals.map((mat) => {
      const waste = wastePercents[mat.name] ?? 0;
      const adjustedLength = mat.rawLength * (1 + waste / 100);
      const totalPrice = adjustedLength * mat.pricePerUnit;
      return { ...mat, waste, adjustedLength, totalPrice };
    });
  }, [materialTotals, wastePercents]);

  const totalMaterialPrice = useMemo(() => {
    return materialWithWaste.reduce((sum, mat) => sum + mat.totalPrice, 0);
  }, [materialWithWaste]);

  const fittingsTotals = useMemo(() => {
    const bendCounts: Record<string, Record<number, number>> = {};
    const tPieceCounts: Record<string, number> = {};

    for (const floor of floors) {
      const fCircuits = floor.circuits ?? [];
      for (const cable of floor.cables ?? []) {
        if (!cable.materialName) continue;
        const circuit = fCircuits.find(c => c.id === cable.circuitId);
        const cType = circuit?.type ?? 'electric';
        if (cType !== 'water' && cType !== 'heating') continue;
        const bends = analyzeBends(cable.points);
        if (!bendCounts[cable.materialName]) {
          bendCounts[cable.materialName] = {};
          for (const angle of STANDARD_BEND_ANGLES) {
            bendCounts[cable.materialName][angle] = 0;
          }
        }
        for (const bend of bends) {
          bendCounts[cable.materialName][bend.angle]++;
        }
      }

      const cablesByMaterial: Record<string, any[]> = {};
      for (const cable of floor.cables ?? []) {
        if (!cable.materialName) continue;
        const circuit = fCircuits.find(c => c.id === cable.circuitId);
        const cType = circuit?.type ?? 'electric';
        if (cType !== 'water' && cType !== 'heating') continue;
        if (!cablesByMaterial[cable.materialName]) cablesByMaterial[cable.materialName] = [];
        cablesByMaterial[cable.materialName].push(cable);
      }

      for (const [matName, cables] of Object.entries(cablesByMaterial)) {
        const tCount = countTPieces(cables);
        tPieceCounts[matName] = (tPieceCounts[matName] ?? 0) + tCount;
      }
    }

    return { bendCounts, tPieceCounts };
  }, [floors]);

  const breakerTotals = useMemo(() => {
    const totals: Record<string, { amperage: number; poles: number; curve: string; count: number }> = {};
    for (const floor of floors) {
      for (const circuit of floor.circuits ?? []) {
        if (!circuit.breaker) continue;
        const key = `${circuit.breaker.amperage}-${circuit.breaker.poles}-${circuit.breaker.curve}`;
        if (!totals[key]) {
          totals[key] = { ...circuit.breaker, count: 0 };
        }
        totals[key].count++;
      }
    }
    return Object.values(totals);
  }, [floors]);

  const fvTotal = fvIncluded && fvSummary ? fvSummary.totalInvestment : 0;
  const cameraTotal = cameraIncluded && cameraSummary ? cameraSummary.totalPrice : 0;
  const epsTotal = epsIncluded && epsSummary ? epsSummary.totalPrice : 0;
  const elektroTotal = totalProductPrice + totalMaterialPrice;
  const grandTotal = elektroTotal + fvTotal + cameraTotal + epsTotal;

  const floorplanLabel = useMemo(() => {
    const usedTrades = new Set<string>();
    for (const floor of floors) {
      for (const circuit of floor.circuits ?? []) {
        const t = circuit.type ?? 'electric';
        usedTrades.add(CIRCUIT_TYPE_LABELS[t]?.label ?? t);
      }
    }
    if (usedTrades.size === 0 && (Object.keys(selected).length > 0 || totalProductPrice > 0)) return 'Půdorysný návrhář (produkty + materiál)';
    if (usedTrades.size === 1) return `${[...usedTrades][0]} (produkty + materiál)`;
    if (usedTrades.size > 1) return `Půdorysný návrhář (produkty + materiál)`;
    return 'Půdorysný návrhář (produkty + materiál)';
  }, [floors, selected, totalProductPrice]);

  const floorsWithImages = useMemo(() => floors.filter(f => f.floorplanImg), [floors]);

  const roomIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const floor of floors) {
      for (const room of floor.rooms ?? []) map.set(room.id, room.name);
    }
    return (id: string) => map.get(id) ?? id;
  }, [floors]);

  const getWastePercent = (name: string) => wastePercents[name] ?? 0;
  const getMaterialPrice = (name: string) => materials.find(m => m.name === name)?.price_per_unit ?? 0;

  const hasCableData = useMemo(() => floors.some(f => (f.cables ?? []).length > 0), [floors]);

  const ventilationData = useMemo(() => {
    const DUCT_CAPS: Record<number, number> = { 75: 25, 90: 38 };
    const rows: { floorName: string; roomName: string; areaM2: number; volume: number; airFlow: number; mode: string; supplyVents: number; exhaustVents: number }[] = [];
    let totalSupply = 0;
    let totalExhaust = 0;
    let totalSupplyVents = 0;
    let totalExhaustVents = 0;

    for (const floor of floors) {
      if (!floor.scale) continue;
      for (const room of floor.rooms ?? []) {
        const mode = room.ventilationMode;
        if (!mode) continue;
        const areaM2 = polygonAreaM2(room.points, floor.scale);
        const height = room.ceilingHeight ?? 2.6;
        const ach = room.airChangesPerHour ?? 0.5;
        const volume = areaM2 * height;
        const airFlow = volume * ach;
        const ductCap = DUCT_CAPS[room.ductDiameter ?? 75] ?? 25;
        const autoVents = Math.ceil(airFlow / ductCap);
        const supplyVents = room.manualSupplyVents ?? (mode === 'supply' || mode === 'both' ? autoVents : 0);
        const exhaustVents = room.manualExhaustVents ?? (mode === 'exhaust' || mode === 'both' ? autoVents : 0);
        if (mode === 'supply' || mode === 'both') totalSupply += airFlow;
        if (mode === 'exhaust' || mode === 'both') totalExhaust += airFlow;
        totalSupplyVents += supplyVents;
        totalExhaustVents += exhaustVents;
        const modeLabel = mode === 'supply' ? 'Přívod' : mode === 'exhaust' ? 'Odvod' : 'Přívod + Odvod';
        rows.push({ floorName: floor.name, roomName: room.name, areaM2, volume, airFlow, mode: modeLabel, supplyVents, exhaustVents });
      }
    }
    return { rows, totalSupply, totalExhaust, totalSupplyVents, totalExhaustVents };
  }, [floors]);

  const lightingData = useMemo(() => {
    const rows: { floorName: string; roomName: string; areaM2: number; requiredLux: number; requiredLumens: number; currentLumens: number; pct: number; isOk: boolean }[] = [];
    for (const floor of floors) {
      if (!floor.scale) continue;
      for (const room of floor.rooms ?? []) {
        if (!room.requiredLux || room.requiredLux <= 0) continue;
        const areaM2 = polygonAreaM2(room.points, floor.scale);
        const requiredLumens = calculateRequiredLumens(room.requiredLux, areaM2);
        let currentLumens = 0;
        const floorPins = listAllPins(selected, products, floor.id);
        for (const pin of floorPins) {
          if (pin.placement.room === room.id && pin.product.lumens > 0) {
            currentLumens += pin.product.lumens;
          }
        }
        const pct = requiredLumens > 0 ? Math.round((currentLumens / requiredLumens) * 100) : 0;
        rows.push({ floorName: floor.name, roomName: room.name, areaM2, requiredLux: room.requiredLux, requiredLumens, currentLumens, pct, isOk: currentLumens >= requiredLumens });
      }
    }
    return rows;
  }, [floors, selected, products]);

  const handleExportPdf = () => {
    exportSelectionPdf({
      selected, products, categories, floors, materials, heatingSystems,
      wastePercents, designModules, productModulesMap: pdmMap, projectName, clientName,
      hiddenSections: hiddenSections.size > 0 ? hiddenSections : undefined,
      pinSize,
      sectionOrder,
      fvSummary: fvSummary ?? undefined,
      cameraSummary: cameraSummary ?? undefined,
      fvIncluded,
      cameraIncluded,
      showPrices,
      floorplanLabel,
      epsSummary: epsSummary ?? undefined,
      epsIncluded,
      designElements,
      elementTypes,
      mountingGroups,
      resolvedAssignments,
      productAssignments,
      productKindMap,
      designSeriesLinks,
      schematicSymbolScale,
      categoryColorMap,
    });
  };

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    );
  };

  const handleSupplierExport = async () => {
    if (selectedTrades.length === 0) return;
    // exportSupplierQuoteXLS pracuje nad sekcemi nabidky - je potreba je
    // nejdriv postavit z aktualniho vyberu (drive se predaval spatny tvar
    // dat a export padal)
    const sections = await buildSectionsFromCatalog(selected, products, categories, materials, floors, heatingSystems);
    exportSupplierQuoteXLS({
      sections,
      trades: selectedTrades,
      projectName: projectName || 'projekt',
      clientName: clientName || '',
      quoteNumber: '',
    });
    setShowSupplierModal(false);
    setSelectedTrades([]);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/[0.06] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasFvData = fvIncluded && !!fvSummary && fvSummary.panelCount > 0;
  const hasCameraData = cameraIncluded && !!cameraSummary && cameraSummary.cameraCount > 0;
  const hasSchematicData = designElements.length > 0 || mountingGroups.length > 0;

  if (selectedProducts.length === 0 && cablesByFloor.length === 0 && !hasFvData && !hasCameraData && !hasSchematicData) {
    return (
      <div className="text-center py-16">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Zatím žádná data v souhrnu</p>
        <p className="text-xs text-slate-400 mt-1">Otevřete návrhový nástroj a vytvořte konfigurace</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.08] no-print space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Verze konfigurátorů</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {onVersionChange && (
            <div>
              <label className="block text-[10px] font-bold text-blue-400 mb-1">Půdorysný návrhář</label>
              <select
                value={selectedVersionId ?? ''}
                onChange={(e) => onVersionChange(e.target.value || null)}
                className="w-full px-3 py-1.5 text-sm font-medium border border-white/[0.08] rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
              >
                <option value="">Aktuální verze</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} (V{v.version_number})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-orange-400 mb-1">Fotovoltaika</label>
            <select
              value={!fvIncluded ? '__exclude' : (selectedFvVersionId ?? '')}
              onChange={(e) => onFvVersionChange?.(e.target.value === '__exclude' ? '__exclude' : (e.target.value || null))}
              className={`w-full px-3 py-1.5 text-sm font-medium border rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 cursor-pointer ${
 !fvIncluded ? 'border-red-500/30 text-red-400' : 'border-white/[0.08]'
 }`}
            >
              <option value="">Aktuální verze</option>
              {fvVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.note} (V{v.version_number})
                </option>
              ))}
              <option value="__exclude">Nezahrnovat</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-sky-400 mb-1">Kamery</label>
            <select
              value={!cameraIncluded ? '__exclude' : (selectedCameraVersionId ?? '')}
              onChange={(e) => onCameraVersionChange?.(e.target.value === '__exclude' ? '__exclude' : (e.target.value || null))}
              className={`w-full px-3 py-1.5 text-sm font-medium border rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 cursor-pointer ${
 !cameraIncluded ? 'border-red-500/30 text-red-400' : 'border-white/[0.08]'
 }`}
            >
              <option value="">Aktuální verze</option>
              {cameraVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.note} (V{v.version_number})
                </option>
              ))}
              <option value="__exclude">Nezahrnovat</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-red-400 mb-1">EPS / EZS</label>
            <select
              value={!epsIncluded ? '__exclude' : (selectedEpsVersionId ?? '')}
              onChange={(e) => onEpsVersionChange?.(e.target.value === '__exclude' ? '__exclude' : (e.target.value || null))}
              className={`w-full px-3 py-1.5 text-sm font-medium border rounded-lg bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 cursor-pointer ${
 !epsIncluded ? 'border-red-500/30 text-red-400' : 'border-white/[0.08]'
 }`}
            >
              <option value="">Aktuální verze</option>
              {epsVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.note} (V{v.version_number})
                </option>
              ))}
              <option value="__exclude">Nezahrnovat</option>
            </select>
          </div>
        </div>
        {(selectedVersionId || selectedFvVersionId || selectedCameraVersionId || selectedEpsVersionId) && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedVersionId && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold">Návrhář: uložená verze</span>
            )}
            {selectedFvVersionId && fvIncluded && (
              <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded font-semibold">FV: uložená verze</span>
            )}
            {selectedCameraVersionId && cameraIncluded && (
              <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded font-semibold">Kamery: uložená verze</span>
            )}
            {selectedEpsVersionId && epsIncluded && (
              <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-semibold">EPS: uložená verze</span>
            )}
          </div>
        )}
      </div>

      <div className="no-print space-y-3">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
            <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-400">Produktů</span>
              </div>
              <div className="text-lg font-extrabold text-white">{selectedProducts.length}</div>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">Umístěno</span>
              </div>
              <div className="text-lg font-extrabold text-white">{totalPlacedCount}</div>
            </div>
            {hasFvData && (
              <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sun className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-orange-400">FV systém</span>
                </div>
                <div className="text-lg font-extrabold text-white">{fvSummary!.totalKwp} kWp</div>
              </div>
            )}
            {hasCameraData && (
              <div className="bg-sky-500/10 rounded-xl p-3 border border-sky-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Camera className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-400">Kamery</span>
                </div>
                <div className="text-lg font-extrabold text-white">{cameraSummary!.cameraCount} ks</div>
              </div>
            )}
            {hasSchematicData && assignmentStats && (
              <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-400">Schematické prvky</span>
                </div>
                <div className="text-lg font-extrabold text-white">{assignmentStats.totalElements}</div>
                {assignmentStats.unassignedCount > 0 && (
                  <div className="text-[10px] text-red-400">{assignmentStats.unassignedCount} nepřiřazeno</div>
                )}
              </div>
            )}
            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400">Místností</span>
              </div>
              <div className="text-lg font-extrabold text-white">{allRooms.length}</div>
            </div>
            {showPrices && (
              <div className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.08]">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Celkem</span>
                </div>
                <div className="text-lg font-extrabold text-white">
                  {grandTotal > 0 ? `${grandTotal.toLocaleString('cs-CZ')} Kč` : '-'}
                </div>
              </div>
            )}
          </div>
        </div>
        {showPrices && grandTotal > 0 && (elektroTotal > 0 || fvTotal > 0 || cameraTotal > 0 || epsTotal > 0) && (
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
            {elektroTotal > 0 && <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Návrhář: {elektroTotal.toLocaleString('cs-CZ')} Kč</span>}
            {fvTotal > 0 && <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">FV: {fvTotal.toLocaleString('cs-CZ')} Kč</span>}
            {cameraTotal > 0 && <span className="bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20">Kamery: {cameraTotal.toLocaleString('cs-CZ')} Kč</span>}
            {epsTotal > 0 && <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">EPS: {epsTotal.toLocaleString('cs-CZ')} Kč</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-semibold"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={() => setShowSupplierModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Poptávka dodavatele
          </button>
        </div>
      </div>

      <div className="no-print flex items-center gap-2">
        <button
          onClick={() => { setShowFilters(!showFilters); setShowReorder(false); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
 showFilters ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
 }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtry sekcí
          {hiddenSections.size > 0 && (
            <span className="bg-red-500/10 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {hiddenSections.size}
            </span>
          )}
        </button>
        <button
          onClick={() => { setShowReorder(!showReorder); setShowFilters(false); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
 showReorder ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
 }`}
        >
          <GripVertical className="w-3.5 h-3.5" />
          Seřazení
        </button>
        <button
          onClick={() => setShowPrices(!showPrices)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
 showPrices ? 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
 }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          {showPrices ? 'Skrýt ceny' : 'Zobrazit ceny'}
        </button>
      </div>
      {showFilters && (
        <div className="no-print bg-white/[0.06] border border-white/[0.08] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Zobrazit / Exportovat</span>
            <div className="flex gap-1">
              <button
                onClick={() => setHiddenSections(new Set())}
                className="text-[10px] font-extrabold text-blue-400 hover:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/10 transition"
              >
                Vše zapnout
              </button>
              <button
                onClick={() => setHiddenSections(new Set(DEFAULT_SECTIONS))}
                className="text-[10px] font-extrabold text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-white/[0.04] transition"
              >
                Vše vypnout
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {sectionOrder.map((key) => {
              const disabled = (key === 'fv_system' && !fvIncluded) || (key === 'camera_system' && !cameraIncluded);
              return (
                <button
                  key={key}
                  onClick={() => !disabled && toggleSection(key)}
                  disabled={disabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
 disabled
 ? 'bg-white/[0.04] text-slate-300 border border-white/[0.06] cursor-not-allowed'
 : isVisible(key)
 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
 : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
 }`}
                >
                  {isVisible(key) && !disabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {SECTION_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showReorder && (
        <div className="no-print bg-white/[0.06] border border-white/[0.08] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pořadí sekcí</span>
          </div>
          <div className="space-y-1">
            {sectionOrder.map((key, idx) => (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition"
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-300 flex-1">{SECTION_LABELS[key]}</span>
                <button
                  onClick={() => isVisible(key) ? toggleSection(key) : toggleSection(key)}
                  className="p-1"
                >
                  {isVisible(key) ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-slate-300" />}
                </button>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => idx > 0 && moveSection(idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-white/[0.08] disabled:opacity-30 transition"
                  >
                    <ArrowUp className="w-3 h-3 text-slate-500" />
                  </button>
                  <button
                    onClick={() => idx < sectionOrder.length - 1 && moveSection(idx, idx + 1)}
                    disabled={idx === sectionOrder.length - 1}
                    className="p-0.5 rounded hover:bg-white/[0.08] disabled:opacity-30 transition"
                  >
                    <ArrowDown className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
      {sectionOrder.map((sectionKey) => {
        if (!isVisible(sectionKey)) return null;

        switch (sectionKey) {
          case 'products':
            return groupedByCat.length > 0 ? groupedByCat.map(({ cat, items }) => (
              <div key={cat.id} className="rounded-xl border border-white/[0.08] overflow-hidden">
                <div className={`${cat.soft_color || 'bg-white/[0.04]'} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${cat.pill_color || 'bg-slate-400'} text-white flex items-center justify-center `}>
                      <span className="text-xs font-extrabold">{items.length}</span>
                    </div>
                    <span className={`text-sm font-extrabold ${cat.text_color || 'text-white'}`}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{items.reduce((s, p) => s + qtyOf(p.id), 0)} ks</span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {items.map((p) => {
                    const qty = qtyOf(p.id);
                    const isDesignSeries = p.kind === 'design_series';
                    return (
                      <div key={p.id} className="px-4 py-3 bg-white/[0.06]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/[0.06] shrink-0">
                            {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-extrabold text-slate-400">{p.code}</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-extrabold text-white truncate">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.brand} {p.code}</div>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            <span className="text-sm font-extrabold text-white">{qty} ks</span>
                            {showPrices && safeNum(p.price) > 0 && <span className="text-sm font-extrabold text-blue-400">{(safeNum(p.price) * qty).toLocaleString('cs-CZ')} Kč</span>}
                          </div>
                        </div>
                        {isDesignSeries && renderDesignCounts(p.id, selected, designModules, pdmMap, showPrices)}
                        {!isDesignSeries && renderColorBreakdown(p.id, selected)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )) : null;

          case 'rooms': {
            const hasRoomProducts = Object.keys(roomProductMap).length > 0;
            const hasRoomSchematic = Object.keys(schematicByRoom).length > 0;
            return (hasRoomProducts || hasRoomSchematic) ? (
              <div key="rooms">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-teal-500/10 inline-block" />
                  Rozložení podle místností
                </h3>
                <div className="space-y-2">
                  {[...allRooms.map((r) => r.name), 'Nezařazeno'].filter((name, idx, arr) => arr.indexOf(name) === idx).map((roomName) => {
                    const rItems = roomProductMap[roomName] ?? [];
                    const schematicItems = schematicByRoom[roomName] ?? [];
                    if (rItems.length === 0 && schematicItems.length === 0) return null;
                    const totalItems = rItems.reduce((s, i) => s + i.count, 0) + schematicItems.length;
                    const schematicGrouped: Record<string, { type: DesignElementType | undefined; items: typeof schematicItems }> = {};
                    for (const si of schematicItems) {
                      const typeId = si.type?.id ?? 'unknown';
                      if (!schematicGrouped[typeId]) schematicGrouped[typeId] = { type: si.type, items: [] };
                      schematicGrouped[typeId].items.push(si);
                    }
                    return (
                      <div key={roomName} className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className={`px-4 py-2.5 flex items-center justify-between ${roomName === 'Nezařazeno' ? 'bg-white/[0.04]' : 'bg-teal-500/10'}`}>
                          <span className={`text-sm font-extrabold ${roomName === 'Nezařazeno' ? 'text-slate-500' : 'text-teal-800'}`}>{roomName}</span>
                          <span className="text-xs font-extrabold text-slate-500">{totalItems} ks</span>
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {rItems.map((rp) => (
                            <div key={rp.product.id} className="px-4 py-2 bg-white/[0.06]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-300">{rp.product.name}</span>
                                  <span className="text-[10px] text-slate-400">{rp.product.code}</span>
                                </div>
                                <span className="text-xs font-extrabold text-white">{rp.count} ks</span>
                              </div>
                              {rp.colorCounts && Object.keys(rp.colorCounts).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {Object.entries(rp.colorCounts).sort(([a], [b]) => a.localeCompare(b)).map(([cn, { count, hex }]) => (
                                    <span key={cn} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-500">
                                      <span className="w-2.5 h-2.5 rounded-full border border-white/[0.12]" style={{ backgroundColor: hex }} />
                                      {count}x {cn}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {Object.values(schematicGrouped).map((group) => {
                            const typeName = group.type?.name ?? 'Neznámý typ';
                            const typeIcon = group.type?.icon ?? undefined;
                            const catColor = getCategoryColor(group.type?.category ?? 'other');
                            const productCounts: Record<string, { product: Product; count: number; inherited: number }> = {};
                            for (const item of group.items) {
                              if (item.product) {
                                if (!productCounts[item.product.id]) {
                                  productCounts[item.product.id] = { product: item.product, count: 0, inherited: 0 };
                                }
                                productCounts[item.product.id].count++;
                                if (item.inherited) productCounts[item.product.id].inherited++;
                              }
                            }
                            const unassignedCount = group.items.filter(i => !i.product).length;
                            return (
                              <div key={group.type?.id ?? 'unknown'} className="px-4 py-2 bg-white/[0.06]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {typeIcon ? (
                                      <span className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: catColor }}>
                                        {renderPinIcon(typeIcon, 12, 'text-white')}
                                      </span>
                                    ) : (
                                      <span className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-extrabold text-white" style={{ backgroundColor: catColor }}>
                                        {typeName.charAt(0)}
                                      </span>
                                    )}
                                    <span className="text-xs font-semibold text-slate-300">{typeName}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-extrabold">schéma</span>
                                  </div>
                                  <span className="text-xs font-extrabold text-white">{group.items.length} ks</span>
                                </div>
                                {(Object.keys(productCounts).length > 0 || unassignedCount > 0) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {Object.values(productCounts).map((pc) => (
                                      <span key={pc.product.id} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                        {pc.count}x {pc.product.name}
                                        {pc.inherited > 0 && <span className="text-slate-500">({pc.inherited} zděd.)</span>}
                                      </span>
                                    ))}
                                    {unassignedCount > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                        {unassignedCount}x nepřiřazeno
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;

          }
          case 'ventilation':
            return ventilationData.rows.length > 0 ? (
              <div key="ventilation">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Wind className="w-3.5 h-3.5 text-emerald-500" />Rekuperace
                </h3>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200 bg-gradient-to-r from-blue-50 to-amber-50 border-b border-white/[0.08]">
                    <div className="px-4 py-3">
                      <div className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider">Přívod</div>
                      <div className="text-lg font-extrabold text-blue-400">{Math.round(ventilationData.totalSupply)} <span className="text-xs font-bold">m3/h</span></div>
                      <div className="text-xs font-extrabold text-blue-400">{ventilationData.totalSupplyVents} výústek</div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Odvod</div>
                      <div className="text-lg font-extrabold text-amber-400">{Math.round(ventilationData.totalExhaust)} <span className="text-xs font-bold">m3/h</span></div>
                      <div className="text-xs font-extrabold text-amber-400">{ventilationData.totalExhaustVents} výústek</div>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Místnost</th><th className="px-4 py-2 text-right">Plocha</th><th className="px-4 py-2 text-right">m3/h</th><th className="px-4 py-2 text-center">Typ</th><th className="px-4 py-2 text-right">Přívod</th><th className="px-4 py-2 text-right">Odvod</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {ventilationData.rows.map((row, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="px-4 py-2"><span className="font-semibold text-white">{row.roomName}</span><span className="text-slate-400 ml-1.5">{row.floorName}</span></td>
                          <td className="px-4 py-2 text-right text-slate-400">{row.areaM2.toFixed(1)} m2</td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-400">{Math.round(row.airFlow)}</td>
                          <td className="px-4 py-2 text-center"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.mode === 'Přívod' ? 'bg-blue-500/10 text-blue-400' : row.mode === 'Odvod' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{row.mode}</span></td>
                          <td className="px-4 py-2 text-right font-extrabold text-blue-400">{row.supplyVents > 0 ? row.supplyVents : '-'}</td>
                          <td className="px-4 py-2 text-right font-extrabold text-amber-400">{row.exhaustVents > 0 ? row.exhaustVents : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;

          case 'lighting':
            return lightingData.length > 0 ? (
              <div key="lighting">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />Osvětlení
                </h3>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Místnost</th><th className="px-4 py-2 text-right">Plocha</th><th className="px-4 py-2 text-right">Lux</th><th className="px-4 py-2 text-right">Potřeba (lm)</th><th className="px-4 py-2 text-right">Aktuálně (lm)</th><th className="px-4 py-2 text-right">Stav</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {lightingData.map((row, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="px-4 py-2"><span className="font-semibold text-white">{row.roomName}</span><span className="text-slate-400 ml-1.5">{row.floorName}</span></td>
                          <td className="px-4 py-2 text-right text-slate-400">{row.areaM2.toFixed(1)} m2</td>
                          <td className="px-4 py-2 text-right text-slate-400">{row.requiredLux}</td>
                          <td className="px-4 py-2 text-right font-semibold text-amber-400">{row.requiredLumens.toLocaleString('cs-CZ')}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-300">{row.currentLumens.toLocaleString('cs-CZ')}</td>
                          <td className="px-4 py-2 text-right"><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${row.isOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{row.isOk ? 'OK' : `${row.pct}%`}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;

          case 'cables':
            return cablesByFloor.length > 0 ? (
              <div key="cables">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Trasy a kabely</h3>
                <div className="space-y-4">
                  {cablesByFloor.map(({ floor, circuits }) => (
                    <div key={floor.id} className="rounded-xl border border-white/[0.08] overflow-hidden">
                      <div className="px-4 py-2.5 bg-white/[0.04] font-extrabold text-sm text-white">{floor.name}</div>
                      <div className="divide-y divide-white/[0.06]">
                        {circuits.map(({ circuit, cables }) => {
                          const typeLabel = CIRCUIT_TYPE_LABELS[circuit.type as keyof typeof CIRCUIT_TYPE_LABELS]?.label ?? circuit.type;
                          const printColor = getPrintColor(circuit.color);
                          return (
                            <div key={circuit.id} className="px-4 py-3 bg-white/[0.06]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: printColor.dot }} />
                                <span className="text-sm font-extrabold text-white">{circuit.name}</span>
                                <span className="text-xs text-slate-500">{typeLabel}</span>
                              </div>
                              <div className="space-y-1 ml-5">
                                {cables.map(({ cable, lengthM }) => (
                                  <div key={cable.id} className="text-xs text-slate-400 flex items-center justify-between">
                                    <span>{cable.materialName || 'Nezadaný materiál'}</span>
                                    <span className="font-semibold">{lengthM.toFixed(1)} m</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;

          case 'materials':
            return materialTotals.length > 0 ? (
              <div key="materials">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Materiál</h3>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Název</th><th className="px-4 py-2 text-right">Délka surová</th><th className="px-4 py-2 text-right">Odpady %</th><th className="px-4 py-2 text-right">Délka upravená</th>{showPrices && <th className="px-4 py-2 text-right">Cena/j.</th>}{showPrices && <th className="px-4 py-2 text-right">Celkem</th>}</tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {materialWithWaste.map((mat) => (
                        <tr key={mat.name} className="text-xs">
                          <td className="px-4 py-2 font-semibold text-white">{mat.name}</td>
                          <td className="px-4 py-2 text-right text-slate-400">{mat.rawLength.toFixed(1)} {mat.unit}</td>
                          <td className="px-4 py-2 text-right"><input type="number" value={mat.waste} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setWastePercents((prev) => ({ ...prev, [mat.name]: val })); }} className="w-16 px-2 py-1 border border-white/[0.08] rounded text-right" /></td>
                          <td className="px-4 py-2 text-right text-slate-400 font-semibold">{mat.adjustedLength.toFixed(1)} {mat.unit}</td>
                          {showPrices && <td className="px-4 py-2 text-right text-slate-400">{mat.pricePerUnit.toLocaleString('cs-CZ')} Kč</td>}
                          {showPrices && <td className="px-4 py-2 text-right font-extrabold text-blue-400">{mat.totalPrice.toLocaleString('cs-CZ')} Kč</td>}
                        </tr>
                      ))}
                      {showPrices && <tr className="bg-white/[0.04] font-extrabold text-sm"><td colSpan={5} className="px-4 py-2 text-white">Celkem materiál</td><td className="px-4 py-2 text-right text-blue-400">{totalMaterialPrice.toLocaleString('cs-CZ')} Kč</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;

          case 'fittings':
            return Object.keys(fittingsTotals.bendCounts).length > 0 ? (
              <div key="fittings">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Tvarovky</h3>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Materiál</th>{STANDARD_BEND_ANGLES.map((a) => <th key={a} className="px-4 py-2 text-right">{a}°</th>)}<th className="px-4 py-2 text-right">T-kusy</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {Object.entries(fittingsTotals.bendCounts).map(([matName, bends]) => (
                        <tr key={matName} className="text-xs"><td className="px-4 py-2 font-semibold text-white">{matName}</td>{STANDARD_BEND_ANGLES.map((a) => <td key={a} className="px-4 py-2 text-right text-slate-400">{bends[a] || 0}</td>)}<td className="px-4 py-2 text-right text-slate-400">{fittingsTotals.tPieceCounts[matName] || 0}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;

          case 'breakers':
            return breakerTotals.length > 0 ? (
              <div key="breakers">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Jištění</h3>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Proud</th><th className="px-4 py-2 text-center">Póly</th><th className="px-4 py-2 text-center">Křivka</th><th className="px-4 py-2 text-right">Množství</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {breakerTotals.map((b, idx) => (
                        <tr key={idx} className="text-xs"><td className="px-4 py-2 font-semibold text-white">{b.amperage}A</td><td className="px-4 py-2 text-center text-slate-400">{b.poles}</td><td className="px-4 py-2 text-center text-slate-400">{b.curve}</td><td className="px-4 py-2 text-right text-slate-400">{b.count} ks</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;

          case 'floorplans':
            return floorsWithImages.length > 0 ? (
              <div key="floorplans">
                {floorsWithImages.map((floor) => (
                  <SummaryFloorplanView key={floor.id} floor={floor} floors={floors} floorPins={listAllPins(selected, products, floor.id)} products={products} categories={categories} heatingSystems={heatingSystems} roomIdToName={roomIdToName} pinSize={pinSize} schematicSymbolScale={schematicSymbolScale} designElements={designElements} elementTypes={elementTypes} mountingGroups={mountingGroups} />
                ))}
              </div>
            ) : null;

          case 'trades':
            return (hasCableData || allPins.length > 0) ? (
              <SummaryTradePrint key="trades" floors={floors} products={products} categories={categories} selected={selected} heatingSystems={heatingSystems} roomIdToName={roomIdToName} getWastePercent={getWastePercent} getMaterialPrice={getMaterialPrice} alwaysVisible showPrices={showPrices} />
            ) : null;

          case 'heating':
            return <SummaryHeatingPrint key="heating" floors={floors} heatingSystems={heatingSystems} alwaysVisible showPrices={showPrices} />;

          case 'fv_system':
            if (!fvIncluded || !fvSummary || fvSummary.panelCount === 0) return null;
            return (
              <div key="fv_system">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-orange-500" />Fotovoltaický systém
                </h3>
                {fvSummaryLoading ? (
                  <div className="h-32 bg-orange-500/10 rounded-xl animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                        <div className="text-[9px] font-extrabold text-orange-500 uppercase tracking-wider">Výkon</div>
                        <div className="text-lg font-extrabold text-white">{fvSummary.totalKwp} kWp</div>
                        <div className="text-[10px] text-slate-500">{fvSummary.panelCount} panelů</div>
                      </div>
                      {fvSummary.inverterName && (
                        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                          <div className="text-[9px] font-extrabold text-orange-500 uppercase tracking-wider">Střídač</div>
                          <div className="text-sm font-extrabold text-white truncate">{fvSummary.inverterName}</div>
                          <div className="text-[10px] text-slate-500">{fvSummary.inverterKw} kW</div>
                        </div>
                      )}
                      {fvSummary.batteryKwh > 0 && (
                        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                          <div className="text-[9px] font-extrabold text-orange-500 uppercase tracking-wider">Baterie</div>
                          <div className="text-sm font-extrabold text-white truncate">{fvSummary.batteryName}</div>
                          <div className="text-[10px] text-slate-500">{fvSummary.batteryKwh} kWh ({fvSummary.batteryCount}x)</div>
                        </div>
                      )}
                      {fvSummary.wallboxName && (
                        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                          <div className="text-[9px] font-extrabold text-orange-500 uppercase tracking-wider">Wallbox</div>
                          <div className="text-sm font-extrabold text-white truncate">{fvSummary.wallboxName}</div>
                          <div className="text-[10px] text-slate-500">{fvSummary.wallboxKw} kW</div>
                        </div>
                      )}
                    </div>

                    {fvSummary.roofs.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-orange-500/10 font-extrabold text-xs text-orange-400 uppercase tracking-wider">Střešní plochy</div>
                        <table className="w-full">
                          <thead><tr className="bg-white/[0.04] text-xs font-extrabold text-slate-300"><th className="px-4 py-2 text-left">Plocha</th><th className="px-4 py-2 text-right">Panelů</th><th className="px-4 py-2 text-right">kWp</th><th className="px-4 py-2 text-right">Azimut</th><th className="px-4 py-2 text-right">Sklon</th></tr></thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {fvSummary.roofs.map((r, i) => (
                              <tr key={i} className="text-xs">
                                <td className="px-4 py-2 font-semibold text-white">{r.name}</td>
                                <td className="px-4 py-2 text-right text-slate-400">{r.panelCount}</td>
                                <td className="px-4 py-2 text-right font-semibold text-orange-400">{r.kwp.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-slate-400">{r.azimuth}°</td>
                                <td className="px-4 py-2 text-right text-slate-400">{r.tilt}°</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(fvSummary.accessories.length > 0 || fvSummary.customItems.length > 0) && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-orange-500/10 font-extrabold text-xs text-orange-400 uppercase tracking-wider">Příslušenství</div>
                        <div className="divide-y divide-white/[0.06]">
                          {fvSummary.accessories.map((a, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">{a.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{a.qty} ks</span>
                                {showPrices && <span className="font-extrabold text-orange-400">{a.price.toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                          {fvSummary.customItems.map((ci, i) => (
                            <div key={`ci-${i}`} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">{ci.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{ci.qty} {ci.unit}</span>
                                {showPrices && <span className="font-extrabold text-orange-400">{(ci.qty * ci.unitPrice).toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showPrices && fvSummary.totalInvestment > 0 && (
                      <div className="rounded-xl border-2 border-orange-500/30 overflow-hidden">
                        <div className="px-4 py-2 bg-orange-500/20 font-extrabold text-xs text-orange-400">Investice FV</div>
                        <div className="divide-y divide-orange-100 bg-white/[0.06]">
                          <div className="px-4 py-2 flex justify-between text-xs"><span className="text-slate-400">Celková investice</span><span className="font-extrabold text-white">{fvSummary.totalInvestment.toLocaleString('cs-CZ')} Kč</span></div>
                          {fvSummary.subsidy > 0 && <div className="px-4 py-2 flex justify-between text-xs"><span className="text-emerald-400">Dotace</span><span className="font-extrabold text-emerald-400">-{fvSummary.subsidy.toLocaleString('cs-CZ')} Kč</span></div>}
                          {fvSummary.subsidy > 0 && <div className="px-4 py-2 flex justify-between text-xs bg-orange-500/10"><span className="font-extrabold text-white">Po odečtení dotace</span><span className="font-extrabold text-orange-400">{(fvSummary.totalInvestment - fvSummary.subsidy).toLocaleString('cs-CZ')} Kč</span></div>}
                          {fvSummary.annualProduction > 0 && <div className="px-4 py-2 flex justify-between text-xs"><span className="text-slate-400">Roční výroba</span><span className="font-extrabold text-white">{Math.round(fvSummary.annualProduction).toLocaleString('cs-CZ')} kWh</span></div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );

          case 'camera_system':
            if (!cameraIncluded || !cameraSummary || cameraSummary.cameraCount === 0) return null;
            return (
              <div key="camera_system">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-sky-500" />Kamerový systém
                </h3>
                {cameraSummaryLoading ? (
                  <div className="h-32 bg-sky-500/10 rounded-xl animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-sky-500/10 rounded-xl p-3 border border-sky-500/20">
                        <div className="text-[9px] font-extrabold text-sky-500 uppercase tracking-wider">Kamery</div>
                        <div className="text-lg font-extrabold text-white">{cameraSummary.cameraCount}</div>
                      </div>
                      {cameraSummary.nvrCount > 0 && (
                        <div className="bg-sky-500/10 rounded-xl p-3 border border-sky-500/20">
                          <div className="text-[9px] font-extrabold text-sky-500 uppercase tracking-wider">NVR</div>
                          <div className="text-lg font-extrabold text-white">{cameraSummary.nvrCount}</div>
                        </div>
                      )}
                      {cameraSummary.switchCount > 0 && (
                        <div className="bg-sky-500/10 rounded-xl p-3 border border-sky-500/20">
                          <div className="text-[9px] font-extrabold text-sky-500 uppercase tracking-wider">PoE Switche</div>
                          <div className="text-lg font-extrabold text-white">{cameraSummary.switchCount}</div>
                        </div>
                      )}
                      <div className="bg-sky-500/10 rounded-xl p-3 border border-sky-500/20">
                        <div className="text-[9px] font-extrabold text-sky-500 uppercase tracking-wider">Záznam</div>
                        <div className="text-sm font-extrabold text-white">{cameraSummary.storageConfig.codec.toUpperCase()}</div>
                        <div className="text-[10px] text-slate-500">{cameraSummary.storageConfig.retentionDays} dní</div>
                      </div>
                    </div>

                    {cameraSummary.cameras.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-sky-500/10 font-extrabold text-xs text-sky-400 uppercase tracking-wider">Kamery</div>
                        <div className="divide-y divide-white/[0.06]">
                          {cameraSummary.cameras.map((c, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">{c.modelName}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{c.count} ks</span>
                                {showPrices && <span className="font-extrabold text-sky-400">{c.price.toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(cameraSummary.nvrs.length > 0 || cameraSummary.switches.length > 0) && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-sky-500/10 font-extrabold text-xs text-sky-400 uppercase tracking-wider">Záznamová a síťová technika</div>
                        <div className="divide-y divide-white/[0.06]">
                          {cameraSummary.nvrs.map((n, i) => (
                            <div key={`nvr-${i}`} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">NVR: {n.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{n.count} ks</span>
                                {showPrices && <span className="font-extrabold text-sky-400">{n.price.toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                          {cameraSummary.switches.map((s, i) => (
                            <div key={`sw-${i}`} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">Switch: {s.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{s.count} ks</span>
                                {showPrices && <span className="font-extrabold text-sky-400">{s.price.toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cameraSummary.accessories.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-sky-500/10 font-extrabold text-xs text-sky-400 uppercase tracking-wider">Příslušenství</div>
                        <div className="divide-y divide-white/[0.06]">
                          {cameraSummary.accessories.map((a, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                              <span className="font-semibold text-slate-300">{a.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{a.qty} ks</span>
                                {showPrices && <span className="font-extrabold text-sky-400">{a.price.toLocaleString('cs-CZ')} Kč</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showPrices && (
                      <div className="rounded-xl border-2 border-sky-500/30 overflow-hidden">
                        <div className="px-4 py-2 bg-sky-500/20 font-extrabold text-xs text-sky-400">Celkem kamery</div>
                        <div className="px-4 py-3 bg-white/[0.06] flex justify-between">
                          <span className="text-sm font-extrabold text-white">Celková cena</span>
                          <span className="text-lg font-extrabold text-sky-400">{cameraSummary.totalPrice.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );

          case 'schematic': {
            if (!hasSchematicData || !schematicSummary) return null;
            const getProduct = (productId: string | null) => productId ? products.find(p => p.id === productId) : null;
            const getRoomName = (roomId: string | null) => {
              if (!roomId) return 'Nezadáno';
              for (const floor of floors) {
                const room = (floor.rooms ?? []).find(r => r.id === roomId);
                if (room) return room.name;
              }
              return 'Neznámá místnost';
            };

            const { elementRows, aggregatedRows, frameRows, moduleRows, stats, warnings: summaryWarnings } = schematicSummary;

            return (
              <div key="schematic">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />Schematický návrh
                </h3>
                {schematicDataLoading ? (
                  <div className="h-32 bg-indigo-500/10 rounded-xl animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20">
                        <div className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-wider">Prvků celkem</div>
                        <div className="text-lg font-extrabold text-white">{stats.totalElements}</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                        <div className="text-[9px] font-extrabold text-emerald-500 uppercase tracking-wider">Přiřazeno</div>
                        <div className="text-lg font-extrabold text-white">{stats.assignedElements}</div>
                      </div>
                      {stats.unassignedElements > 0 && (
                        <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                          <div className="text-[9px] font-extrabold text-red-500 uppercase tracking-wider">Nepřiřazeno</div>
                          <div className="text-lg font-extrabold text-white">{stats.unassignedElements}</div>
                        </div>
                      )}
                      <div className="bg-violet-500/10 rounded-xl p-3 border border-violet-500/20">
                        <div className="text-[9px] font-extrabold text-violet-500 uppercase tracking-wider">Vícerámečky</div>
                        <div className="text-lg font-extrabold text-white">{stats.totalGroups}</div>
                      </div>
                      {stats.totalFrames > 0 && (
                        <div className="bg-teal-500/10 rounded-xl p-3 border border-teal-500/20">
                          <div className="text-[9px] font-extrabold text-teal-500 uppercase tracking-wider">Rámečků</div>
                          <div className="text-lg font-extrabold text-white">{stats.totalFrames}</div>
                        </div>
                      )}
                    </div>

                    {(stats.warningCount > 0 || summaryWarnings.length > 0) && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <div className="text-[9px] font-extrabold text-amber-500 uppercase tracking-wider mb-1">Upozornění ({stats.warningCount})</div>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                          {summaryWarnings.filter(w => w.severity !== 'info').slice(0, 5).map((w, i) => (
                            <div key={i} className={`text-xs ${w.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{w.message}</div>
                          ))}
                          {summaryWarnings.filter(w => w.severity !== 'info').length > 5 && (
                            <div className="text-xs text-slate-500">...a dalších {summaryWarnings.filter(w => w.severity !== 'info').length - 5}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {aggregatedRows.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-indigo-500/10 font-extrabold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                          <Package className="w-3.5 h-3.5" />
                          Schematické prvky a přiřazené produkty
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {aggregatedRows.map((row) => {
                            const catColor = categoryColorMap[row.category] ?? getCategoryColor(row.category);
                            const isDesignSeries = row.assignmentType === 'design_series';
                            return (
                              <div key={`${row.elementTypeId}_${row.productId ?? 'unassigned'}`} className={`px-4 py-2.5 ${row.productId ? 'bg-white/[0.06]' : 'bg-red-500/5'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: catColor }} />
                                    <span className="text-sm font-semibold text-white">{row.elementTypeName}</span>
                                    {isDesignSeries && (
                                      <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">série</span>
                                    )}
                                    {row.hasWarnings && (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-extrabold text-white">{row.quantity} ks</span>
                                    {showPrices && row.productPrice > 0 && (
                                      <span className="text-sm font-extrabold text-blue-400">{(row.productPrice * row.quantity).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {row.productId ? (
                                      <span className="text-xs text-emerald-400">{row.productName} <span className="text-slate-500">{row.productCode}</span></span>
                                    ) : (
                                      <span className="text-xs text-red-400 font-semibold">Nepřiřazeno</span>
                                    )}
                                  </div>
                                  {row.roomBreakdown.length > 1 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {row.roomBreakdown.slice(0, 3).map((rb, idx) => (
                                        <span key={idx} className="text-[10px] text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                          {rb.roomName || 'Nezadáno'}: {rb.count}
                                        </span>
                                      ))}
                                      {row.roomBreakdown.length > 3 && (
                                        <span className="text-[10px] text-slate-500">+{row.roomBreakdown.length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {elementRows.length > 0 && allRooms.length > 0 && (() => {
                      const circuitNameMap = new Map<string, string>();
                      for (const floor of floors) {
                        for (const circuit of (floor.circuits ?? [])) {
                          circuitNameMap.set(circuit.id, circuit.name);
                        }
                      }
                      const roomElementMap = new Map<string, typeof elementRows>();
                      for (const row of elementRows) {
                        const key = row.roomId ?? '__none__';
                        if (!roomElementMap.has(key)) roomElementMap.set(key, []);
                        roomElementMap.get(key)!.push(row);
                      }
                      const sortedRooms = [...allRooms.map(r => ({ id: r.id, name: r.name })), { id: '__none__', name: 'Nezařazeno' }].filter(r => roomElementMap.has(r.id));
                      if (sortedRooms.length === 0) return null;
                      return (
                        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                          <div className="px-4 py-2.5 bg-indigo-500/10 font-extrabold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" />
                            Přehled instalovaných prvků po místnostech
                          </div>
                          <div className="divide-y divide-white/[0.06]">
                            {sortedRooms.map(room => {
                              const rows = roomElementMap.get(room.id) ?? [];
                              return (
                                <div key={room.id}>
                                  <div className="px-4 py-1.5 bg-white/[0.03] text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                                    {room.name}
                                    <span className="text-slate-600 font-normal">({rows.reduce((s, r) => s + r.quantity, 0)} ks)</span>
                                  </div>
                                  {rows.map((row, ri) => {
                                    const elData = designElements.find(e => row.elementIds.includes(e.id));
                                    const catColor = categoryColorMap[row.category] ?? getCategoryColor(row.category);
                                    return (
                                      <div key={ri} className={`px-4 py-2 flex items-start justify-between ${row.productId ? 'bg-white/[0.04]' : 'bg-red-500/5'}`}>
                                        <div className="flex items-start gap-2 min-w-0">
                                          <span className="w-2 h-2 rounded mt-1 shrink-0" style={{ backgroundColor: catColor }} />
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-white truncate">
                                              {row.elementTypeName}
                                              {elData?.label && <span className="text-slate-500 ml-1 font-normal">({elData.label})</span>}
                                            </div>
                                            {row.productId ? (
                                              <div className="text-[10px] text-emerald-400 mt-0.5">{row.productName} {row.productCode && <span className="text-slate-500">({row.productCode})</span>}</div>
                                            ) : (
                                              <div className="text-[10px] text-red-400 font-semibold mt-0.5">Nepřiřazeno</div>
                                            )}
                                            {(elData?.note || elData?.circuit_id || elData?.mounting_height) && (
                                              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                {elData.circuit_id && <span>Okruh: {circuitNameMap.get(elData.circuit_id) ?? elData.circuit_id}</span>}
                                                {elData.mounting_height && <span>V: {elData.mounting_height}</span>}
                                                {elData.note && <span>{elData.note}</span>}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                          <span className="text-xs font-extrabold text-white">{row.quantity} ks</span>
                                          {showPrices && row.productPrice > 0 && (
                                            <span className="text-xs text-blue-400">{(row.productPrice * row.quantity).toLocaleString('cs-CZ')} Kč</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {frameRows.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-teal-500/10 font-extrabold text-xs text-teal-400 uppercase tracking-wider flex items-center gap-2">
                          <Grid className="w-3.5 h-3.5" />
                          Automaticky generované rámečky
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {frameRows.map((frame, i) => {
                            const orientLabel = frame.frameSize > 1 ? (frame.orientation === 'horizontal' ? 'vodorovný' : 'svislý') : '';
                            const displayName = frame.targetProductName || `${frame.designSeriesName} - ${frame.frameSize}R ${orientLabel}`;
                            return (
                              <div key={i} className={`px-4 py-2.5 ${frame.hasMapping ? 'bg-white/[0.06]' : 'bg-amber-500/5'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{displayName}</span>
                                    {frame.colorName && <span className="text-xs text-slate-400">({frame.colorName})</span>}
                                    {!frame.hasMapping && frame.frameSize > 1 && (
                                      <span className="text-[9px] text-amber-400 font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">fallback</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-extrabold text-white">{frame.quantity} ks</span>
                                    {showPrices && frame.unitPrice > 0 && (
                                      <span className="text-sm font-extrabold text-teal-400">{(frame.unitPrice * frame.quantity).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                    {frame.hasMapping ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Info className="w-3.5 h-3.5 text-amber-500" />
                                    )}
                                  </div>
                                </div>
                                {frame.targetProductCode && (
                                  <div className="text-xs text-slate-500 mt-0.5">{frame.targetProductCode}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {moduleRows.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-blue-500/10 font-extrabold text-xs text-blue-400 uppercase tracking-wider flex items-center gap-2">
                          <Package className="w-3.5 h-3.5" />
                          Moduly vícerámečků
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {moduleRows.map((mod, i) => (
                            <div key={i} className={`px-4 py-2 ${mod.productId ? 'bg-white/[0.06]' : 'bg-amber-500/5'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">{mod.productName || mod.moduleName}</span>
                                  <span className="text-xs text-slate-500">{mod.designSeriesName}</span>
                                  {!mod.productId && (
                                    <span className="text-[9px] text-amber-400 font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">bez mapování</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-extrabold text-white">{mod.quantity} ks</span>
                                  {showPrices && mod.unitPrice > 0 && (
                                    <span className="text-sm font-extrabold text-blue-400">{(mod.unitPrice * mod.quantity).toLocaleString('cs-CZ')} Kč</span>
                                  )}
                                </div>
                              </div>
                              {mod.productCode && (
                                <div className="text-xs text-slate-500 mt-0.5">{mod.productCode}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mountingGroups.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        <div className="px-4 py-2.5 bg-violet-500/10 font-extrabold text-xs text-violet-400 uppercase tracking-wider">Detail vícerámečků</div>
                        <div className="divide-y divide-white/[0.06]">
                          {mountingGroups.map((mg) => {
                            const roomName = getRoomName(mg.room_id);
                            const filledSlots = mg.slots.filter(s => s.element_id || s.module_name).length;
                            const dsProduct = mg.design_series_id ? getProduct(mg.design_series_id) : null;
                            return (
                              <div key={mg.id} className="px-4 py-2 flex items-center justify-between text-xs bg-white/[0.06]">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-white">{mg.label || `R${mg.frame_size}`}</span>
                                  <span className="text-slate-500">{mg.frame_size}R</span>
                                  <span className="text-[10px] text-slate-400">{mg.orientation === 'vertical' ? 'svisle' : 'vodorovně'}</span>
                                  {dsProduct && <span className="text-[10px] text-blue-400">{dsProduct.name}</span>}
                                  {!mg.design_series_id && <span className="text-[10px] text-amber-400">bez řady</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-teal-400">{roomName}</span>
                                  <span className="text-slate-500">{filledSlots}/{mg.frame_size} slotů</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );

          }
          default:
            return null;
        }
      })}

      {showPrices && (
        <div className="rounded-xl border-2 border-slate-900 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white font-extrabold text-sm">Celkový souhrn</div>
          <div className="divide-y divide-slate-200 bg-white/[0.06]">
            {elektroTotal > 0 && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">{floorplanLabel}</span>
                <span className="text-sm font-extrabold text-white">{elektroTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
            )}
            {fvTotal > 0 && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-orange-400">Fotovoltaika</span>
                <span className="text-sm font-extrabold text-orange-400">{fvTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
            )}
            {cameraTotal > 0 && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-sky-400">Kamerový systém</span>
                <span className="text-sm font-extrabold text-sky-400">{cameraTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
            )}
            {epsTotal > 0 && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-400">EPS / EZS</span>
                <span className="text-sm font-extrabold text-red-400">{epsTotal.toLocaleString('cs-CZ')} Kč</span>
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between bg-white/[0.04]">
              <span className="text-base font-extrabold text-white">Celkem</span>
              <span className="text-xl font-extrabold text-blue-400">{grandTotal.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>
        </div>
      )}
      </div>

      <Modal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="Poptávka dodavatele"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowSupplierModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSupplierExport}
              disabled={selectedTrades.length === 0}
              className="px-5 py-2 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Exportovat XLS
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Vyberte obory pro export poptávky:</p>
          <div className="space-y-2">
            {AVAILABLE_TRADES.map(trade => (
              <label
                key={trade}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={selectedTrades.includes(trade)}
                  onChange={() => toggleTrade(trade)}
                  className="rounded border-white/[0.12]"
                />
                <span className="text-sm font-semibold text-slate-300">{trade}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
