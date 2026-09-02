/**
 * Nativni vektorovy PDF dokument "Souhrn projektu" (@react-pdf/renderer).
 * Obsahove je to prepis HTML tiskove sablony ze selectionPdfExport.ts -
 * pri zmene obsahu drz obe cesty v souladu, dokud stara tiskova nezmizi.
 * Pudorysy prichazeji jako predem slozene bitmapy (composeFloorplans.ts)
 * a sazi se na stranky na sirku pres celou sirku.
 */
import type { ReactNode } from 'react';
import { Document, Page, View, Text, Image, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import type { ExportData, SectionKey } from '../selectionPdfExport';
import type { PdfExportOptions } from './exportOptions';
import type { ComposedPlan } from './composeFloorplans';
import type { Product, Category } from '../../../types/database';
import type { Floor } from '../../../hooks/useProjectState';
import { listAllPins, describeConfig } from '../../catalog/floorplan/pinUtils';
import {
  polylineLength, normalizedToMeters, analyzeBends, countTPieces,
  STANDARD_BEND_ANGLES, polygonAreaM2, polygonPerimeterM,
} from '../../catalog/floorplan/geometry';
import { CIRCUIT_TYPE_LABELS, ALL_TRADES } from '../../catalog/floorplan/materialLibrary';
import { getPrintColor } from '../../catalog/summary/summaryUtils';
import { calculateHeatingMaterials } from '../../../hooks/useHeatingSystems';
import { buildSchematicSummary } from '../../../lib/schematicSummaryBuilder';

export const PDF_EXPORT_VERSION = 'PDF 2026-09-02d';

/** HTML sablona je kalibrovana v px na ~794px sirky A4; 1 px = 0.75 pt. */
const P = (px: number) => px * 0.75;

const C = {
  ink: '#1a1a2e', head: '#0f172a', s700: '#334155', s600: '#475569', s500: '#64748b', s400: '#94a3b8',
  border: '#e2e8f0', borderSoft: '#eef0f4', soft: '#f8fafc', blue: '#1e40af', blue600: '#2563eb',
  teal: '#0f766e', amber: '#b45309', red: '#991b1b',
};

const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
const fmtRound = (n: number) => Math.round(n).toLocaleString('cs-CZ');

// ---------------------------------------------------------------- primitives

function Lbl({ children, color = C.s400 }: { children: ReactNode; color?: string }) {
  return <Text style={{ fontSize: P(7), textTransform: 'uppercase', letterSpacing: 1.2, color, fontWeight: 700 }}>{children}</Text>;
}

function H2({ dot, children }: { dot?: string; children: ReactNode }) {
  return (
    <View minPresenceAhead={60} style={{ flexDirection: 'row', alignItems: 'center', gap: P(6), marginTop: P(20), marginBottom: P(8) }}>
      {dot ? <View style={{ width: P(8), height: P(8), borderRadius: P(2), backgroundColor: dot }} /> : null}
      <Text style={{ fontSize: P(10), textTransform: 'uppercase', letterSpacing: 1, color: C.s500, fontWeight: 700 }}>{children}</Text>
    </View>
  );
}

interface Cell {
  t?: ReactNode;
  flex?: number;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
  color?: string;
  size?: number;
}

function Row({ cells, header, bg, last }: { cells: Cell[]; header?: boolean; bg?: string; last?: boolean }) {
  return (
    <View wrap={false} style={{
      flexDirection: 'row',
      backgroundColor: bg ?? (header ? C.soft : undefined),
      borderBottomWidth: last ? 0 : 0.75,
      borderBottomColor: C.borderSoft,
    }}>
      {cells.map((c, i) => (
        <View key={i} style={{ flex: c.flex ?? 1, paddingVertical: P(header ? 5 : 4), paddingHorizontal: P(6) }}>
          <Text style={{
            fontSize: P(c.size ?? (header ? 8 : 9)),
            textAlign: c.align ?? 'left',
            fontWeight: header || c.bold ? 700 : 400,
            color: c.color ?? (header ? C.s600 : C.ink),
            textTransform: header ? 'uppercase' : undefined,
            letterSpacing: header ? 0.5 : undefined,
          }}>{c.t ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: P(6), overflow: 'hidden', marginBottom: P(10) }}>{children}</View>;
}

function Dot({ color, round = true, size = 7 }: { color: string; round?: boolean; size?: number }) {
  return <View style={{ width: P(size), height: P(size), borderRadius: round ? P(size) : P(2), backgroundColor: color, marginRight: P(4) }} />;
}

// ------------------------------------------------------------- derived data

function computeDerived(data: ExportData) {
  const { selected, products, categories, floors, materials, wastePercents } = data;

  const objectCounts: Record<string, number> = {};
  for (const floor of floors) for (const obj of floor.objects ?? []) objectCounts[obj.productId] = (objectCounts[obj.productId] ?? 0) + 1;
  const qtyOf = (pid: string) => (selected[pid]?.placements?.length ?? 0) + (objectCounts[pid] ?? 0);

  const allProductIds = new Set([...Object.keys(selected), ...Object.keys(objectCounts)]);
  const selectedProducts = Array.from(allProductIds).map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];
  const allPinsCount = Object.keys(selected).reduce((s, pid) => s + selected[pid].placements.length, 0);
  const totalPlacedCount = allPinsCount + Object.values(objectCounts).reduce((s, c) => s + c, 0);

  const allRooms: { id: string; name: string }[] = [];
  for (const floor of floors) for (const room of floor.rooms ?? []) allRooms.push({ id: room.id, name: room.name });
  const roomIdToName = (id: string) => allRooms.find(r => r.id === id)?.name ?? id;

  const groupedByCat = categories
    .map(cat => ({ cat, items: selectedProducts.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0);

  const totalProductPrice = selectedProducts.reduce((sum, p) => sum + p.price * qtyOf(p.id), 0);

  const totMap: Record<string, { name: string; rawLength: number; unit: string; pricePerUnit: number }> = {};
  for (const floor of floors) {
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const lengthM = floor.scale ? normalizedToMeters(polylineLength(cable.points), floor.scale) : 0;
      if (!totMap[cable.materialName]) {
        const mat = materials.find(m => m.name === cable.materialName);
        totMap[cable.materialName] = { name: cable.materialName, rawLength: 0, unit: mat?.unit ?? 'm', pricePerUnit: mat?.price_per_unit ?? 0 };
      }
      totMap[cable.materialName].rawLength += lengthM;
    }
  }
  const materialWithWaste = Object.values(totMap).map(mat => {
    const waste = wastePercents[mat.name] ?? 0;
    const adjustedLength = mat.rawLength * (1 + waste / 100);
    return { ...mat, waste, adjustedLength, totalPrice: adjustedLength * mat.pricePerUnit };
  });
  const totalMaterialPrice = materialWithWaste.reduce((s, m) => s + m.totalPrice, 0);
  const grandTotal = totalProductPrice + totalMaterialPrice;

  return { objectCounts, qtyOf, selectedProducts, totalPlacedCount, allRooms, roomIdToName, groupedByCat, materialWithWaste, totalMaterialPrice, grandTotal };
}

// ------------------------------------------------------------------ pieces

function PinTable({ pins, objects, categories, circuits, roomIdToName, products, includeConfig }: {
  pins: ReturnType<typeof listAllPins>;
  objects: Floor['objects'];
  categories: Category[];
  circuits: { id: string; color: string; name: string }[];
  roomIdToName: (id: string) => string;
  products: Product[];
  includeConfig: boolean;
}) {
  if (pins.length === 0 && (objects?.length ?? 0) === 0) return null;
  const cols = includeConfig ? [1.1, 0.9, 2.2, 1.6, 1.2, 0.8, 1.6, 1.4] : [1.1, 0.9, 2.2, 1.6, 1.2, 0.8, 1.4];
  const head: Cell[] = [
    { t: 'Pin', flex: cols[0] }, { t: 'Kód', flex: cols[1] }, { t: 'Položka', flex: cols[2] },
    { t: 'Místnost', flex: cols[3] }, { t: 'Okruh', flex: cols[4] }, { t: 'Výška', flex: cols[5] },
  ];
  if (includeConfig) head.push({ t: 'Konfigurace', flex: cols[6] });
  head.push({ t: 'Poznámka', flex: cols[includeConfig ? 7 : 6] });

  return (
    <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: P(4), overflow: 'hidden', marginTop: P(6), marginBottom: P(8) }}>
      <Row header cells={head} />
      {pins.map((pin, idx) => {
        const pcat = categories.find(c => c.id === pin.product.category_id);
        const pc = getPrintColor(pcat?.pill_color ?? '');
        const pinCircuit = pin.placement.circuitId ? circuits.find(c => c.id === pin.placement.circuitId) : null;
        const dotColor = pinCircuit?.color ?? pc.dot;
        const cells: Cell[] = [
          {
            t: (
              <>
                <Text style={{ color: dotColor }}>● </Text>
                <Text style={{ fontWeight: 700 }}>{pin.label}</Text>
              </>
            ), flex: cols[0],
          },
          { t: pin.product.code, flex: cols[1], color: C.s500 },
          { t: pin.product.name, flex: cols[2] },
          { t: pin.placement.room ? roomIdToName(pin.placement.room) : '—', flex: cols[3], color: C.teal, bold: true },
          { t: pinCircuit ? pinCircuit.name : '—', flex: cols[4] },
          { t: pin.placement.mountingHeight || '—', flex: cols[5] },
        ];
        if (includeConfig) cells.push({ t: pin.placement.config ? describeConfig(pin.placement.config) : '—', flex: cols[6] });
        cells.push({ t: pin.placement.note || '—', flex: cols[includeConfig ? 7 : 6] });
        const isLast = idx === pins.length - 1 && (objects?.length ?? 0) === 0;
        return <Row key={pin.placement.id} cells={cells} last={isLast} />;
      })}
      {(objects ?? []).map((obj, idx) => {
        const product = products.find(p => p.id === obj.productId);
        if (!product) return null;
        const cells: Cell[] = [
          { t: <><Text style={{ color: '#3b82f6' }}>■ </Text><Text style={{ fontWeight: 700 }}>{product.code}</Text></>, flex: cols[0] },
          { t: product.code, flex: cols[1], color: C.s500 },
          { t: product.name, flex: cols[2] },
          { t: obj.roomId ? roomIdToName(obj.roomId) : '—', flex: cols[3], color: C.teal, bold: true },
          { t: '—', flex: cols[4] },
          { t: '—', flex: cols[5] },
        ];
        if (includeConfig) cells.push({ t: '—', flex: cols[6] });
        cells.push({ t: obj.note || '—', flex: cols[includeConfig ? 7 : 6] });
        return <Row key={`obj-${idx}`} cells={cells} bg="#eff6ff" last={idx === (objects?.length ?? 0) - 1} />;
      })}
    </View>
  );
}

function PlanImage({ plan }: { plan: ComposedPlan }) {
  // stranka na sirku: obraz pres celou sirku obsahu; strop vysky nechava
  // misto nadpisu a zacatku tabulky, jinak plan odskoci na prazdnou stranu
  const contentW = 841.89 - 2 * 26;
  const maxH = 440;
  let w = contentW;
  let h = w / plan.aspect;
  if (h > maxH) { h = maxH; w = h * plan.aspect; }
  return (
    <View style={{ alignItems: 'center', marginBottom: P(6) }}>
      <Image src={plan.dataUrl} style={{ width: w, height: h, borderWidth: 0.75, borderColor: C.border }} />
    </View>
  );
}

function TotalBox({ rows, grand }: { rows: { label: string; value: string; color?: string }[]; grand: { label: string; value: string } }) {
  return (
    <View wrap={false} style={{ borderWidth: 1.5, borderColor: C.head, borderRadius: P(8), overflow: 'hidden', marginTop: P(18) }}>
      <View style={{ backgroundColor: C.head, paddingVertical: P(8), paddingHorizontal: P(12) }}>
        <Text style={{ color: '#fff', fontWeight: 700, fontSize: P(11) }}>Celkový souhrn</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: P(6), paddingHorizontal: P(12), borderBottomWidth: 0.75, borderBottomColor: C.border }}>
          <Text style={{ fontSize: P(10), fontWeight: 500, color: r.color ?? C.s600 }}>{r.label}</Text>
          <Text style={{ fontSize: P(10), fontWeight: 700, color: r.color ?? C.ink }}>{r.value}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: P(10), paddingHorizontal: P(12), backgroundColor: C.soft }}>
        <Text style={{ fontSize: P(13), fontWeight: 700 }}>{grand.label}</Text>
        <Text style={{ fontSize: P(13), fontWeight: 700, color: C.blue }}>{grand.value}</Text>
      </View>
    </View>
  );
}

function Footer({ projectName }: { projectName: string }) {
  const dateStr = new Date().toLocaleDateString('cs-CZ');
  return (
    <View fixed style={{ position: 'absolute', left: 26, right: 26, bottom: 18, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderTopColor: C.border, paddingTop: P(6) }}>
      <Text style={{ fontSize: P(8), color: C.s400 }}>Vygenerováno: {dateStr} | HouseSmart | {PDF_EXPORT_VERSION}</Text>
      <Text style={{ fontSize: P(8), color: C.s400 }} render={({ pageNumber, totalPages }) => `${projectName} · ${pageNumber}/${totalPages}`} />
    </View>
  );
}

// ---------------------------------------------------------------- document

export interface SelectionPdfProps {
  data: ExportData;
  options: PdfExportOptions;
  planImages: Record<string, ComposedPlan>;
  tradePlanImages: Record<string, ComposedPlan>;
}

const PAGE_PAD = { paddingTop: 26, paddingHorizontal: 26, paddingBottom: 48 };

export default function SelectionPdfDocument({ data, options, planImages, tradePlanImages }: SelectionPdfProps) {
  const {
    selected, products, categories, floors, heatingSystems, wastePercents, designModules, productModulesMap,
    projectName, clientName, fvSummary, cameraSummary, fvIncluded = true, cameraIncluded = true,
    floorplanLabel, epsSummary, epsIncluded = true, designElements = [], elementTypes = [],
    mountingGroups = [], productAssignments = [], productKindMap = new Map(), designSeriesLinks = [],
  } = data;

  const D = computeDerived(data);
  const show = (key: SectionKey) => options.sections[key] !== false;
  const rowPrices = options.priceLevel === 'full';
  const totalPrices = options.priceLevel !== 'none';
  const dateStr = new Date().toLocaleDateString('cs-CZ');
  const getWastePercent = (name: string) => wastePercents[name] ?? 0;
  const getMaterialPrice = (name: string) => data.materials.find(m => m.name === name)?.price_per_unit ?? 0;
  const floorEnabled = (id: string) => options.floorIds[id] !== false;
  const tradeEnabled = (t: string) => options.trades[t] !== false;

  const fvActive = fvIncluded && !!fvSummary && fvSummary.panelCount > 0;
  const cameraActive = cameraIncluded && !!cameraSummary && cameraSummary.cameraCount > 0;
  const epsActive = epsIncluded && !!epsSummary && epsSummary.detectorCount > 0;
  const fvTotalPrice = fvIncluded && fvSummary ? fvSummary.totalInvestment : 0;
  const cameraTotalPrice = cameraIncluded && cameraSummary ? cameraSummary.totalPrice : 0;
  const epsTotalPrice = epsIncluded && epsSummary ? epsSummary.totalPrice : 0;
  const combinedGrandTotal = D.grandTotal + fvTotalPrice + cameraTotalPrice + epsTotalPrice;

  // ---- rozlozeni podle mistnosti
  const roomProductMap: Record<string, { product: Product; count: number; colorCounts?: Record<string, { count: number; hex: string }> }[]> = {};
  const addToRoomMap = (rName: string, product: Product, colorName?: string | null, colorHex?: string) => {
    if (!roomProductMap[rName]) roomProductMap[rName] = [];
    const existing = roomProductMap[rName].find(rp => rp.product.id === product.id);
    if (existing) {
      existing.count += 1;
      if (colorName) {
        if (!existing.colorCounts) existing.colorCounts = {};
        if (!existing.colorCounts[colorName]) existing.colorCounts[colorName] = { count: 0, hex: colorHex || '#ccc' };
        existing.colorCounts[colorName].count++;
      }
    } else {
      const entry: typeof roomProductMap[string][number] = { product, count: 1 };
      if (colorName) entry.colorCounts = { [colorName]: { count: 1, hex: colorHex || '#ccc' } };
      roomProductMap[rName].push(entry);
    }
  };
  for (const pid of Object.keys(selected)) {
    const product = products.find(p => p.id === pid);
    if (!product) continue;
    for (const pl of selected[pid].placements) {
      const rName = pl.room ? D.allRooms.find(r => r.id === pl.room)?.name ?? 'Nezařazeno' : 'Nezařazeno';
      const plAny = pl as unknown as { colorName?: string; colorHex?: string };
      addToRoomMap(rName, product, pl.config?.colorName ?? plAny.colorName ?? null, pl.config?.colorHex ?? plAny.colorHex ?? '#ccc');
    }
  }
  for (const floor of floors) {
    for (const obj of floor.objects ?? []) {
      const product = products.find(p => p.id === obj.productId);
      if (!product) continue;
      addToRoomMap(obj.roomId ? D.allRooms.find(r => r.id === obj.roomId)?.name ?? 'Nezařazeno' : 'Nezařazeno', product);
    }
  }

  // ---- trasy a kabely
  const cablesByFloor = floors.map(floor => ({
    floor,
    circuits: (floor.circuits ?? []).map(circuit => ({
      circuit,
      cables: (floor.cables ?? []).filter(c => c.circuitId === circuit.id).map(cable => ({
        cable, lengthM: floor.scale ? normalizedToMeters(polylineLength(cable.points), floor.scale) : 0,
      })),
    })).filter(c => c.cables.length > 0),
  })).filter(f => f.circuits.length > 0);

  // ---- tvarovky
  const bendCounts: Record<string, Record<number, number>> = {};
  const tPieceCounts: Record<string, number> = {};
  for (const floor of floors) {
    const fCircuits = floor.circuits ?? [];
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const cType = fCircuits.find(c => c.id === cable.circuitId)?.type ?? 'electric';
      if (cType !== 'water' && cType !== 'heating') continue;
      if (!bendCounts[cable.materialName]) {
        bendCounts[cable.materialName] = {};
        for (const angle of STANDARD_BEND_ANGLES) bendCounts[cable.materialName][angle] = 0;
      }
      for (const bend of analyzeBends(cable.points)) bendCounts[cable.materialName][bend.angle]++;
    }
    const cablesByMat: Record<string, typeof floor.cables> = {};
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const cType = fCircuits.find(c => c.id === cable.circuitId)?.type ?? 'electric';
      if (cType !== 'water' && cType !== 'heating') continue;
      if (!cablesByMat[cable.materialName]) cablesByMat[cable.materialName] = [];
      cablesByMat[cable.materialName]!.push(cable);
    }
    for (const [matName, cabs] of Object.entries(cablesByMat)) {
      tPieceCounts[matName] = (tPieceCounts[matName] ?? 0) + countTPieces(cabs ?? []);
    }
  }

  // ---- jisteni
  const bMap: Record<string, { amperage: number; poles: number; curve: string; count: number }> = {};
  for (const floor of floors) {
    for (const circuit of floor.circuits ?? []) {
      if (!circuit.breaker) continue;
      const key = `${circuit.breaker.amperage}-${circuit.breaker.poles}-${circuit.breaker.curve}`;
      if (!bMap[key]) bMap[key] = { ...circuit.breaker, count: 0 };
      bMap[key].count++;
    }
  }
  const breakerTotals = Object.values(bMap);

  // ---- rekuperace
  const DUCT_CAPS: Record<number, number> = { 75: 25, 90: 38 };
  const ventRows: { floorName: string; roomName: string; areaM2: number; airFlow: number; mode: string; supplyVents: number; exhaustVents: number }[] = [];
  let ventTotalSupply = 0, ventTotalExhaust = 0, ventTotalSupplyVents = 0, ventTotalExhaustVents = 0;
  for (const floor of floors) {
    if (!floor.scale) continue;
    for (const room of floor.rooms ?? []) {
      const mode = room.ventilationMode;
      if (!mode) continue;
      const areaM2 = polygonAreaM2(room.points, floor.scale);
      const airFlow = areaM2 * (room.ceilingHeight ?? 2.6) * (room.airChangesPerHour ?? 0.5);
      const autoVents = Math.ceil(airFlow / (DUCT_CAPS[room.ductDiameter ?? 75] ?? 25));
      const supplyVents = room.manualSupplyVents ?? (mode === 'supply' || mode === 'both' ? autoVents : 0);
      const exhaustVents = room.manualExhaustVents ?? (mode === 'exhaust' || mode === 'both' ? autoVents : 0);
      if (mode === 'supply' || mode === 'both') ventTotalSupply += airFlow;
      if (mode === 'exhaust' || mode === 'both') ventTotalExhaust += airFlow;
      ventTotalSupplyVents += supplyVents;
      ventTotalExhaustVents += exhaustVents;
      ventRows.push({
        floorName: floor.name, roomName: room.name, areaM2, airFlow,
        mode: mode === 'supply' ? 'Přívod' : mode === 'exhaust' ? 'Odvod' : 'Přívod + Odvod',
        supplyVents, exhaustVents,
      });
    }
  }

  // ---- osvetleni
  const lightingRows: { floorName: string; roomName: string; areaM2: number; requiredLux: number; requiredLumens: number; currentLumens: number; pct: number; isOk: boolean }[] = [];
  for (const floor of floors) {
    if (!floor.scale) continue;
    for (const room of floor.rooms ?? []) {
      if (!room.requiredLux || room.requiredLux <= 0) continue;
      const areaM2 = polygonAreaM2(room.points, floor.scale);
      const requiredLumens = Math.round((room.requiredLux * areaM2) / (0.5 * 0.8));
      let currentLumens = 0;
      for (const pin of listAllPins(selected, products, floor.id)) {
        if (pin.placement.room === room.id && pin.product.lumens > 0) currentLumens += pin.product.lumens;
      }
      const pct = requiredLumens > 0 ? Math.round((currentLumens / requiredLumens) * 100) : 0;
      lightingRows.push({ floorName: floor.name, roomName: room.name, areaM2, requiredLux: room.requiredLux, requiredLumens, currentLumens, pct, isOk: currentLumens >= requiredLumens });
    }
  }

  // ---- schematicky navrh
  const schematicSummary = (designElements.length > 0 || mountingGroups.length > 0)
    ? buildSchematicSummary({
        designElements, elementTypes, assignments: productAssignments, mountingGroups, designSeriesLinks,
        products, productKindMap,
        rooms: D.allRooms.map(r => ({ id: r.id, name: r.name, points: [] })),
        floors,
      })
    : null;

  // ---- vytapeni - kalkulace
  const heatingEntries: { floorName: string; roomName: string; systemName: string; areaM2: number; lines: ReturnType<typeof calculateHeatingMaterials>; roomTotal: number }[] = [];
  let heatingGrandTotal = 0;
  for (const floor of floors) {
    for (const room of (floor.rooms ?? []).filter(r => r.heatingSystemId)) {
      const sys = heatingSystems.find(s => s.system.id === room.heatingSystemId);
      if (!sys || !floor.scale) continue;
      const areaM2 = polygonAreaM2(room.points, floor.scale);
      const doorWidths = ((room.doors ?? []) as { widthM: number }[]).reduce((s, d) => s + d.widthM, 0);
      const lines = calculateHeatingMaterials(sys, room.heatingConfig ?? {}, areaM2, Math.max(0, polygonPerimeterM(room.points, floor.scale) - doorWidths));
      const roomTotal = lines.reduce((s, l) => s + l.totalPrice, 0);
      heatingGrandTotal += roomTotal;
      heatingEntries.push({ floorName: floor.name, roomName: room.name, systemName: sys.system.name, areaM2, lines, roomTotal });
    }
  }

  const planFloors = floors.filter(f => f.floorplanImg && floorEnabled(f.id) && planImages[f.id]);

  const tradePages = ALL_TRADES.filter(trade => {
    if (!tradeEnabled(trade)) return false;
    const tradeCircuits = floors.flatMap(f => (f.circuits ?? []).filter(c => (c.type ?? 'electric') === trade));
    const tradePins = floors.flatMap(f => listAllPins(selected, products, f.id).filter(pin => (pin.product.trade || 'electric') === trade));
    return tradeCircuits.length > 0 || tradePins.length > 0;
  });

  const pName = projectName || 'Projekt';

  return (
    <Document title={`Souhrn projektu - ${pName}`} author="HouseSmart" language="cs">
      {/* ------------------------------------------------ prehledove stranky */}
      <Page size="A4" style={{ ...PAGE_PAD, fontFamily: 'Roboto', fontSize: P(10), color: C.ink }}>
        <Footer projectName={pName} />

        <Svg width={595.28 - 52} height={P(4)} style={{ marginBottom: P(18) }}>
          <Defs>
            <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#0f172a" />
              <Stop offset="0.4" stopColor="#1e40af" />
              <Stop offset="0.7" stopColor="#3b82f6" />
              <Stop offset="1" stopColor="#93c5fd" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={595.28 - 52} height={P(4)} fill="url(#brand)" />
        </Svg>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: P(18), paddingBottom: P(14), borderBottomWidth: 0.75, borderBottomColor: C.border }}>
          <View>
            <Text style={{ fontSize: P(8), textTransform: 'uppercase', letterSpacing: 2, color: C.s500, fontWeight: 700, marginBottom: P(3) }}>Souhrn projektu</Text>
            <Text style={{ fontSize: P(20), fontWeight: 700, color: C.head }}>{pName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ marginBottom: P(4), alignItems: 'flex-end' }}>
              <Lbl>Datum</Lbl>
              <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{dateStr}</Text>
            </View>
            {clientName ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Lbl>Klient</Lbl>
                <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{clientName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: P(8), marginBottom: P(10) }}>
          {[
            { lbl: 'Produktů', val: String(D.selectedProducts.length) },
            { lbl: 'Umístěno', val: String(D.totalPlacedCount) },
            ...(fvActive ? [{ lbl: 'FV systém', val: `${fvSummary!.totalKwp} kWp` }] : []),
            ...(cameraActive ? [{ lbl: 'Kamery', val: `${cameraSummary!.cameraCount} ks` }] : []),
            ...(epsActive ? [{ lbl: 'EPS detektory', val: `${epsSummary!.detectorCount} ks` }] : []),
            ...(totalPrices ? [{ lbl: 'Cena celkem', val: combinedGrandTotal > 0 ? `${fmt(combinedGrandTotal)} Kč` : '—' }] : []),
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, borderWidth: 0.75, borderColor: C.border, borderRadius: P(6), paddingVertical: P(8), paddingHorizontal: P(10), backgroundColor: '#fafbfc' }}>
              <Lbl>{s.lbl}</Lbl>
              <Text style={{ fontSize: P(13), fontWeight: 700, color: C.head }}>{s.val}</Text>
            </View>
          ))}
        </View>

        {/* ---- produkty podle kategorii */}
        {show('products') && D.groupedByCat.map(({ cat, items }) => {
          const pc = getPrintColor(cat.pill_color ?? '');
          const catQty = items.reduce((s, p) => s + D.qtyOf(p.id), 0);
          return (
            <Section key={cat.id}>
              <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', gap: P(8), paddingVertical: P(8), paddingHorizontal: P(10), backgroundColor: pc.bg, borderBottomWidth: 1.5, borderBottomColor: pc.border }}>
                <View style={{ width: P(22), height: P(22), borderRadius: P(5), backgroundColor: pc.dot, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: P(9), fontWeight: 700 }}>{items.length}</Text>
                </View>
                <Text style={{ fontWeight: 700, fontSize: P(11), color: pc.text }}>{cat.name}</Text>
                <Text style={{ fontSize: P(9), color: C.s500, marginLeft: 'auto' }}>{catQty} ks</Text>
              </View>
              {items.map((p, idx) => {
                const qty = D.qtyOf(p.id);
                const total = p.price * qty;
                const placements = selected[p.id]?.placements ?? [];
                const configCounts: Record<string, { frameSize: number; modules: string[]; colorName?: string; count: number }> = {};
                for (const pl of placements) {
                  if (pl.config) {
                    const key = JSON.stringify({ frameSize: pl.config.frameSize, modules: pl.config.modules, colorName: pl.config.colorName });
                    if (!configCounts[key]) configCounts[key] = { ...pl.config, count: 0 };
                    configCounts[key].count++;
                  }
                }
                const cfgEntries = Object.values(configCounts);
                const pm = productModulesMap?.[p.id];
                const getModPrice = (n: string) => {
                  if (pm && pm.length > 0) return pm.find(e => e.module.name === n)?.price ?? 0;
                  return designModules.find(m => m.name === n)?.price ?? 0;
                };
                const totalModulesPrice = cfgEntries.reduce((s, c) => s + c.count * c.modules.reduce((ms, m) => ms + getModPrice(m), 0), 0);

                const colorCounts: Record<string, { count: number; hex: string }> = {};
                if (cfgEntries.length === 0) {
                  for (const pl of placements) {
                    const plAny = pl as unknown as { colorName?: string; colorHex?: string };
                    const cn = pl.config?.colorName ?? plAny.colorName;
                    if (cn) {
                      if (!colorCounts[cn]) colorCounts[cn] = { count: 0, hex: pl.config?.colorHex ?? plAny.colorHex ?? '#ccc' };
                      colorCounts[cn].count++;
                    }
                  }
                }
                return (
                  <View key={p.id} wrap={false} style={{ flexDirection: 'row', paddingVertical: P(6), paddingHorizontal: P(10), borderBottomWidth: idx === items.length - 1 ? 0 : 0.75, borderBottomColor: C.borderSoft }}>
                    <View style={{ flex: 4 }}>
                      <Text style={{ fontWeight: 700, fontSize: P(10) }}>{p.name}</Text>
                      <Text style={{ fontSize: P(8), color: C.s400 }}>{p.brand} {p.code}</Text>
                      {cfgEntries.map((c2, ci) => {
                        const cfgPrice = c2.modules.reduce((s, m) => s + getModPrice(m), 0);
                        return (
                          <Text key={ci} style={{ fontSize: P(8), color: C.s600, marginTop: P(1) }}>
                            {c2.count}x {c2.frameSize}R: {c2.modules.join(' + ')}{c2.colorName ? ` | ${c2.colorName}` : ''}{rowPrices && cfgPrice > 0 ? ` — ${fmt(cfgPrice * c2.count)} Kč` : ''}
                          </Text>
                        );
                      })}
                      {rowPrices && totalModulesPrice > 0 ? (
                        <Text style={{ fontSize: P(8), fontWeight: 700, color: '#1d4ed8', marginTop: P(2) }}>Vložky celkem: {fmt(totalModulesPrice)} Kč</Text>
                      ) : null}
                      {Object.keys(colorCounts).length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: P(6), marginTop: P(2) }}>
                          {Object.entries(colorCounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, cc]) => (
                            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.soft, borderWidth: 0.75, borderColor: C.border, borderRadius: P(4), paddingHorizontal: P(5), paddingVertical: P(1) }}>
                              <Dot color={cc.hex} size={6} />
                              <Text style={{ fontSize: P(8), fontWeight: 700, color: C.s600 }}>{cc.count}x {name}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, justifyContent: 'flex-start' }}>
                      <Text style={{ fontSize: P(10), textAlign: 'right', color: C.s600 }}>{qty} ks</Text>
                    </View>
                    {rowPrices ? (
                      <View style={{ flex: 1.4, justifyContent: 'flex-start' }}>
                        <Text style={{ fontSize: P(10), textAlign: 'right', fontWeight: 700, color: C.blue600 }}>{total > 0 ? `${fmt(total)} Kč` : ''}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Section>
          );
        })}

        {/* ---- rozlozeni podle mistnosti */}
        {show('rooms') && D.allRooms.length > 0 && Object.keys(roomProductMap).length > 0 ? (
          <>
            <H2 dot="#14b8a6">Rozložení podle místností</H2>
            {[...D.allRooms.map(r => r.name), 'Nezařazeno'].map(rName => {
              const items = roomProductMap[rName];
              if (!items || items.length === 0) return null;
              const totalItems = items.reduce((s, i) => s + i.count, 0);
              const isNone = rName === 'Nezařazeno';
              return (
                <Section key={rName}>
                  <View style={{ flexDirection: 'row', paddingVertical: P(6), paddingHorizontal: P(10), backgroundColor: isNone ? C.soft : '#f0fdfa' }}>
                    <Text style={{ fontWeight: 700, fontSize: P(10), color: isNone ? C.s500 : '#115e59' }}>{rName}</Text>
                    <Text style={{ fontSize: P(9), color: C.s500, marginLeft: 'auto' }}>{totalItems} ks</Text>
                  </View>
                  {items.map((rp, i) => (
                    <View key={i} wrap={false} style={{ flexDirection: 'row', paddingVertical: P(4), paddingHorizontal: P(10), borderBottomWidth: i === items.length - 1 ? 0 : 0.75, borderBottomColor: C.borderSoft }}>
                      <Text style={{ fontSize: P(9.5), fontWeight: 500 }}>{rp.product.name}</Text>
                      <Text style={{ fontSize: P(8), color: C.s400, marginLeft: P(5) }}>{rp.product.code}</Text>
                      {rp.colorCounts ? (
                        <Text style={{ fontSize: P(7.5), color: C.s500, marginLeft: P(6) }}>
                          {Object.entries(rp.colorCounts).sort(([a], [b]) => a.localeCompare(b)).map(([cn, cc]) => `${cc.count}x ${cn}`).join(' · ')}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: P(9.5), fontWeight: 700, marginLeft: 'auto' }}>{rp.count} ks</Text>
                    </View>
                  ))}
                </Section>
              );
            })}
          </>
        ) : null}

        {/* ---- trasy a kabely */}
        {show('cables') && cablesByFloor.length > 0 ? (
          <>
            <H2>Trasy a kabely</H2>
            {cablesByFloor.map(({ floor, circuits }) => (
              <Section key={floor.id}>
                <View style={{ paddingVertical: P(6), paddingHorizontal: P(10), backgroundColor: C.soft }}>
                  <Text style={{ fontWeight: 700, fontSize: P(10), color: C.head }}>{floor.name}</Text>
                </View>
                {circuits.map(({ circuit, cables }, ci) => (
                  <View key={circuit.id} wrap={false} style={{ paddingVertical: P(6), paddingHorizontal: P(10), borderBottomWidth: ci === circuits.length - 1 ? 0 : 0.75, borderBottomColor: C.borderSoft }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: P(3) }}>
                      <Dot color={circuit.color} size={8} />
                      <Text style={{ fontWeight: 700, fontSize: P(10) }}>{circuit.name}</Text>
                      <Text style={{ fontSize: P(9), color: C.s500, marginLeft: P(6) }}>
                        {CIRCUIT_TYPE_LABELS[circuit.type as keyof typeof CIRCUIT_TYPE_LABELS]?.label ?? circuit.type}
                      </Text>
                    </View>
                    {cables.map(({ cable, lengthM }, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginLeft: P(16) }}>
                        <Text style={{ fontSize: P(9), color: C.s600 }}>{cable.materialName || 'Nezadaný materiál'}</Text>
                        <Text style={{ fontSize: P(9), fontWeight: 500, color: C.s600 }}>{lengthM.toFixed(1)} m</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </Section>
            ))}
          </>
        ) : null}

        {/* ---- material */}
        {show('materials') && D.materialWithWaste.length > 0 ? (
          <>
            <H2>Materiál</H2>
            <Section>
              <Row header cells={[
                { t: 'Název', flex: 2.4 }, { t: 'Délka surová', align: 'right' }, { t: 'Odpady %', align: 'right' },
                { t: 'Délka upravená', align: 'right' },
                ...(rowPrices ? [{ t: 'Cena/j.', align: 'right' } as Cell, { t: 'Celkem', align: 'right' } as Cell] : []),
              ]} />
              {D.materialWithWaste.map((mat, i) => (
                <Row key={mat.name} cells={[
                  { t: mat.name, flex: 2.4, bold: true },
                  { t: `${mat.rawLength.toFixed(1)} ${mat.unit}`, align: 'right' },
                  { t: `${mat.waste}%`, align: 'right' },
                  { t: `${mat.adjustedLength.toFixed(1)} ${mat.unit}`, align: 'right', bold: true },
                  ...(rowPrices ? [
                    { t: `${fmt(mat.pricePerUnit)} Kč`, align: 'right' } as Cell,
                    { t: `${fmt(mat.totalPrice)} Kč`, align: 'right', color: C.blue600, bold: true } as Cell,
                  ] : []),
                ]} last={!totalPrices && i === D.materialWithWaste.length - 1} />
              ))}
              {totalPrices ? (
                <Row bg={C.soft} last cells={[
                  { t: 'Celkem materiál', flex: rowPrices ? 6.4 : 5.4, bold: true },
                  { t: `${fmt(D.totalMaterialPrice)} Kč`, align: 'right', color: C.blue600, bold: true },
                ]} />
              ) : null}
            </Section>
          </>
        ) : null}

        {/* ---- tvarovky */}
        {show('fittings') && Object.keys(bendCounts).length > 0 ? (
          <>
            <H2>Tvarovky</H2>
            <Section>
              <Row header cells={[
                { t: 'Materiál', flex: 2.4 },
                ...STANDARD_BEND_ANGLES.map(a => ({ t: `${a}°`, align: 'right' } as Cell)),
                { t: 'T-kusy', align: 'right' },
              ]} />
              {Object.entries(bendCounts).map(([matName, bends], i, arr) => (
                <Row key={matName} last={i === arr.length - 1} cells={[
                  { t: matName, flex: 2.4, bold: true },
                  ...STANDARD_BEND_ANGLES.map(a => ({ t: String(bends[a] || 0), align: 'right' } as Cell)),
                  { t: String(tPieceCounts[matName] || 0), align: 'right' },
                ]} />
              ))}
            </Section>
          </>
        ) : null}

        {/* ---- jisteni */}
        {show('breakers') && breakerTotals.length > 0 ? (
          <>
            <H2>Jištění</H2>
            <Section>
              <Row header cells={[{ t: 'Proud' }, { t: 'Póly', align: 'center' }, { t: 'Křivka', align: 'center' }, { t: 'Množství', align: 'right' }]} />
              {breakerTotals.map((b, i) => (
                <Row key={i} last={i === breakerTotals.length - 1} cells={[
                  { t: `${b.amperage}A`, bold: true }, { t: String(b.poles), align: 'center' },
                  { t: b.curve, align: 'center' }, { t: `${b.count} ks`, align: 'right' },
                ]} />
              ))}
            </Section>
          </>
        ) : null}

        {/* ---- rekuperace */}
        {show('ventilation') && ventRows.length > 0 ? (
          <>
            <H2 dot="#10b981">Rekuperace</H2>
            <Section>
              <View wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.border }}>
                <View style={{ flex: 1, paddingVertical: P(8), paddingHorizontal: P(12), backgroundColor: '#eff6ff' }}>
                  <Lbl color="#3b82f6">Přívod</Lbl>
                  <Text style={{ fontSize: P(14), fontWeight: 700, color: '#1d4ed8' }}>{Math.round(ventTotalSupply)} m³/h</Text>
                  <Text style={{ fontSize: P(9), fontWeight: 700, color: C.blue600 }}>{ventTotalSupplyVents} výústek</Text>
                </View>
                <View style={{ flex: 1, paddingVertical: P(8), paddingHorizontal: P(12), backgroundColor: '#fffbeb', borderLeftWidth: 0.75, borderLeftColor: C.border }}>
                  <Lbl color="#d97706">Odvod</Lbl>
                  <Text style={{ fontSize: P(14), fontWeight: 700, color: C.amber }}>{Math.round(ventTotalExhaust)} m³/h</Text>
                  <Text style={{ fontSize: P(9), fontWeight: 700, color: '#d97706' }}>{ventTotalExhaustVents} výústek</Text>
                </View>
              </View>
              <Row header cells={[
                { t: 'Místnost', flex: 2 }, { t: 'Plocha', align: 'right' }, { t: 'm³/h', align: 'right' },
                { t: 'Typ', align: 'center', flex: 1.4 }, { t: 'Přívod', align: 'right' }, { t: 'Odvod', align: 'right' },
              ]} />
              {ventRows.map((row, i) => (
                <Row key={i} last={i === ventRows.length - 1} cells={[
                  { t: <><Text style={{ fontWeight: 700 }}>{row.roomName}</Text><Text style={{ fontSize: P(8), color: C.s400 }}>  {row.floorName}</Text></>, flex: 2 },
                  { t: `${row.areaM2.toFixed(1)} m²`, align: 'right' },
                  { t: String(Math.round(row.airFlow)), align: 'right', bold: true, color: '#059669' },
                  { t: row.mode, align: 'center', flex: 1.4, size: 8, color: row.mode === 'Přívod' ? C.blue600 : row.mode === 'Odvod' ? '#d97706' : '#059669', bold: true },
                  { t: row.supplyVents > 0 ? String(row.supplyVents) : '—', align: 'right', bold: true, color: C.blue600 },
                  { t: row.exhaustVents > 0 ? String(row.exhaustVents) : '—', align: 'right', bold: true, color: '#d97706' },
                ]} />
              ))}
            </Section>
          </>
        ) : null}

        {/* ---- osvetleni */}
        {show('lighting') && lightingRows.length > 0 ? (
          <>
            <H2 dot="#f59e0b">Osvětlení</H2>
            <Section>
              <Row header cells={[
                { t: 'Místnost', flex: 2 }, { t: 'Plocha', align: 'right' }, { t: 'Lux', align: 'right' },
                { t: 'Potřeba (lm)', align: 'right' }, { t: 'Aktuálně (lm)', align: 'right' }, { t: 'Stav', align: 'right' },
              ]} />
              {lightingRows.map((row, i) => (
                <Row key={i} last={i === lightingRows.length - 1} cells={[
                  { t: <><Text style={{ fontWeight: 700 }}>{row.roomName}</Text><Text style={{ fontSize: P(8), color: C.s400 }}>  {row.floorName}</Text></>, flex: 2 },
                  { t: `${row.areaM2.toFixed(1)} m²`, align: 'right' },
                  { t: String(row.requiredLux), align: 'right' },
                  { t: fmtRound(row.requiredLumens), align: 'right', bold: true, color: C.amber },
                  { t: fmtRound(row.currentLumens), align: 'right', bold: true },
                  { t: row.isOk ? 'OK' : `${row.pct}%`, align: 'right', bold: true, color: row.isOk ? '#059669' : '#dc2626' },
                ]} />
              ))}
            </Section>
          </>
        ) : null}

        {/* ---- fotovoltaika */}
        {show('fv_system') && fvActive ? (
          <>
            <H2 dot="#f97316">Fotovoltaický systém</H2>
            <Section>
              <View wrap={false} style={{ flexDirection: 'row', gap: P(8), padding: P(10), backgroundColor: '#fff7ed', borderBottomWidth: 0.75, borderBottomColor: '#fed7aa' }}>
                <View style={{ flex: 1 }}>
                  <Lbl color="#ea580c">Výkon</Lbl>
                  <Text style={{ fontSize: P(14), fontWeight: 700, color: C.head }}>{fvSummary!.totalKwp} kWp</Text>
                  <Text style={{ fontSize: P(9), color: C.s500 }}>{fvSummary!.panelCount} panelů</Text>
                </View>
                {fvSummary!.inverterName ? (
                  <View style={{ flex: 1 }}>
                    <Lbl color="#ea580c">Střídač</Lbl>
                    <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{fvSummary!.inverterName}</Text>
                    <Text style={{ fontSize: P(9), color: C.s500 }}>{fvSummary!.inverterKw} kW</Text>
                  </View>
                ) : null}
                {fvSummary!.batteryKwh > 0 ? (
                  <View style={{ flex: 1 }}>
                    <Lbl color="#ea580c">Baterie</Lbl>
                    <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{fvSummary!.batteryName}</Text>
                    <Text style={{ fontSize: P(9), color: C.s500 }}>{fvSummary!.batteryKwh} kWh ({fvSummary!.batteryCount}x)</Text>
                  </View>
                ) : null}
                {fvSummary!.wallboxName ? (
                  <View style={{ flex: 1 }}>
                    <Lbl color="#ea580c">Wallbox</Lbl>
                    <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{fvSummary!.wallboxName}</Text>
                    <Text style={{ fontSize: P(9), color: C.s500 }}>{fvSummary!.wallboxKw} kW</Text>
                  </View>
                ) : null}
              </View>
              {fvSummary!.roofs.length > 0 ? (
                <>
                  <Row header cells={[
                    { t: 'Střešní plocha', flex: 2 }, { t: 'Panelů', align: 'right' }, { t: 'kWp', align: 'right' },
                    { t: 'Azimut', align: 'right' }, { t: 'Sklon', align: 'right' },
                  ]} />
                  {fvSummary!.roofs.map((r, i) => (
                    <Row key={i} cells={[
                      { t: r.name, flex: 2, bold: true }, { t: String(r.panelCount), align: 'right' },
                      { t: r.kwp.toFixed(2), align: 'right', bold: true, color: '#ea580c' },
                      { t: `${r.azimuth}°`, align: 'right' }, { t: `${r.tilt}°`, align: 'right' },
                    ]} />
                  ))}
                </>
              ) : null}
              {[...fvSummary!.accessories.map(a => ({ name: a.name, qty: `${a.qty} ks`, price: a.price })),
                ...fvSummary!.customItems.map(ci => ({ name: ci.name, qty: `${ci.qty} ${ci.unit}`, price: ci.qty * ci.unitPrice }))].map((a, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: P(5), paddingHorizontal: P(10), borderBottomWidth: 0.75, borderBottomColor: C.borderSoft }}>
                  <Text style={{ fontSize: P(9.5), fontWeight: 500 }}>{a.name}</Text>
                  <Text style={{ fontSize: P(9.5), color: C.s500 }}>{a.qty}{rowPrices ? <Text style={{ fontWeight: 700, color: '#ea580c' }}>   {fmt(a.price)} Kč</Text> : null}</Text>
                </View>
              ))}
              {totalPrices && fvSummary!.totalInvestment > 0 ? (
                <View wrap={false} style={{ backgroundColor: '#fff7ed', borderTopWidth: 1.5, borderTopColor: '#fdba74', paddingVertical: P(8), paddingHorizontal: P(10) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: P(3) }}>
                    <Text style={{ fontSize: P(10), color: '#78350f' }}>Celková investice</Text>
                    <Text style={{ fontSize: P(10), fontWeight: 700, color: C.head }}>{fmt(fvSummary!.totalInvestment)} Kč</Text>
                  </View>
                  {fvSummary!.subsidy > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: P(3) }}>
                        <Text style={{ fontSize: P(10), color: '#059669' }}>Dotace</Text>
                        <Text style={{ fontSize: P(10), fontWeight: 700, color: '#059669' }}>-{fmt(fvSummary!.subsidy)} Kč</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: P(11), fontWeight: 700, color: '#78350f' }}>Po odečtení dotace</Text>
                        <Text style={{ fontSize: P(11), fontWeight: 700, color: '#ea580c' }}>{fmt(fvSummary!.totalInvestment - fvSummary!.subsidy)} Kč</Text>
                      </View>
                    </>
                  ) : null}
                  {fvSummary!.annualProduction > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: P(3) }}>
                      <Text style={{ fontSize: P(10), color: '#78350f' }}>Roční výroba</Text>
                      <Text style={{ fontSize: P(10), fontWeight: 700, color: C.head }}>{fmtRound(fvSummary!.annualProduction)} kWh</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Section>
          </>
        ) : null}

        {/* ---- kamerovy system */}
        {show('camera_system') && cameraActive ? (
          <>
            <H2 dot="#0ea5e9">Kamerový systém</H2>
            <Section>
              <View wrap={false} style={{ flexDirection: 'row', gap: P(8), padding: P(10), backgroundColor: '#f0f9ff', borderBottomWidth: 0.75, borderBottomColor: '#bae6fd' }}>
                <View style={{ flex: 1 }}>
                  <Lbl color="#0284c7">Kamery</Lbl>
                  <Text style={{ fontSize: P(14), fontWeight: 700, color: C.head }}>{cameraSummary!.cameraCount}</Text>
                </View>
                {cameraSummary!.nvrs.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <Lbl color="#0284c7">NVR</Lbl>
                    <Text style={{ fontSize: P(14), fontWeight: 700, color: C.head }}>{cameraSummary!.nvrs.length}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Lbl color="#0284c7">Záznam</Lbl>
                  <Text style={{ fontSize: P(11), fontWeight: 700, color: C.head }}>{cameraSummary!.storageConfig.codec.toUpperCase()}</Text>
                  <Text style={{ fontSize: P(9), color: C.s500 }}>{cameraSummary!.storageConfig.retentionDays} dní</Text>
                </View>
              </View>
              {cameraSummary!.cameras.length > 0 ? (
                <>
                  <Row header cells={[{ t: 'Kamera', flex: 3 }, { t: 'Ks', align: 'right' }, ...(rowPrices ? [{ t: 'Cena', align: 'right' } as Cell] : [])]} />
                  {cameraSummary!.cameras.map((cam, i) => (
                    <Row key={i} cells={[
                      { t: cam.modelName, flex: 3, bold: true }, { t: String(cam.count), align: 'right' },
                      ...(rowPrices ? [{ t: `${fmt(cam.price)} Kč`, align: 'right', bold: true, color: '#0284c7' } as Cell] : []),
                    ]} />
                  ))}
                </>
              ) : null}
              {[...cameraSummary!.nvrs.map(n => ({ name: `NVR: ${n.name}`, qty: n.count, price: n.price })),
                ...cameraSummary!.switches.map(s2 => ({ name: `Switch: ${s2.name}`, qty: s2.count, price: s2.price })),
                ...cameraSummary!.accessories.map(a => ({ name: a.name, qty: a.qty, price: a.price }))].map((a, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: P(5), paddingHorizontal: P(10), borderBottomWidth: 0.75, borderBottomColor: C.borderSoft }}>
                  <Text style={{ fontSize: P(9.5), fontWeight: 500 }}>{a.name}</Text>
                  <Text style={{ fontSize: P(9.5), color: C.s500 }}>{a.qty} ks{rowPrices ? <Text style={{ fontWeight: 700, color: '#0284c7' }}>   {fmt(a.price)} Kč</Text> : null}</Text>
                </View>
              ))}
              {totalPrices ? (
                <View wrap={false} style={{ backgroundColor: '#f0f9ff', borderTopWidth: 1.5, borderTopColor: '#7dd3fc', paddingVertical: P(8), paddingHorizontal: P(10), flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 700, color: '#075985', fontSize: P(10) }}>Celkem kamery</Text>
                  <Text style={{ fontWeight: 700, color: '#0284c7', fontSize: P(12) }}>{fmt(cameraSummary!.totalPrice)} Kč</Text>
                </View>
              ) : null}
            </Section>
          </>
        ) : null}

        {/* ---- celkovy souhrn */}
        {totalPrices ? (
          <TotalBox
            rows={[
              ...(D.grandTotal > 0 ? [{ label: floorplanLabel || 'Půdorysný návrhář (produkty + materiál)', value: `${fmt(D.grandTotal)} Kč` }] : []),
              ...(fvTotalPrice > 0 ? [{ label: 'Fotovoltaika', value: `${fmt(fvTotalPrice)} Kč`, color: '#ea580c' }] : []),
              ...(cameraTotalPrice > 0 ? [{ label: 'Kamerový systém', value: `${fmt(cameraTotalPrice)} Kč`, color: '#0284c7' }] : []),
              ...(epsTotalPrice > 0 ? [{ label: 'EPS / EZS', value: `${fmt(epsTotalPrice)} Kč`, color: '#dc2626' }] : []),
            ]}
            grand={{ label: 'Celkem', value: `${fmt(combinedGrandTotal)} Kč` }}
          />
        ) : null}

        {/* ---- schematicky navrh */}
        {show('schematic') && schematicSummary ? (
          <>
            <H2 dot="#6366f1">Schematický návrh</H2>
            <Section>
              <View wrap={false} style={{ flexDirection: 'row', gap: P(8), padding: P(10), backgroundColor: C.soft, borderBottomWidth: 0.75, borderBottomColor: C.border }}>
                {[
                  { lbl: 'Prvků', val: String(schematicSummary.stats.totalElements), color: C.head },
                  { lbl: 'Přiřazeno', val: String(schematicSummary.stats.assignedElements), color: '#10b981' },
                  ...(schematicSummary.stats.unassignedElements > 0 ? [{ lbl: 'Nepřiřazeno', val: String(schematicSummary.stats.unassignedElements), color: '#ef4444' }] : []),
                  { lbl: 'Vícerámečky', val: String(schematicSummary.stats.totalGroups), color: '#8b5cf6' },
                  ...(schematicSummary.stats.totalFrames > 0 ? [{ lbl: 'Rámečků', val: String(schematicSummary.stats.totalFrames), color: '#14b8a6' }] : []),
                ].map((s2, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Lbl>{s2.lbl}</Lbl>
                    <Text style={{ fontSize: P(14), fontWeight: 700, color: s2.color }}>{s2.val}</Text>
                  </View>
                ))}
              </View>

              {schematicSummary.warnings.filter(w => w.severity !== 'info').length > 0 ? (
                <View wrap={false} style={{ backgroundColor: '#fef3c7', borderBottomWidth: 0.75, borderBottomColor: '#fcd34d', paddingVertical: P(8), paddingHorizontal: P(10) }}>
                  <Lbl color="#92400e">Upozornění</Lbl>
                  {schematicSummary.warnings.filter(w => w.severity !== 'info').slice(0, 5).map((w, i) => (
                    <Text key={i} style={{ fontSize: P(9), color: C.amber }}>{w.message}</Text>
                  ))}
                </View>
              ) : null}

              {schematicSummary.aggregatedRows.length > 0 ? (
                <>
                  <View style={{ paddingVertical: P(6), paddingHorizontal: P(10) }}>
                    <Lbl color="#6366f1">Schematické prvky a přiřazené produkty</Lbl>
                  </View>
                  <Row header cells={[
                    { t: 'Typ prvku', flex: 2 }, { t: 'Přiřazený produkt', flex: 2.4 }, { t: 'Počet', align: 'right', flex: 0.8 },
                    ...(rowPrices ? [{ t: 'Cena / ks', align: 'right' } as Cell, { t: 'Celkem', align: 'right' } as Cell] : []),
                  ]} />
                  {schematicSummary.aggregatedRows.map((row, i) => {
                    const isAssigned = !!row.productId;
                    const roomBreak = row.roomBreakdown.length > 1
                      ? row.roomBreakdown.map(rb => `${rb.roomName || 'Nezařazeno'}: ${rb.count}`).join(' · ')
                      : '';
                    return (
                      <Row key={i} bg={isAssigned ? undefined : '#fff5f5'} cells={[
                        { t: <><Text style={{ fontWeight: 700 }}>{row.elementTypeName}</Text>{roomBreak ? <Text style={{ fontSize: P(8), color: C.s400 }}>{'\n'}{roomBreak}</Text> : null}</>, flex: 2 },
                        { t: isAssigned ? `${row.productName ?? ''}${row.productCode ? ` (${row.productCode})` : ''}` : 'Nepřiřazeno', flex: 2.4, color: isAssigned ? C.ink : '#ef4444', bold: !isAssigned },
                        { t: String(row.quantity), align: 'right', flex: 0.8 },
                        ...(rowPrices ? [
                          { t: isAssigned ? `${fmt(row.productPrice)} Kč` : '—', align: 'right' } as Cell,
                          { t: isAssigned ? `${fmt(row.productPrice * row.quantity)} Kč` : '—', align: 'right', color: C.blue600, bold: true } as Cell,
                        ] : []),
                      ]} />
                    );
                  })}
                </>
              ) : null}

              {schematicSummary.frameRows.length > 0 ? (
                <>
                  <View style={{ paddingVertical: P(6), paddingHorizontal: P(10), borderTopWidth: 0.75, borderTopColor: C.border }}>
                    <Lbl color="#14b8a6">Automaticky generované rámečky</Lbl>
                  </View>
                  <Row header cells={[
                    { t: 'Rámeček', flex: 2 }, { t: 'Řada', flex: 1.6 }, { t: 'Počet', align: 'right', flex: 0.8 },
                    ...(rowPrices ? [{ t: 'Cena / ks', align: 'right' } as Cell, { t: 'Celkem', align: 'right' } as Cell] : []),
                  ]} />
                  {schematicSummary.frameRows.map((frame, i) => {
                    const orientLabel = frame.frameSize > 1 ? (frame.orientation === 'horizontal' ? ' H' : ' V') : '';
                    const frameName = frame.targetProductName || `${frame.frameSize}R${orientLabel}${frame.colorName ? ` - ${frame.colorName}` : ''}`;
                    return (
                      <Row key={i} cells={[
                        { t: `${frameName}${!frame.hasMapping && frame.frameSize > 1 ? ' (fallback)' : ''}`, flex: 2, bold: true },
                        { t: frame.designSeriesName, flex: 1.6, color: C.s500 },
                        { t: String(frame.quantity), align: 'right', flex: 0.8 },
                        ...(rowPrices ? [
                          { t: `${fmt(frame.unitPrice)} Kč`, align: 'right' } as Cell,
                          { t: `${fmt(frame.unitPrice * frame.quantity)} Kč`, align: 'right', color: C.blue600, bold: true } as Cell,
                        ] : []),
                      ]} />
                    );
                  })}
                </>
              ) : null}

              {schematicSummary.moduleRows.length > 0 ? (
                <>
                  <View style={{ paddingVertical: P(6), paddingHorizontal: P(10), borderTopWidth: 0.75, borderTopColor: C.border }}>
                    <Lbl color="#3b82f6">Moduly vícerámečků</Lbl>
                  </View>
                  <Row header cells={[
                    { t: 'Modul', flex: 2 }, { t: 'Řada', flex: 1.6 }, { t: 'Počet', align: 'right', flex: 0.8 },
                    ...(rowPrices ? [{ t: 'Cena / ks', align: 'right' } as Cell, { t: 'Celkem', align: 'right' } as Cell] : []),
                  ]} />
                  {schematicSummary.moduleRows.map((mod, i) => (
                    <Row key={i} cells={[
                      { t: `${mod.productName || mod.moduleName}${!mod.productId ? ' (bez mapování)' : ''}`, flex: 2, bold: true },
                      { t: mod.designSeriesName, flex: 1.6, color: C.s500 },
                      { t: String(mod.quantity), align: 'right', flex: 0.8 },
                      ...(rowPrices ? [
                        { t: mod.productId ? `${fmt(mod.unitPrice)} Kč` : '—', align: 'right' } as Cell,
                        { t: mod.productId ? `${fmt(mod.unitPrice * mod.quantity)} Kč` : '—', align: 'right', color: C.blue600, bold: true } as Cell,
                      ] : []),
                    ]} />
                  ))}
                </>
              ) : null}

              {mountingGroups.length > 0 ? (
                <>
                  <View style={{ paddingVertical: P(6), paddingHorizontal: P(10), borderTopWidth: 0.75, borderTopColor: C.border }}>
                    <Lbl color="#8b5cf6">Detail vícerámečků ({mountingGroups.length})</Lbl>
                  </View>
                  <Row header cells={[
                    { t: 'Označení', flex: 1.4 }, { t: 'Velikost', align: 'right', flex: 0.8 }, { t: 'Orientace', flex: 1 },
                    { t: 'Řada', flex: 1.8 }, { t: 'Slotů', align: 'right', flex: 0.7 }, { t: 'Místnost', flex: 1.4 },
                  ]} />
                  {mountingGroups.map((mg, i) => {
                    const slotCount = mg.slots.filter(s2 => s2.element_id || s2.module_name).length;
                    const seriesProduct = mg.design_series_id ? products.find(p => p.id === mg.design_series_id) : null;
                    return (
                      <Row key={mg.id ?? i} last={i === mountingGroups.length - 1} cells={[
                        { t: mg.label || '—', flex: 1.4, bold: true },
                        { t: `${mg.frame_size}R`, align: 'right', flex: 0.8 },
                        { t: mg.orientation === 'horizontal' ? 'Vodorovně' : 'Svisle', flex: 1 },
                        { t: seriesProduct?.name || '— bez řady', flex: 1.8 },
                        { t: `${slotCount}/${mg.frame_size}`, align: 'right', flex: 0.7 },
                        { t: mg.room_id ? (D.allRooms.find(r => r.id === mg.room_id)?.name ?? '—') : '—', flex: 1.4, color: C.s500 },
                      ]} />
                    );
                  })}
                </>
              ) : null}
            </Section>
          </>
        ) : null}
      </Page>

      {/* ------------------------------------------------ pudorysy s piny */}
      {show('floorplans') && planFloors.map(floor => {
        const floorPins = listAllPins(selected, products, floor.id);
        const circuits = floor.circuits ?? [];
        return (
          <Page key={floor.id} size="A4" orientation="landscape" style={{ ...PAGE_PAD, fontFamily: 'Roboto', fontSize: P(10), color: C.ink }}>
            <Footer projectName={pName} />
            <Text style={{ fontSize: P(13), fontWeight: 700, color: C.head, marginBottom: P(8) }}>{floor.name} – Půdorys s piny</Text>
            <PlanImage plan={planImages[floor.id]} />
            <PinTable pins={floorPins} objects={floor.objects ?? []} categories={categories} circuits={circuits} roomIdToName={D.roomIdToName} products={products} includeConfig />
          </Page>
        );
      })}

      {/* ------------------------------------------------ remesla */}
      {show('trades') && tradePages.map(trade => {
        const tradeInfo = CIRCUIT_TYPE_LABELS[trade as keyof typeof CIRCUIT_TYPE_LABELS];
        const anyFloorWithScale = floors.find(f => f.scale);
        const tradeMaterialTotals: Record<string, { normalized: number; meters: number | null }> = {};
        for (const floor of floors) {
          for (const cable of floor.cables ?? []) {
            const circuit = (floor.circuits ?? []).find(c => c.id === cable.circuitId);
            if ((circuit?.type ?? 'electric') !== trade) continue;
            if (!cable.materialName) continue;
            const len = polylineLength(cable.points);
            const metersLen = floor.scale ? normalizedToMeters(len, floor.scale) : null;
            if (!tradeMaterialTotals[cable.materialName]) tradeMaterialTotals[cable.materialName] = { normalized: 0, meters: null };
            tradeMaterialTotals[cable.materialName].normalized += len;
            if (metersLen !== null) tradeMaterialTotals[cable.materialName].meters = (tradeMaterialTotals[cable.materialName].meters ?? 0) + metersLen;
          }
        }
        let tradeTotal = 0;
        const matRows = Object.entries(tradeMaterialTotals).map(([name, d2]) => {
          const lengthM = d2.meters ?? (anyFloorWithScale?.scale ? normalizedToMeters(d2.normalized, anyFloorWithScale.scale) : null);
          const waste = getWastePercent(name);
          const adjustedLength = lengthM !== null ? lengthM * (1 + waste / 100) : null;
          const pricePerM = getMaterialPrice(name);
          const lineTotal = adjustedLength !== null && pricePerM > 0 ? adjustedLength * pricePerM : 0;
          tradeTotal += lineTotal;
          const lengthStr = adjustedLength !== null ? `${adjustedLength.toFixed(1)} m` : lengthM !== null ? `${lengthM.toFixed(1)} m` : `${(d2.normalized * 100).toFixed(0)} j.`;
          return { name, lengthStr, waste, pricePerM, lineTotal };
        });

        return (
          <Page key={trade} size="A4" orientation="landscape" style={{ ...PAGE_PAD, fontFamily: 'Roboto', fontSize: P(10), color: C.ink }}>
            <Footer projectName={pName} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: P(8), paddingBottom: P(6), borderBottomWidth: 1.5, borderBottomColor: tradeInfo.color, marginBottom: P(10) }}>
              <View style={{ width: P(12), height: P(12), borderRadius: P(12), backgroundColor: tradeInfo.color }} />
              <Text style={{ fontSize: P(14), fontWeight: 700, color: C.head }}>{tradeInfo.label}</Text>
            </View>

            {floors.filter(f => floorEnabled(f.id)).map(floor => {
              const fAllCircuits = floor.circuits ?? [];
              const fCircuits = fAllCircuits.filter(c => (c.type ?? 'electric') === trade);
              const fCables = (floor.cables ?? []).filter(cable => (fAllCircuits.find(c => c.id === cable.circuitId)?.type ?? 'electric') === trade);
              const tradePins = listAllPins(selected, products, floor.id).filter(pin => (pin.product.trade || 'electric') === trade);
              if (fCircuits.length === 0 && tradePins.length === 0) return null;
              const plan = tradePlanImages[`${trade}:${floor.id}`];
              return (
                <View key={floor.id} style={{ marginBottom: P(12) }}>
                  <Text style={{ fontWeight: 700, fontSize: P(10), color: C.s700, marginBottom: P(4) }}>{floor.name}</Text>
                  {plan ? <PlanImage plan={plan} /> : null}
                  <PinTable pins={tradePins} objects={[]} categories={categories} circuits={fCircuits} roomIdToName={D.roomIdToName} products={products} includeConfig={false} />
                  {fCircuits.length > 0 ? (
                    <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: P(4), overflow: 'hidden', marginBottom: P(6) }}>
                      <Row header cells={[{ t: 'Okruh', flex: 1.6 }, { t: 'Materiál', flex: 2 }, { t: 'Délka', align: 'right' }]} />
                      {fCircuits.flatMap(circuit => {
                        const circuitCables = fCables.filter(c => c.circuitId === circuit.id);
                        return circuitCables.map((cable, idx) => {
                          const len = polylineLength(cable.points);
                          const lengthStr = floor.scale ? `${normalizedToMeters(len, floor.scale).toFixed(1)} m` : `${(len * 100).toFixed(0)} j.`;
                          return (
                            <Row key={`${circuit.id}-${idx}`} cells={[
                              { t: idx === 0 ? <><Text style={{ color: circuit.color }}>● </Text><Text style={{ fontWeight: 700 }}>{circuit.name}</Text></> : '', flex: 1.6 },
                              { t: cable.materialName || '—', flex: 2 },
                              { t: lengthStr, align: 'right', bold: true },
                            ]} />
                          );
                        });
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {matRows.length > 0 ? (
              <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: P(4), overflow: 'hidden' }}>
                <Row header cells={[
                  { t: 'Materiál', flex: 2.4 }, { t: 'Délka', align: 'right' },
                  ...(rowPrices ? [{ t: 'Kč/m', align: 'right' } as Cell, { t: 'Cena', align: 'right' } as Cell] : []),
                ]} />
                {matRows.map((m, i) => (
                  <Row key={m.name} last={!totalPrices && i === matRows.length - 1} cells={[
                    { t: m.name, flex: 2.4, bold: true },
                    { t: `${m.lengthStr}${m.waste > 0 ? ` (+${m.waste}%)` : ''}`, align: 'right', bold: true },
                    ...(rowPrices ? [
                      { t: m.pricePerM > 0 ? `${m.pricePerM} Kč` : '—', align: 'right' } as Cell,
                      { t: m.lineTotal > 0 ? `${fmtRound(m.lineTotal)} Kč` : '—', align: 'right', bold: true } as Cell,
                    ] : []),
                  ]} />
                ))}
                {totalPrices && tradeTotal > 0 ? (
                  <Row bg={C.soft} last cells={[
                    { t: `Celkem ${tradeInfo.label}`, flex: rowPrices ? 4.4 : 2.4, bold: true, align: 'right' },
                    { t: `${fmtRound(tradeTotal)} Kč`, align: 'right', bold: true },
                  ]} />
                ) : null}
              </View>
            ) : null}
          </Page>
        );
      })}

      {/* ------------------------------------------------ vytapeni - kalkulace */}
      {show('heating') && heatingEntries.length > 0 ? (
        <Page size="A4" style={{ ...PAGE_PAD, fontFamily: 'Roboto', fontSize: P(10), color: C.ink }}>
          <Footer projectName={pName} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: P(8), paddingBottom: P(6), borderBottomWidth: 1.5, borderBottomColor: '#fca5a5', marginBottom: P(10) }}>
            <View style={{ width: P(12), height: P(12), borderRadius: P(12), backgroundColor: '#ef4444' }} />
            <Text style={{ fontSize: P(14), fontWeight: 700, color: C.head }}>Vytápění – kalkulace materiálu</Text>
          </View>
          {heatingEntries.map((entry, ei) => (
            <View key={ei} style={{ marginBottom: P(10) }}>
              <View minPresenceAhead={40} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: P(6), marginBottom: P(4) }}>
                <Text style={{ fontWeight: 700, fontSize: P(10), color: '#1e293b' }}>{entry.floorName} – {entry.roomName}</Text>
                <Text style={{ fontSize: P(9), color: C.s500 }}>{entry.systemName}</Text>
                <Text style={{ fontSize: P(9), fontWeight: 700, color: C.teal }}>{entry.areaM2.toFixed(1)} m²</Text>
              </View>
              <View style={{ borderWidth: 0.75, borderColor: C.border, borderRadius: P(4), overflow: 'hidden' }}>
                <Row header cells={[
                  { t: 'Materiál', flex: 2.4 }, { t: 'Množství', align: 'right' },
                  ...(rowPrices ? [{ t: 'Kč/j.', align: 'right' } as Cell, { t: 'Cena', align: 'right' } as Cell] : []),
                ]} />
                {entry.lines.map((line, li) => (
                  <Row key={li} cells={[
                    { t: line.name, flex: 2.4 },
                    { t: `${line.quantity < 10 ? line.quantity.toFixed(1) : String(Math.ceil(line.quantity))} ${line.unit}`, align: 'right', bold: true },
                    ...(rowPrices ? [
                      { t: line.pricePerUnit > 0 ? `${line.pricePerUnit} Kč` : '—', align: 'right' } as Cell,
                      { t: line.totalPrice > 0 ? `${fmtRound(line.totalPrice)} Kč` : '—', align: 'right', bold: true } as Cell,
                    ] : []),
                  ]} />
                ))}
                {totalPrices && entry.roomTotal > 0 ? (
                  <Row bg="#fef2f2" last cells={[
                    { t: 'Celkem místnost', flex: rowPrices ? 4.4 : 2.4, bold: true, align: 'right' },
                    { t: `${fmtRound(entry.roomTotal)} Kč`, align: 'right', bold: true, color: C.red },
                  ]} />
                ) : null}
              </View>
            </View>
          ))}
          {totalPrices && heatingGrandTotal > 0 ? (
            <View wrap={false} style={{ backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca', borderRadius: P(6), paddingVertical: P(8), paddingHorizontal: P(14), flexDirection: 'row', justifyContent: 'flex-end', gap: P(6) }}>
              <Text style={{ fontWeight: 700, fontSize: P(10), color: '#1e293b' }}>Celkem vytápění: </Text>
              <Text style={{ fontWeight: 700, fontSize: P(12), color: C.red }}>{fmtRound(heatingGrandTotal)} Kč</Text>
            </View>
          ) : null}
        </Page>
      ) : null}
    </Document>
  );
}
