import type { Product, Category, Material, FloorplanSymbol, DesignModule, ProductDesignModule } from '../../types/database';
import type { SelectionState, Floor } from '../../hooks/useProjectState';
import type { FloorplanObjectData } from '../catalog/floorplan/floorplanObjects';
import { mmToNormalized, getRotatedSvgContent } from '../catalog/floorplan/floorplanObjects';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import { calculateHeatingMaterials } from '../../hooks/useHeatingSystems';
import { listAllPins, describeConfig } from '../catalog/floorplan/pinUtils';
import type { PinData } from '../catalog/floorplan/pinUtils';
import {
  polylineLength, normalizedToMeters, analyzeBends, countTPieces,
  STANDARD_BEND_ANGLES, polygonCentroid, polygonAreaM2, polygonPerimeterM,
} from '../catalog/floorplan/geometry';
import { CIRCUIT_TYPE_LABELS, ALL_TRADES } from '../catalog/floorplan/materialLibrary';
import { getPrintColor, getFloorDesignElements, getFloorMountingGroups } from '../catalog/summary/summaryUtils';
import { generateHeatingPipes, pipeSpacingToNorm } from '../catalog/floorplan/heatingPipeGenerator';
import { renderPinIconSvgPath, getCustomIconLetter } from '../catalog/floorplan/iconLibrary';
import type { PipePattern } from '../catalog/floorplan/heatingPipeGenerator';
import type { ProjectDesignElement, DesignElementType, ProductAssignment, DesignSeriesProductLink } from '../../types/designElements';
import type { MountingGroupWithSlots } from '../../hooks/useMountingGroups';
import type { ResolvedAssignment } from '../../lib/assignmentResolver';
import { buildSchematicSummary, type SchematicSummaryOutput } from '../../lib/schematicSummaryBuilder';

interface PdmEntry extends ProductDesignModule {
  module: DesignModule;
}

type SectionKey = 'products' | 'rooms' | 'ventilation' | 'lighting' | 'cables' | 'materials' | 'fittings' | 'breakers' | 'floorplans' | 'trades' | 'heating' | 'fv_system' | 'camera_system' | 'schematic';

interface FvSummaryPdf {
  totalKwp: number;
  panelCount: number;
  inverterName: string;
  inverterKw: number;
  batteryName: string;
  batteryKwh: number;
  batteryCount: number;
  wallboxName: string;
  wallboxKw: number;
  totalInvestment: number;
  subsidy: number;
  annualProduction: number;
  roofs: { name: string; panelCount: number; kwp: number; azimuth: number; tilt: number }[];
  accessories: { name: string; qty: number; price: number }[];
  customItems: { name: string; qty: number; unit: string; unitPrice: number }[];
}

interface CameraSummaryPdf {
  cameraCount: number;
  cameras: { modelName: string; count: number; price: number }[];
  nvrs: { name: string; count: number; price: number }[];
  switches: { name: string; count: number; price: number }[];
  totalPrice: number;
  storageConfig: { codec: string; hoursPerDay: number; retentionDays: number };
  accessories: { name: string; qty: number; price: number }[];
}

interface EpsSummaryPdf {
  detectorCount: number;
  totalElements: number;
  totalPrice: number;
  zones: number;
}

interface ExportData {
  selected: SelectionState;
  products: Product[];
  categories: Category[];
  floors: Floor[];
  materials: Material[];
  heatingSystems: HeatingSystemFull[];
  wastePercents: Record<string, number>;
  designModules: DesignModule[];
  productModulesMap?: Record<string, PdmEntry[]>;
  projectName?: string;
  clientName?: string;
  hiddenSections?: Set<SectionKey>;
  pinSize?: number;
  sectionOrder?: SectionKey[];
  fvSummary?: FvSummaryPdf | null;
  cameraSummary?: CameraSummaryPdf | null;
  fvIncluded?: boolean;
  cameraIncluded?: boolean;
  showPrices?: boolean;
  floorplanLabel?: string;
  epsSummary?: EpsSummaryPdf | null;
  epsIncluded?: boolean;
  designElements?: ProjectDesignElement[];
  elementTypes?: DesignElementType[];
  mountingGroups?: MountingGroupWithSlots[];
  resolvedAssignments?: Map<string, ResolvedAssignment>;
  productAssignments?: ProductAssignment[];
  productKindMap?: Map<string, string>;
  designSeriesLinks?: DesignSeriesProductLink[];
  schematicSymbolScale?: number;
  categoryColorMap?: Record<string, string>;
}

const CSS = `
@page { margin: 14mm 12mm 18mm 12mm; size: A4; }
@media print { .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 10px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { max-width: 820px; margin: 0 auto; padding: 0 6px; }
.brand-bar { height: 4px; background: linear-gradient(90deg, #0f172a 0%, #1e40af 40%, #3b82f6 70%, #93c5fd 100%); margin-bottom: 20px; border-radius: 0 0 3px 3px; }
.hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
.hdr-left .doc-type { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 3px; }
.hdr-left h1 { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.15; }
.hdr-right { text-align: right; }
.hdr-right .field { margin-bottom: 4px; }
.hdr-right .field-label { font-size: 7px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; }
.hdr-right .field-value { font-size: 11px; font-weight: 700; color: #0f172a; }
.stats { display: flex; gap: 8px; margin-bottom: 18px; }
.stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #fafbfc; }
.stat .lbl { font-size: 7px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; margin-bottom: 1px; }
.stat .val { font-size: 13px; font-weight: 800; color: #0f172a; }
h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 8px; margin-top: 20px; display: flex; align-items: center; gap: 6px; }
h2 .dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.cat-hdr { padding: 8px 10px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid; }
.cat-badge { display: inline-flex; width: 22px; height: 22px; border-radius: 5px; color: #fff; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }
.cat-name { font-weight: 800; font-size: 11px; }
.cat-count { margin-left: auto; font-size: 9px; font-weight: 600; color: #64748b; }
table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
table.items td { padding: 6px 10px; border-bottom: 1px solid #eef0f4; vertical-align: middle; }
table.items .prod-name { font-weight: 700; font-size: 10px; }
table.items .prod-code { font-size: 9px; color: #64748b; }
table.items .prod-qty { text-align: right; font-weight: 700; width: 50px; }
table.items .prod-price { text-align: right; font-weight: 700; width: 80px; color: #1e40af; }
.cfg-line { font-size: 8.5px; color: #475569; margin-top: 2px; }
.room-hdr { padding: 7px 10px; display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 10.5px; border-bottom: 1px solid #e2e8f0; }
.room-item { padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; font-size: 9.5px; }
.room-item .ri-name { font-weight: 600; }
.room-item .ri-code { font-size: 8.5px; color: #94a3b8; margin-left: 6px; }
table.mat th { background: #0f172a; color: #fff; padding: 7px 10px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
table.mat td { padding: 6px 10px; border-bottom: 1px solid #eef0f4; font-size: 10px; }
table.mat .num { text-align: right; }
table.mat .bold { font-weight: 700; }
table.mat .blue { color: #1e40af; font-weight: 800; }
table.sm th { background: #f8fafc; color: #334155; padding: 5px 8px; font-size: 8px; font-weight: 700; border: 1px solid #e2e8f0; }
table.sm td { padding: 4px 8px; font-size: 9px; border: 1px solid #e2e8f0; }
table.sm .bold { font-weight: 700; }
table.sm .num { text-align: right; }
table.sm .teal { color: #0f766e; font-weight: 700; }
table.sm .amber { color: #b45309; }
.total-box { border: 2px solid #0f172a; border-radius: 8px; overflow: hidden; margin-top: 18px; }
.total-box .total-head { background: #0f172a; color: #fff; font-weight: 800; font-size: 11px; padding: 8px 12px; }
.total-box .total-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
.total-box .total-row .tr-lbl { font-weight: 600; color: #475569; }
.total-box .total-row .tr-val { font-weight: 800; }
.total-box .total-grand { display: flex; justify-content: space-between; padding: 10px 12px; background: #f8fafc; font-size: 13px; }
.total-box .total-grand .tr-lbl { font-weight: 800; }
.total-box .total-grand .tr-val { font-weight: 800; color: #1e40af; }
.circ-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.section { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
.fp-wrap { position: relative; display: inline-block; width: 100%; border: 1px solid #e2e8f0; }
.fp-wrap img { width: 100%; height: auto; display: block; }
.fp-wrap svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.fp-pin { position: absolute; transform: translate(-50%, -50%); text-align: center; }
.fp-pin-dot { width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.15); border: 1.5px solid #fff; margin: 0 auto; }
.fp-pin-dot span { font-size: 6px; font-weight: 800; color: #fff; }
.fp-pin-label { background: rgba(255,255,255,0.92); font-size: 5.5px; font-weight: 800; color: #334155; padding: 0 2px; border-radius: 2px; margin-top: 1px; white-space: nowrap; box-shadow: 0 0.5px 1px rgba(0,0,0,0.08); }
.trade-hdr { display: flex; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 2px solid; margin-bottom: 10px; margin-top: 24px; }
.trade-hdr .trade-dot { width: 12px; height: 12px; border-radius: 50%; }
.trade-hdr .trade-name { font-size: 14px; font-weight: 800; color: #0f172a; }
.trade-total-box { background: #f8fafc; border: 2px solid; border-radius: 6px; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; margin-bottom: 6px; }
.heat-total-box { background: #fef2f2; border: 2px solid #fecaca; border-radius: 6px; padding: 8px 14px; text-align: right; margin-top: 8px; }
.page-break { page-break-before: always; }
.footer-bar { border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; margin-top: 24px; font-size: 8px; color: #94a3b8; }
`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmt(n: number): string {
  return n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
}

function fmtRound(n: number): string {
  return Math.round(n).toLocaleString('cs-CZ');
}

function buildRoomSvg(rooms: Floor['rooms']): string {
  let svg = '';
  for (const room of rooms ?? []) {
    const c = polygonCentroid(room.points);
    svg += `<polygon points="${room.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="rgba(20,184,166,0.10)" stroke="#14b8a6" stroke-width="0.002"/>`;
    svg += `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" fill="#0f766e" font-size="0.014" font-weight="800">${esc(room.name)}</text>`;
  }
  return svg;
}

function buildPinHtml(pin: PinData, categories: Category[], circuits: { id: string; color: string }[], pinSize = 14): string {
  const pcat = categories.find(c => c.id === pin.product.category_id);
  const pc = getPrintColor(pcat?.pill_color ?? '');
  const pinCircuit = pin.placement.circuitId ? circuits.find(c => c.id === pin.placement.circuitId) : null;
  const color = pinCircuit?.color ?? pc.dot;
  const fontSize = Math.max(4, Math.round(pinSize * 0.38));
  const labelSize = Math.max(4, Math.round(pinSize * 0.35));
  const iconSize = Math.round(pinSize * 0.55);

  const svgPath = renderPinIconSvgPath(pin.placement.icon);
  const customLetter = getCustomIconLetter(pin.placement.icon);

  let innerContent: string;
  if (svgPath) {
    innerContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="${svgPath}"/></svg>`;
  } else if (customLetter) {
    innerContent = `<span style="font-size:${fontSize}px;font-weight:800;color:#fff">${esc(customLetter)}</span>`;
  } else {
    innerContent = `<span style="font-size:${fontSize}px">${esc(pin.label)}</span>`;
  }

  return `<div class="fp-pin" style="left:${pin.placement.x * 100}%;top:${pin.placement.y * 100}%">
    <div class="fp-pin-dot" style="background:${color};width:${pinSize}px;height:${pinSize}px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%">${innerContent}</div>
    <div class="fp-pin-label" style="font-size:${labelSize}px">${esc(pin.label)}</div></div>`;
}

function getCachedImageAspectRatio(url: string): number {
  const img = new Image();
  img.src = url;
  if (img.naturalWidth && img.naturalHeight) return img.naturalWidth / img.naturalHeight;
  return 1;
}

function buildObjectSvg(obj: FloorplanObjectData, product: Product, scale: Floor['scale'], canvasAR = 1): string {
  if (!scale || !product.floorplan_symbol) return '';
  const symbol = product.floorplan_symbol as FloorplanSymbol;
  if (symbol.type === 'pin') return '';
  const baseW = mmToNormalized(symbol.width_mm ?? 0, scale);
  const baseH = mmToNormalized(symbol.height_mm ?? 0, scale);
  const rot = ((obj.rotation % 360) + 360) % 360;
  const svgW = (rot === 90 || rot === 270) ? baseH : baseW;
  const svgH = (rot === 90 || rot === 270) ? baseW : baseH;
  const cx = obj.x;
  const cy = obj.y;
  const ox = cx - svgW / 2;
  const oy = cy - svgH / 2;
  let flipStr = '';
  if (obj.flipX || obj.flipY) {
    flipStr = `translate(${cx},${cy})`;
    if (obj.flipX) flipStr += ' scale(-1,1)';
    if (obj.flipY) flipStr += ' scale(1,-1)';
    flipStr += ` translate(${-cx},${-cy})`;
  }
  let svg = '';
  if (symbol.type === 'rect') {
    svg += `<rect x="${ox}" y="${oy}" width="${svgW}" height="${svgH}" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" stroke-width="0.002"${flipStr ? ` transform="${flipStr}"` : ''}/>`;
  }
  if (symbol.type === 'svg' && symbol.svg_content) {
    const rotated = getRotatedSvgContent(symbol, obj.rotation);
    svg += `<g${flipStr ? ` transform="${flipStr}"` : ''}><svg x="${ox}" y="${oy}" width="${svgW}" height="${svgH}" viewBox="${rotated.viewBox}" preserveAspectRatio="none">${rotated.content}</svg></g>`;
  }
  svg += `<text x="${cx}" y="${oy - 0.006}" text-anchor="middle" dominant-baseline="auto" fill="#3b82f6" font-size="0.010" font-weight="800">${esc(product.code)}</text>`;
  return svg;
}

function buildObjectTableRows(objects: FloorplanObjectData[], products: Product[], roomIdToName: (id: string) => string): string {
  let html = '';
  for (const obj of objects) {
    const product = products.find(p => p.id === obj.productId);
    if (!product) continue;
    html += `<tr style="background:#eff6ff">
      <td><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:#3b82f6;margin-right:4px;vertical-align:middle"></span><strong>${esc(product.code)}</strong></td>
      <td style="color:#64748b">${esc(product.code)}</td>
      <td>${esc(product.name)}</td>
      <td class="teal">${esc(obj.roomId ? roomIdToName(obj.roomId) : '\u2014')}</td>
      <td>\u2014</td>
      <td>\u2014</td>
      <td>${obj.note ? esc(obj.note) : '\u2014'}</td></tr>`;
  }
  return html;
}

function buildPinTable(pins: PinData[], categories: Category[], circuits: any[], roomIdToName: (id: string) => string, includeConfig = true): string {
  if (pins.length === 0) return '';
  let html = '<table class="sm" style="margin-top:6px;margin-bottom:8px"><thead><tr>';
  html += '<th style="text-align:left">Pin</th><th style="text-align:left">Kód</th><th style="text-align:left">Položka</th><th style="text-align:left">Místnost</th><th style="text-align:left">Okruh</th><th style="text-align:left">Výška</th>';
  if (includeConfig) html += '<th style="text-align:left">Konfigurace</th>';
  html += '<th style="text-align:left">Poznámka</th></tr></thead><tbody>';
  for (const pin of pins) {
    const pcat = categories.find(c => c.id === pin.product.category_id);
    const pc = getPrintColor(pcat?.pill_color ?? '');
    const pinCircuit = pin.placement.circuitId ? circuits.find(c => c.id === pin.placement.circuitId) : null;
    const dotColor = pinCircuit?.color ?? pc.dot;
    html += `<tr>
      <td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};margin-right:4px;vertical-align:middle"></span><strong>${esc(pin.label)}</strong></td>
      <td style="color:#64748b">${esc(pin.product.code)}</td>
      <td>${esc(pin.product.name)}</td>
      <td class="teal">${esc(pin.placement.room ? roomIdToName(pin.placement.room) : '—')}</td>
      <td>${pinCircuit ? `<span class="circ-dot" style="background:${pinCircuit.color}"></span>${esc(pinCircuit.name)}` : '—'}</td>
      <td>${pin.placement.mountingHeight || '—'}</td>`;
    if (includeConfig) html += `<td>${pin.placement.config ? esc(describeConfig(pin.placement.config)) : '—'}</td>`;
    html += `<td>${pin.placement.note ? esc(pin.placement.note) : '—'}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function buildFullFloorplanHtml(
  floor: Floor, selected: SelectionState, products: Product[],
  categories: Category[], heatingSystems: HeatingSystemFull[],
  roomIdToName: (id: string) => string,
  pinSize = 14,
  designElements: ProjectDesignElement[] = [],
  elementTypes: DesignElementType[] = [],
  mountingGroups: MountingGroupWithSlots[] = [],
  floors: Floor[] = [],
  schematicSymbolScale = 24,
  categoryColorMap: Record<string, string> = {},
): string {
  if (!floor.floorplanImg) return '';
  const floorPins = listAllPins(selected, products, floor.id);
  const floorObjects = floor.objects ?? [];
  const rooms = floor.rooms ?? [];
  const cables = floor.cables ?? [];
  const circuits = floor.circuits ?? [];
  const floorDesignElements = getFloorDesignElements(floor, floors, designElements);
  const floorMountingGroups = getFloorMountingGroups(floor, floors, mountingGroups);
  const getTypeById = (id: string) => elementTypes.find(t => t.id === id);

  let svgContent = buildRoomSvg(rooms);

  if (floor.scale) {
    for (const room of rooms.filter(r => r.heatingSystemId)) {
      const sys = heatingSystems.find(s => s.system.id === room.heatingSystemId);
      if (!sys) continue;
      if (!sys.options.some(o => o.slug === 'pipe_spacing')) continue;
      const cfg = room.heatingConfig ?? {};
      const spacingMm = parseInt(cfg['pipe_spacing'] || '150', 10);
      const spacingNorm = pipeSpacingToNorm(spacingMm, floor.scale);
      if (spacingNorm <= 0) continue;
      const pattern = (cfg['pipe_pattern'] || 'meandr') as PipePattern;
      const pipePath = generateHeatingPipes(room.points, spacingNorm, pattern);
      if (pipePath.length >= 2) {
        svgContent += `<polyline points="${pipePath.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#ef4444" stroke-width="0.0018" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;
      }
    }
  }

  for (const cable of cables) {
    const circuit = circuits.find(ci => ci.id === cable.circuitId);
    svgContent += `<polyline points="${cable.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${circuit?.color ?? '#888'}" stroke-width="0.003" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const canvasAR = floor.floorplanImg ? getCachedImageAspectRatio(floor.floorplanImg) : 1;
  for (const obj of floorObjects) {
    const product = products.find(p => p.id === obj.productId);
    if (product) svgContent += buildObjectSvg(obj, product, floor.scale, canvasAR);
  }

  for (const el of floorDesignElements) {
    const elType = getTypeById(el.element_type_id);
    if (!elType) continue;
    const svgPath = renderPinIconSvgPath(elType.icon || 'circle');
    const baseR = 0.012;
    const scaleFactor = schematicSymbolScale / 24;
    const r = baseR * scaleFactor;
    const catColor = categoryColorMap[elType.category] || '#10b981';
    const rotation = el.rotation || 0;
    const cx = el.x;
    const cy = el.y;
    if (svgPath) {
      const rotTransform = rotation !== 0 ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';
      svgContent += `<svg x="${el.x - r}" y="${el.y - r}" width="${r * 2}" height="${r * 2}" viewBox="0 0 24 24" fill="none" stroke="${catColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${rotTransform}><path d="${svgPath}"/></svg>`;
    } else {
      const rotTransform = rotation !== 0 ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';
      svgContent += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${catColor}" font-size="${r * 1.2}" font-weight="800"${rotTransform}>${elType.name.charAt(0)}</text>`;
    }
    if (el.quantity > 1) {
      svgContent += `<text x="${el.x + r + 0.004}" y="${el.y - r + 0.004}" text-anchor="start" dominant-baseline="auto" fill="#2563eb" font-size="0.008" font-weight="800">x${el.quantity}</text>`;
    }
  }

  for (const mg of floorMountingGroups) {
    const groupElements = floorDesignElements.filter(gEl => mg.slots.some(slot => slot.element_id === gEl.id));
    if (groupElements.length === 0) continue;
    const minX = Math.min(...groupElements.map(gEl => gEl.x));
    const maxX = Math.max(...groupElements.map(gEl => gEl.x));
    const minY = Math.min(...groupElements.map(gEl => gEl.y));
    const maxY = Math.max(...groupElements.map(gEl => gEl.y));
    const padding = 0.015;
    svgContent += `<rect x="${minX - padding}" y="${minY - padding}" width="${maxX - minX + padding * 2}" height="${maxY - minY + padding * 2}" fill="rgba(20,184,166,0.1)" stroke="#14b8a6" stroke-width="0.002" rx="0.004"/>`;
    if (mg.label) {
      svgContent += `<text x="${(minX + maxX) / 2}" y="${minY - padding - 0.005}" text-anchor="middle" dominant-baseline="auto" fill="#0f766e" font-size="0.006" font-weight="800">${esc(mg.label)}</text>`;
    }
  }

  let pinsHtml = '';
  for (const pin of floorPins) pinsHtml += buildPinHtml(pin, categories, circuits, pinSize);

  let tableHtml = '';
  if (floorPins.length > 0 || floorObjects.length > 0) {
    tableHtml = '<table class="sm" style="margin-top:6px;margin-bottom:8px"><thead><tr>';
    tableHtml += '<th style="text-align:left">Pin</th><th style="text-align:left">Kód</th><th style="text-align:left">Položka</th><th style="text-align:left">Místnost</th><th style="text-align:left">Okruh</th><th style="text-align:left">Výška</th>';
    tableHtml += '<th style="text-align:left">Konfigurace</th><th style="text-align:left">Poznámka</th></tr></thead><tbody>';
    for (const pin of floorPins) {
      const pcat = categories.find(c => c.id === pin.product.category_id);
      const pc = getPrintColor(pcat?.pill_color ?? '');
      const pinCircuit = pin.placement.circuitId ? circuits.find(c => c.id === pin.placement.circuitId) : null;
      const dotColor = pinCircuit?.color ?? pc.dot;
      tableHtml += `<tr>
        <td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};margin-right:4px;vertical-align:middle"></span><strong>${esc(pin.label)}</strong></td>
        <td style="color:#64748b">${esc(pin.product.code)}</td>
        <td>${esc(pin.product.name)}</td>
        <td class="teal">${esc(pin.placement.room ? roomIdToName(pin.placement.room) : '\u2014')}</td>
        <td>${pinCircuit ? `<span class="circ-dot" style="background:${pinCircuit.color}"></span>${esc(pinCircuit.name)}` : '\u2014'}</td>
        <td>${pin.placement.mountingHeight || '\u2014'}</td>
        <td>${pin.placement.config ? esc(describeConfig(pin.placement.config)) : '\u2014'}</td>
        <td>${pin.placement.note ? esc(pin.placement.note) : '\u2014'}</td></tr>`;
    }
    tableHtml += buildObjectTableRows(floorObjects, products, roomIdToName);
    tableHtml += '</tbody></table>';
  }

  return `<div class="page-break" style="margin-top:16px">
    <h2>${esc(floor.name)} \u2013 Půdorys s piny</h2>
    <div class="fp-wrap">
      <img src="${floor.floorplanImg}" alt="${esc(floor.name)}" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none">${svgContent}</svg>
      ${pinsHtml}
    </div>
    ${tableHtml}
  </div>`;
}

function buildTradeSection(
  trade: string, floors: Floor[], selected: SelectionState, products: Product[],
  categories: Category[], heatingSystems: HeatingSystemFull[],
  roomIdToName: (id: string) => string,
  getWastePercent: (name: string) => number,
  getMaterialPrice: (name: string) => number,
  pinSize = 14,
  showPrices = true,
): string {
  const tradeInfo = CIRCUIT_TYPE_LABELS[trade as keyof typeof CIRCUIT_TYPE_LABELS];
  const tradeCircuits = floors.flatMap(f => (f.circuits ?? []).filter(c => (c.type ?? 'electric') === trade));
  const allTradePins = floors.flatMap(f => listAllPins(selected, products, f.id).filter(pin => (pin.product.trade || 'electric') === trade));
  if (tradeCircuits.length === 0 && allTradePins.length === 0) return '';

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

  let html = `<div class="page-break">
    <div class="trade-hdr" style="border-color:${tradeInfo.color}">
      <span class="trade-dot" style="background:${tradeInfo.color}"></span>
      <span class="trade-name">${esc(tradeInfo.label)}</span>
    </div>`;

  for (const floor of floors) {
    const fAllCircuits = floor.circuits ?? [];
    const fCircuits = fAllCircuits.filter(c => (c.type ?? 'electric') === trade);
    const fCables = (floor.cables ?? []).filter(cable => {
      const circuit = fAllCircuits.find(c => c.id === cable.circuitId);
      return (circuit?.type ?? 'electric') === trade;
    });
    const tradePins = listAllPins(selected, products, floor.id).filter(pin => (pin.product.trade || 'electric') === trade);
    if (fCircuits.length === 0 && tradePins.length === 0) continue;

    html += `<div style="margin-bottom:12px"><div style="font-weight:700;font-size:10px;color:#334155;margin-bottom:4px">${esc(floor.name)}</div>`;

    if (floor.floorplanImg) {
      let svgContent = buildRoomSvg(floor.rooms);

      if (trade === 'heating' && floor.scale) {
        for (const room of (floor.rooms ?? []).filter(r => r.heatingSystemId)) {
          const sys = heatingSystems.find(s => s.system.id === room.heatingSystemId);
          if (!sys || !sys.options.some(o => o.slug === 'pipe_spacing')) continue;
          const cfg = room.heatingConfig ?? {};
          const spacingMm = parseInt(cfg['pipe_spacing'] || '150', 10);
          const spacingNorm = pipeSpacingToNorm(spacingMm, floor.scale);
          if (spacingNorm <= 0) continue;
          const pattern = (cfg['pipe_pattern'] || 'meandr') as PipePattern;
          const pipePath = generateHeatingPipes(room.points, spacingNorm, pattern);
          if (pipePath.length >= 2) {
            svgContent += `<polyline points="${pipePath.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#ef4444" stroke-width="0.0018" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>`;
          }
        }
      }

      for (const cable of fCables) {
        const circuit = fCircuits.find(ci => ci.id === cable.circuitId);
        svgContent += `<polyline points="${cable.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${circuit?.color ?? '#888'}" stroke-width="0.004" stroke-linecap="round" stroke-linejoin="round"/>`;
      }

      let pinsOverlay = '';
      for (const pin of tradePins) pinsOverlay += buildPinHtml(pin, categories, fCircuits, pinSize);

      html += `<div class="fp-wrap" style="margin-bottom:6px">
        <img src="${floor.floorplanImg}" alt="${esc(floor.name)}" />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none">${svgContent}</svg>
        ${pinsOverlay}
      </div>`;
    }

    html += buildPinTable(tradePins, categories, fCircuits, roomIdToName, false);

    if (fCircuits.length > 0) {
      html += '<table class="sm" style="margin-bottom:6px"><thead><tr><th style="text-align:left">Okruh</th><th style="text-align:left">Materiál</th><th style="text-align:right">Délka</th></tr></thead><tbody>';
      for (const circuit of fCircuits) {
        const circuitCables = fCables.filter(c => c.circuitId === circuit.id);
        circuitCables.forEach((cable, idx) => {
          const len = polylineLength(cable.points);
          const lengthStr = floor.scale ? `${normalizedToMeters(len, floor.scale).toFixed(1)} m` : `${(len * 100).toFixed(0)} j.`;
          html += '<tr>';
          if (idx === 0) html += `<td${circuitCables.length > 1 ? ` rowspan="${circuitCables.length}"` : ''} class="bold"><span class="circ-dot" style="background:${circuit.color}"></span>${esc(circuit.name)}</td>`;
          html += `<td>${cable.materialName || '—'}</td><td class="num bold">${lengthStr}</td></tr>`;
        });
      }
      html += '</tbody></table>';
    }

    html += '</div>';
  }

  if (Object.keys(tradeMaterialTotals).length > 0) {
    let tradeTotal = 0;
    html += `<table class="sm"><thead><tr><th style="text-align:left">Materiál</th><th style="text-align:right">Délka</th>${showPrices ? '<th style="text-align:right">Kč/m</th><th style="text-align:right">Cena</th>' : ''}</tr></thead><tbody>`;
    for (const [name, data] of Object.entries(tradeMaterialTotals)) {
      const lengthM = data.meters ?? (anyFloorWithScale?.scale ? normalizedToMeters(data.normalized, anyFloorWithScale.scale) : null);
      const waste = getWastePercent(name);
      const adjustedLength = lengthM !== null ? lengthM * (1 + waste / 100) : null;
      const pricePerM = getMaterialPrice(name);
      const lineTotal = adjustedLength !== null && pricePerM > 0 ? adjustedLength * pricePerM : 0;
      tradeTotal += lineTotal;
      const lengthStr = adjustedLength !== null ? `${adjustedLength.toFixed(1)} m` : lengthM !== null ? `${lengthM.toFixed(1)} m` : `${(data.normalized * 100).toFixed(0)} j.`;
      const wasteStr = waste > 0 ? ` <span class="amber">(+${waste}%)</span>` : '';
      html += `<tr><td class="bold">${esc(name)}</td><td class="num bold">${lengthStr}${wasteStr}</td>${showPrices ? `<td class="num">${pricePerM > 0 ? `${pricePerM} Kč` : '—'}</td><td class="num bold">${lineTotal > 0 ? `${fmtRound(lineTotal)} Kč` : '—'}</td>` : ''}</tr>`;
    }
    html += '</tbody>';
    if (showPrices && tradeTotal > 0) {
      html += `<tfoot><tr style="background:#f8fafc;border-top:2px solid #cbd5e1"><td colspan="3" style="font-weight:700;text-align:right;padding:6px 8px;border:1px solid #e2e8f0">Celkem ${esc(tradeInfo.label)}</td><td class="num bold" style="padding:6px 8px;border:1px solid #e2e8f0">${fmtRound(tradeTotal)} Kč</td></tr></tfoot>`;
    }
    html += '</table>';
  }

  html += '</div>';
  return html;
}

function buildHeatingCalcHtml(floors: Floor[], heatingSystems: HeatingSystemFull[], showPrices = true): string {
  const heatedRooms = floors.flatMap(floor =>
    (floor.rooms ?? []).filter(r => r.heatingSystemId).map(r => ({ room: r, floor }))
  );
  if (heatedRooms.length === 0) return '';

  let grandTotal = 0;
  const entries: { floorName: string; roomName: string; systemName: string; areaM2: number; lines: ReturnType<typeof calculateHeatingMaterials>; roomTotal: number }[] = [];

  for (const { room, floor } of heatedRooms) {
    const sys = heatingSystems.find(s => s.system.id === room.heatingSystemId);
    if (!sys || !floor.scale) continue;
    const areaM2 = polygonAreaM2(room.points, floor.scale);
    const perimeterM = polygonPerimeterM(room.points, floor.scale);
    const doorWidths = (room.doors ?? []).reduce((s: number, d: any) => s + d.widthM, 0);
    const effectivePerimeter = Math.max(0, perimeterM - doorWidths);
    const lines = calculateHeatingMaterials(sys, room.heatingConfig ?? {}, areaM2, effectivePerimeter);
    const roomTotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    grandTotal += roomTotal;
    entries.push({ floorName: floor.name, roomName: room.name, systemName: sys.system.name, areaM2, lines, roomTotal });
  }

  if (entries.length === 0) return '';

  let html = `<div class="page-break">
    <div class="trade-hdr" style="border-color:#fca5a5">
      <span class="trade-dot" style="background:#ef4444"></span>
      <span class="trade-name">Vytápění \u2013 kalkulace materiálu</span>
    </div>`;

  for (const entry of entries) {
    html += `<div style="margin-bottom:10px">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
        <span style="font-weight:700;font-size:10px;color:#1e293b">${esc(entry.floorName)} \u2013 ${esc(entry.roomName)}</span>
        <span style="font-size:9px;color:#64748b">${esc(entry.systemName)}</span>
        <span style="font-size:9px;font-weight:700;color:#0f766e">${entry.areaM2.toFixed(1)} m2</span>
      </div>`;
    html += `<table class="sm"><thead><tr><th style="text-align:left">Materiál</th><th style="text-align:right">Množství</th>${showPrices ? '<th style="text-align:right">Kč/j.</th><th style="text-align:right">Cena</th>' : ''}</tr></thead><tbody>`;
    for (const line of entry.lines) {
      const qtyStr = line.quantity < 10 ? line.quantity.toFixed(1) : String(Math.ceil(line.quantity));
      html += `<tr><td>${esc(line.name)}</td><td class="num bold">${qtyStr} ${line.unit}</td>${showPrices ? `<td class="num">${line.pricePerUnit > 0 ? `${line.pricePerUnit} Kč` : '—'}</td><td class="num bold">${line.totalPrice > 0 ? `${fmtRound(line.totalPrice)} Kč` : '—'}</td>` : ''}</tr>`;
    }
    if (showPrices && entry.roomTotal > 0) {
      html += `<tr style="background:#fef2f2;border-top:2px solid #e2e8f0"><td colspan="3" style="font-weight:700;text-align:right;padding:6px 8px;border:1px solid #e2e8f0">Celkem místnost</td><td class="num bold" style="color:#991b1b;padding:6px 8px;border:1px solid #e2e8f0">${fmtRound(entry.roomTotal)} Kč</td></tr>`;
    }
    html += '</tbody></table></div>';
  }

  if (showPrices && grandTotal > 0) {
    html += `<div class="heat-total-box"><span style="font-weight:700;font-size:10px;color:#1e293b">Celkem vytápění: </span><span style="font-weight:800;font-size:12px;color:#991b1b">${fmtRound(grandTotal)} Kč</span></div>`;
  }

  html += '</div>';
  return html;
}

export function exportSelectionPdf(data: ExportData) {
  const { selected, products, categories, floors, materials, heatingSystems, wastePercents, designModules, productModulesMap, projectName, clientName, hiddenSections, pinSize, fvSummary, cameraSummary, fvIncluded = true, cameraIncluded = true, showPrices = true, floorplanLabel, epsSummary, epsIncluded = true, designElements = [], elementTypes = [], mountingGroups = [], resolvedAssignments, productAssignments = [], productKindMap = new Map(), designSeriesLinks = [], schematicSymbolScale = 24, categoryColorMap = {} } = data;
  const show = (key: SectionKey) => !hiddenSections?.has(key);
  const dateStr = new Date().toLocaleDateString('cs-CZ');

  const roomIdToName = (id: string): string => {
    for (const floor of floors) {
      for (const room of floor.rooms ?? []) {
        if (room.id === id) return room.name;
      }
    }
    return id;
  };
  const getWastePercent = (name: string) => wastePercents[name] ?? 0;
  const getMaterialPrice = (name: string) => materials.find(m => m.name === name)?.price_per_unit ?? 0;

  const objectCounts: Record<string, number> = {};
  for (const floor of floors) {
    for (const obj of floor.objects ?? []) {
      objectCounts[obj.productId] = (objectCounts[obj.productId] ?? 0) + 1;
    }
  }

  const qtyOf = (pid: string) => (selected[pid]?.placements?.length ?? 0) + (objectCounts[pid] ?? 0);

  const allProductIds = new Set([...Object.keys(selected), ...Object.keys(objectCounts)]);
  const selectedProducts = Array.from(allProductIds)
    .map(id => products.find(p => p.id === id))
    .filter(Boolean) as Product[];

  const allPinsCount = Object.keys(selected).reduce((s, pid) => s + selected[pid].placements.length, 0);
  const totalPlacedCount = allPinsCount + Object.values(objectCounts).reduce((s, c) => s + c, 0);

  const allRooms: { id: string; name: string }[] = [];
  for (const floor of floors) {
    for (const room of floor.rooms ?? []) allRooms.push({ id: room.id, name: room.name });
  }

  const groupedByCat = categories
    .map(cat => ({ cat, items: selectedProducts.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0);

  const totalProductPrice = selectedProducts.reduce(
    (sum, p) => sum + p.price * qtyOf(p.id), 0
  );

  const materialTotals: { name: string; rawLength: number; unit: string; pricePerUnit: number }[] = [];
  const totMap: Record<string, typeof materialTotals[0]> = {};
  for (const floor of floors) {
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const normalized = polylineLength(cable.points);
      const lengthM = floor.scale ? normalizedToMeters(normalized, floor.scale) : 0;
      if (!totMap[cable.materialName]) {
        const mat = materials.find(m => m.name === cable.materialName);
        totMap[cable.materialName] = { name: cable.materialName, rawLength: 0, unit: mat?.unit ?? 'm', pricePerUnit: mat?.price_per_unit ?? 0 };
      }
      totMap[cable.materialName].rawLength += lengthM;
    }
  }
  materialTotals.push(...Object.values(totMap));

  const materialWithWaste = materialTotals.map(mat => {
    const waste = wastePercents[mat.name] ?? 0;
    const adjustedLength = mat.rawLength * (1 + waste / 100);
    const totalPrice = adjustedLength * mat.pricePerUnit;
    return { ...mat, waste, adjustedLength, totalPrice };
  });

  const totalMaterialPrice = materialWithWaste.reduce((s, m) => s + m.totalPrice, 0);
  const grandTotal = totalProductPrice + totalMaterialPrice;

  let sectionsHtml = '';

  if (show('products')) for (const { cat, items } of groupedByCat) {
    const pc = getPrintColor(cat.pill_color ?? '');
    const catQty = items.reduce((s, p) => s + qtyOf(p.id), 0);
    sectionsHtml += `<div class="section"><div class="cat-hdr" style="background:${pc.bg};border-color:${pc.border}">
      <span class="cat-badge" style="background:${pc.dot}">${items.length}</span>
      <span class="cat-name" style="color:${pc.text}">${esc(cat.name)}</span>
      <span class="cat-count">${catQty} ks</span></div>`;
    sectionsHtml += '<table class="items"><tbody>';
    for (const p of items) {
      const qty = qtyOf(p.id);
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
      let cfgHtml = '';
      if (cfgEntries.length > 0) {
        const pm = productModulesMap?.[p.id];
        const getModPrice = (n: string) => {
          if (pm && pm.length > 0) return pm.find(e => e.module.name === n)?.price ?? 0;
          return designModules.find(m => m.name === n)?.price ?? 0;
        };
        cfgHtml = cfgEntries.map(c => {
          const cfgPrice = c.modules.reduce((s, m) => s + getModPrice(m), 0);
          const priceStr = cfgPrice > 0 ? ` &mdash; ${fmt(cfgPrice * c.count)} Kč` : '';
          return `<div class="cfg-line">${c.count}x ${c.frameSize}R: ${c.modules.join(' + ')}${c.colorName ? ` | ${esc(c.colorName)}` : ''}${priceStr}</div>`;
        }).join('');
        const totalModulesPrice = cfgEntries.reduce((s, c) => s + c.count * c.modules.reduce((ms, m) => ms + getModPrice(m), 0), 0);
        if (totalModulesPrice > 0) {
          cfgHtml += `<div class="cfg-line" style="font-weight:800;color:#1d4ed8;margin-top:2px;">Vložky celkem: ${fmt(totalModulesPrice)} Kč</div>`;
        }
      }

      if (cfgEntries.length === 0) {
        const colorCounts: Record<string, { count: number; hex: string }> = {};
        for (const pl of placements) {
          const cn = pl.config?.colorName ?? (pl as any).colorName;
          const ch = pl.config?.colorHex ?? (pl as any).colorHex ?? '#ccc';
          if (cn) {
            if (!colorCounts[cn]) colorCounts[cn] = { count: 0, hex: ch };
            colorCounts[cn].count++;
          }
        }
        const colorEntries = Object.entries(colorCounts).sort(([a], [b]) => a.localeCompare(b));
        if (colorEntries.length > 0) {
          cfgHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">' + colorEntries.map(([name, { count, hex }]) =>
            `<span style="display:inline-flex;align-items:center;gap:3px;font-size:8px;font-weight:700;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;padding:1px 5px;border-radius:4px;"><span style="width:7px;height:7px;border-radius:50%;background:${hex};border:1px solid #cbd5e1;display:inline-block;"></span>${count}x ${esc(name)}</span>`
          ).join('') + '</div>';
        }
      }
      sectionsHtml += `<tr>
        <td><div class="prod-name">${esc(p.name)}</div><div class="prod-code">${esc(p.brand)} ${esc(p.code)}</div>${cfgHtml}</td>
        <td class="prod-qty">${qty} ks</td>
        ${showPrices ? `<td class="prod-price">${total > 0 ? `${fmt(total)} Kč` : ''}</td>` : ''}
      </tr>`;
    }
    sectionsHtml += '</tbody></table></div>';
  }

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
      const rName = pl.room ? allRooms.find(r => r.id === pl.room)?.name ?? 'Nezařazeno' : 'Nezařazeno';
      const cn = pl.config?.colorName ?? (pl as any).colorName ?? null;
      const ch = pl.config?.colorHex ?? (pl as any).colorHex ?? '#ccc';
      addToRoomMap(rName, product, cn, ch);
    }
  }
  for (const floor of floors) {
    for (const obj of floor.objects ?? []) {
      const product = products.find(p => p.id === obj.productId);
      if (!product) continue;
      const rName = obj.roomId ? allRooms.find(r => r.id === obj.roomId)?.name ?? 'Nezařazeno' : 'Nezařazeno';
      addToRoomMap(rName, product);
    }
  }

  if (show('rooms') && allRooms.length > 0 && Object.keys(roomProductMap).length > 0) {
    sectionsHtml += '<h2><span class="dot" style="background:#14b8a6"></span>Rozložení podle místností</h2>';
    for (const rName of [...allRooms.map(r => r.name), 'Nezařazeno']) {
      const items = roomProductMap[rName];
      if (!items || items.length === 0) continue;
      const totalItems = items.reduce((s, i) => s + i.count, 0);
      const bg = rName === 'Nezařazeno' ? '#f8fafc' : '#f0fdfa';
      const color = rName === 'Nezařazeno' ? '#64748b' : '#115e59';
      sectionsHtml += `<div class="section">
        <div class="room-hdr" style="background:${bg};color:${color}">${esc(rName)} <span style="font-weight:600;font-size:9px;color:#64748b;margin-left:auto">${totalItems} ks</span></div>`;
      for (const rp of items) {
        let colorHtml = '';
        if (rp.colorCounts && Object.keys(rp.colorCounts).length > 0) {
          colorHtml = '<span style="display:inline-flex;gap:4px;margin-left:6px;">' + Object.entries(rp.colorCounts).sort(([a], [b]) => a.localeCompare(b)).map(([cn, { count, hex }]) =>
            `<span style="display:inline-flex;align-items:center;gap:2px;font-size:7px;font-weight:700;color:#64748b;"><span style="width:6px;height:6px;border-radius:50%;background:${hex};border:1px solid #cbd5e1;display:inline-block;"></span>${count}x ${esc(cn)}</span>`
          ).join('') + '</span>';
        }
        sectionsHtml += `<div class="room-item"><span><span class="ri-name">${esc(rp.product.name)}</span><span class="ri-code">${esc(rp.product.code)}</span>${colorHtml}</span><span style="font-weight:700">${rp.count} ks</span></div>`;
      }
      sectionsHtml += '</div>';
    }
  }

  const cablesByFloor: { floor: Floor; circuits: { circuit: any; cables: { cable: any; lengthM: number }[] }[] }[] = [];
  for (const floor of floors) {
    const circs: typeof cablesByFloor[0]['circuits'] = [];
    for (const circuit of floor.circuits ?? []) {
      const cabs = (floor.cables ?? []).filter(c => c.circuitId === circuit.id);
      const mapped = cabs.map(cable => ({
        cable,
        lengthM: floor.scale ? normalizedToMeters(polylineLength(cable.points), floor.scale) : 0,
      }));
      if (mapped.length > 0) circs.push({ circuit, cables: mapped });
    }
    if (circs.length > 0) cablesByFloor.push({ floor, circuits: circs });
  }

  if (show('cables') && cablesByFloor.length > 0) {
    sectionsHtml += '<h2>Trasy a kabely</h2>';
    for (const { floor, circuits } of cablesByFloor) {
      sectionsHtml += `<div class="section"><div class="room-hdr" style="background:#f8fafc;color:#0f172a">${esc(floor.name)}</div>`;
      for (const { circuit, cables } of circuits) {
        const typeLabel = CIRCUIT_TYPE_LABELS[circuit.type as keyof typeof CIRCUIT_TYPE_LABELS]?.label ?? circuit.type;
        sectionsHtml += `<div style="padding:6px 10px;border-bottom:1px solid #eef0f4">
          <div style="margin-bottom:4px"><span class="circ-dot" style="background:${circuit.color}"></span><strong>${esc(circuit.name)}</strong> <span style="font-size:9px;color:#64748b">${esc(typeLabel)}</span></div>`;
        for (const { cable, lengthM } of cables) {
          sectionsHtml += `<div style="display:flex;justify-content:space-between;font-size:9px;color:#475569;margin-left:16px"><span>${cable.materialName || 'Nezadaný materiál'}</span><span style="font-weight:600">${lengthM.toFixed(1)} m</span></div>`;
        }
        sectionsHtml += '</div>';
      }
      sectionsHtml += '</div>';
    }
  }

  if (show('materials') && materialWithWaste.length > 0) {
    sectionsHtml += '<h2>Materiál</h2><div class="section"><table class="mat"><thead><tr>';
    sectionsHtml += `<th style="text-align:left">Název</th><th style="text-align:right">Délka surová</th><th style="text-align:right">Odpady %</th><th style="text-align:right">Délka upravená</th>${showPrices ? '<th style="text-align:right">Cena/j.</th><th style="text-align:right">Celkem</th>' : ''}`;
    sectionsHtml += '</tr></thead><tbody>';
    for (const mat of materialWithWaste) {
      sectionsHtml += `<tr>
        <td class="bold">${esc(mat.name)}</td>
        <td class="num">${mat.rawLength.toFixed(1)} ${mat.unit}</td>
        <td class="num">${mat.waste}%</td>
        <td class="num bold">${mat.adjustedLength.toFixed(1)} ${mat.unit}</td>
        ${showPrices ? `<td class="num">${fmt(mat.pricePerUnit)} Kč</td><td class="num blue">${fmt(mat.totalPrice)} Kč</td>` : ''}
      </tr>`;
    }
    if (showPrices) sectionsHtml += `<tr style="background:#f8fafc"><td colspan="5" style="font-weight:700;padding:8px 10px">Celkem materiál</td><td class="num blue" style="font-weight:800;padding:8px 10px">${fmt(totalMaterialPrice)} Kč</td></tr>`;
    sectionsHtml += '</tbody></table></div>';
  }

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
        for (const angle of STANDARD_BEND_ANGLES) bendCounts[cable.materialName][angle] = 0;
      }
      for (const bend of bends) bendCounts[cable.materialName][bend.angle]++;
    }
    const cablesByMat: Record<string, any[]> = {};
    for (const cable of floor.cables ?? []) {
      if (!cable.materialName) continue;
      const circuit = fCircuits.find(c => c.id === cable.circuitId);
      const cType = circuit?.type ?? 'electric';
      if (cType !== 'water' && cType !== 'heating') continue;
      if (!cablesByMat[cable.materialName]) cablesByMat[cable.materialName] = [];
      cablesByMat[cable.materialName].push(cable);
    }
    for (const [matName, cabs] of Object.entries(cablesByMat)) {
      tPieceCounts[matName] = (tPieceCounts[matName] ?? 0) + countTPieces(cabs);
    }
  }

  if (show('fittings') && Object.keys(bendCounts).length > 0) {
    sectionsHtml += '<h2>Tvarovky</h2><div class="section"><table class="mat"><thead><tr><th style="text-align:left">Materiál</th>';
    for (const angle of STANDARD_BEND_ANGLES) sectionsHtml += `<th style="text-align:right">${angle}°</th>`;
    sectionsHtml += '<th style="text-align:right">T-kusy</th></tr></thead><tbody>';
    for (const [matName, bends] of Object.entries(bendCounts)) {
      sectionsHtml += `<tr><td class="bold">${esc(matName)}</td>`;
      for (const angle of STANDARD_BEND_ANGLES) sectionsHtml += `<td class="num">${bends[angle] || 0}</td>`;
      sectionsHtml += `<td class="num">${tPieceCounts[matName] || 0}</td></tr>`;
    }
    sectionsHtml += '</tbody></table></div>';
  }

  const breakerTotals: { amperage: number; poles: number; curve: string; count: number }[] = [];
  const bMap: Record<string, typeof breakerTotals[0]> = {};
  for (const floor of floors) {
    for (const circuit of floor.circuits ?? []) {
      if (!circuit.breaker) continue;
      const key = `${circuit.breaker.amperage}-${circuit.breaker.poles}-${circuit.breaker.curve}`;
      if (!bMap[key]) bMap[key] = { ...circuit.breaker, count: 0 };
      bMap[key].count++;
    }
  }
  breakerTotals.push(...Object.values(bMap));

  if (show('breakers') && breakerTotals.length > 0) {
    sectionsHtml += '<h2>Jištění</h2><div class="section"><table class="mat"><thead><tr><th style="text-align:left">Proud</th><th style="text-align:center">Póly</th><th style="text-align:center">Křivka</th><th style="text-align:right">Množství</th></tr></thead><tbody>';
    for (const b of breakerTotals) {
      sectionsHtml += `<tr><td class="bold">${b.amperage}A</td><td style="text-align:center">${b.poles}</td><td style="text-align:center">${b.curve}</td><td class="num">${b.count} ks</td></tr>`;
    }
    sectionsHtml += '</tbody></table></div>';
  }

  const ventRows: { floorName: string; roomName: string; areaM2: number; airFlow: number; mode: string; supplyVents: number; exhaustVents: number }[] = [];
  let ventTotalSupply = 0;
  let ventTotalExhaust = 0;
  let ventTotalSupplyVents = 0;
  let ventTotalExhaustVents = 0;
  const DUCT_CAPS: Record<number, number> = { 75: 25, 90: 38 };
  for (const floor of floors) {
    if (!floor.scale) continue;
    for (const room of floor.rooms ?? []) {
      const mode = room.ventilationMode;
      if (!mode) continue;
      const areaM2 = polygonAreaM2(room.points, floor.scale);
      const height = room.ceilingHeight ?? 2.6;
      const ach = room.airChangesPerHour ?? 0.5;
      const airFlow = areaM2 * height * ach;
      const ductCap = DUCT_CAPS[room.ductDiameter ?? 75] ?? 25;
      const autoVents = Math.ceil(airFlow / ductCap);
      const supplyVents = room.manualSupplyVents ?? (mode === 'supply' || mode === 'both' ? autoVents : 0);
      const exhaustVents = room.manualExhaustVents ?? (mode === 'exhaust' || mode === 'both' ? autoVents : 0);
      if (mode === 'supply' || mode === 'both') ventTotalSupply += airFlow;
      if (mode === 'exhaust' || mode === 'both') ventTotalExhaust += airFlow;
      ventTotalSupplyVents += supplyVents;
      ventTotalExhaustVents += exhaustVents;
      const modeLabel = mode === 'supply' ? 'Přívod' : mode === 'exhaust' ? 'Odvod' : 'Přívod + Odvod';
      ventRows.push({ floorName: floor.name, roomName: room.name, areaM2, airFlow, mode: modeLabel, supplyVents, exhaustVents });
    }
  }

  if (show('ventilation') && ventRows.length > 0) {
    sectionsHtml += '<h2><span class="dot" style="background:#10b981"></span>Rekuperace</h2>';
    sectionsHtml += `<div class="section">
      <div style="display:flex;border-bottom:1px solid #e2e8f0">
        <div style="flex:1;padding:8px 12px;background:#eff6ff">
          <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#3b82f6">Přívod</div>
          <div style="font-size:14px;font-weight:800;color:#1d4ed8">${Math.round(ventTotalSupply)} <span style="font-size:9px">m³/h</span></div>
          <div style="font-size:9px;font-weight:700;color:#2563eb">${ventTotalSupplyVents} výústek</div>
        </div>
        <div style="flex:1;padding:8px 12px;background:#fffbeb;border-left:1px solid #e2e8f0">
          <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#d97706">Odvod</div>
          <div style="font-size:14px;font-weight:800;color:#b45309">${Math.round(ventTotalExhaust)} <span style="font-size:9px">m³/h</span></div>
          <div style="font-size:9px;font-weight:700;color:#d97706">${ventTotalExhaustVents} výústek</div>
        </div>
      </div>`;
    sectionsHtml += '<table class="mat"><thead><tr><th style="text-align:left">Místnost</th><th style="text-align:right">Plocha</th><th style="text-align:right">m³/h</th><th style="text-align:center">Typ</th><th style="text-align:right">Přívod</th><th style="text-align:right">Odvod</th></tr></thead><tbody>';
    for (const row of ventRows) {
      sectionsHtml += `<tr>
        <td class="bold">${esc(row.roomName)} <span style="font-size:8px;color:#94a3b8">${esc(row.floorName)}</span></td>
        <td class="num">${row.areaM2.toFixed(1)} m²</td>
        <td class="num bold" style="color:#059669">${Math.round(row.airFlow)}</td>
        <td style="text-align:center"><span style="font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;${
          row.mode === 'Přívod' ? 'background:#eff6ff;color:#2563eb' :
          row.mode === 'Odvod' ? 'background:#fffbeb;color:#d97706' :
          'background:#ecfdf5;color:#059669'
        }">${esc(row.mode)}</span></td>
        <td class="num bold" style="color:#2563eb">${row.supplyVents > 0 ? row.supplyVents : '—'}</td>
        <td class="num bold" style="color:#d97706">${row.exhaustVents > 0 ? row.exhaustVents : '—'}</td>
      </tr>`;
    }
    sectionsHtml += '</tbody></table></div>';
  }

  const lightingRows: { floorName: string; roomName: string; areaM2: number; requiredLux: number; requiredLumens: number; currentLumens: number; pct: number; isOk: boolean }[] = [];
  for (const floor of floors) {
    if (!floor.scale) continue;
    for (const room of floor.rooms ?? []) {
      if (!room.requiredLux || room.requiredLux <= 0) continue;
      const areaM2 = polygonAreaM2(room.points, floor.scale);
      const requiredLumens = Math.round((room.requiredLux * areaM2) / (0.5 * 0.8));
      let currentLumens = 0;
      const floorPins = listAllPins(selected, products, floor.id);
      for (const pin of floorPins) {
        if (pin.placement.room === room.id && pin.product.lumens > 0) {
          currentLumens += pin.product.lumens;
        }
      }
      const pct = requiredLumens > 0 ? Math.round((currentLumens / requiredLumens) * 100) : 0;
      lightingRows.push({ floorName: floor.name, roomName: room.name, areaM2, requiredLux: room.requiredLux, requiredLumens, currentLumens, pct, isOk: currentLumens >= requiredLumens });
    }
  }

  if (show('lighting') && lightingRows.length > 0) {
    sectionsHtml += '<h2><span class="dot" style="background:#f59e0b"></span>Osvětlení</h2>';
    sectionsHtml += '<div class="section"><table class="mat"><thead><tr><th style="text-align:left">Místnost</th><th style="text-align:right">Plocha</th><th style="text-align:right">Lux</th><th style="text-align:right">Potřeba (lm)</th><th style="text-align:right">Aktuálně (lm)</th><th style="text-align:right">Stav</th></tr></thead><tbody>';
    for (const row of lightingRows) {
      const statusColor = row.isOk ? '#059669' : '#dc2626';
      const statusBg = row.isOk ? '#ecfdf5' : '#fef2f2';
      const statusText = row.isOk ? 'OK' : `${row.pct}%`;
      sectionsHtml += `<tr>
        <td class="bold">${esc(row.roomName)} <span style="font-size:8px;color:#94a3b8">${esc(row.floorName)}</span></td>
        <td class="num">${row.areaM2.toFixed(1)} m²</td>
        <td class="num">${row.requiredLux}</td>
        <td class="num bold" style="color:#b45309">${fmtRound(row.requiredLumens)}</td>
        <td class="num bold">${fmtRound(row.currentLumens)}</td>
        <td class="num"><span style="font-size:8px;font-weight:700;padding:1px 6px;border-radius:10px;background:${statusBg};color:${statusColor}">${statusText}</span></td>
      </tr>`;
    }
    sectionsHtml += '</tbody></table></div>';
  }

  if (show('fv_system') && fvIncluded && fvSummary && fvSummary.panelCount > 0) {
    sectionsHtml += '<h2><span class="dot" style="background:#f97316"></span>Fotovoltaický systém</h2>';
    sectionsHtml += '<div class="section">';
    sectionsHtml += `<div style="display:flex;gap:8px;padding:10px;background:#fff7ed;border-bottom:1px solid #fed7aa">`;
    sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#ea580c">Výkon</div><div style="font-size:14px;font-weight:800;color:#0f172a">${fvSummary.totalKwp} kWp</div><div style="font-size:9px;color:#64748b">${fvSummary.panelCount} panelů</div></div>`;
    if (fvSummary.inverterName) sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#ea580c">Střídač</div><div style="font-size:11px;font-weight:800;color:#0f172a">${esc(fvSummary.inverterName)}</div><div style="font-size:9px;color:#64748b">${fvSummary.inverterKw} kW</div></div>`;
    if (fvSummary.batteryKwh > 0) sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#ea580c">Baterie</div><div style="font-size:11px;font-weight:800;color:#0f172a">${esc(fvSummary.batteryName)}</div><div style="font-size:9px;color:#64748b">${fvSummary.batteryKwh} kWh (${fvSummary.batteryCount}x)</div></div>`;
    if (fvSummary.wallboxName) sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#ea580c">Wallbox</div><div style="font-size:11px;font-weight:800;color:#0f172a">${esc(fvSummary.wallboxName)}</div><div style="font-size:9px;color:#64748b">${fvSummary.wallboxKw} kW</div></div>`;
    sectionsHtml += '</div>';

    if (fvSummary.roofs.length > 0) {
      sectionsHtml += '<table class="mat"><thead><tr><th style="text-align:left;background:#fff7ed;color:#9a3412">Střešní plocha</th><th style="text-align:right;background:#fff7ed;color:#9a3412">Panelů</th><th style="text-align:right;background:#fff7ed;color:#9a3412">kWp</th><th style="text-align:right;background:#fff7ed;color:#9a3412">Azimut</th><th style="text-align:right;background:#fff7ed;color:#9a3412">Sklon</th></tr></thead><tbody>';
      for (const r of fvSummary.roofs) {
        sectionsHtml += `<tr><td class="bold">${esc(r.name)}</td><td class="num">${r.panelCount}</td><td class="num bold" style="color:#ea580c">${r.kwp.toFixed(2)}</td><td class="num">${r.azimuth}°</td><td class="num">${r.tilt}°</td></tr>`;
      }
      sectionsHtml += '</tbody></table>';
    }

    if (fvSummary.accessories.length > 0 || fvSummary.customItems.length > 0) {
      for (const a of fvSummary.accessories) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:9.5px"><span style="font-weight:600">${esc(a.name)}</span><span><span style="color:#64748b">${a.qty} ks</span>${showPrices ? ` <span style="font-weight:700;color:#ea580c;margin-left:8px">${fmt(a.price)} Kč</span>` : ''}</span></div>`;
      }
      for (const ci of fvSummary.customItems) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:9.5px"><span style="font-weight:600">${esc(ci.name)}</span><span><span style="color:#64748b">${ci.qty} ${esc(ci.unit)}</span>${showPrices ? ` <span style="font-weight:700;color:#ea580c;margin-left:8px">${fmt(ci.qty * ci.unitPrice)} Kč</span>` : ''}</span></div>`;
      }
    }

    if (showPrices && fvSummary.totalInvestment > 0) {
      sectionsHtml += `<div style="background:#fff7ed;border-top:2px solid #fdba74;padding:8px 10px">`;
      sectionsHtml += `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px"><span style="color:#78350f">Celková investice</span><span style="font-weight:800;color:#0f172a">${fmt(fvSummary.totalInvestment)} Kč</span></div>`;
      if (fvSummary.subsidy > 0) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px"><span style="color:#059669">Dotace</span><span style="font-weight:800;color:#059669">-${fmt(fvSummary.subsidy)} Kč</span></div>`;
        sectionsHtml += `<div style="display:flex;justify-content:space-between;font-size:11px"><span style="font-weight:800;color:#78350f">Po odečtení dotace</span><span style="font-weight:800;color:#ea580c">${fmt(fvSummary.totalInvestment - fvSummary.subsidy)} Kč</span></div>`;
      }
      if (fvSummary.annualProduction > 0) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:3px"><span style="color:#78350f">Roční výroba</span><span style="font-weight:800;color:#0f172a">${fmtRound(fvSummary.annualProduction)} kWh</span></div>`;
      }
      sectionsHtml += '</div>';
    }
    sectionsHtml += '</div>';
  }

  if (show('camera_system') && cameraIncluded && cameraSummary && cameraSummary.cameraCount > 0) {
    sectionsHtml += '<h2><span class="dot" style="background:#0ea5e9"></span>Kamerový systém</h2>';
    sectionsHtml += '<div class="section">';
    sectionsHtml += `<div style="display:flex;gap:8px;padding:10px;background:#f0f9ff;border-bottom:1px solid #bae6fd">`;
    sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#0284c7">Kamery</div><div style="font-size:14px;font-weight:800;color:#0f172a">${cameraSummary.cameraCount}</div></div>`;
    if (cameraSummary.nvrs.length > 0) sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#0284c7">NVR</div><div style="font-size:14px;font-weight:800;color:#0f172a">${cameraSummary.nvrs.length}</div></div>`;
    sectionsHtml += `<div style="flex:1"><div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#0284c7">Záznam</div><div style="font-size:11px;font-weight:800;color:#0f172a">${cameraSummary.storageConfig.codec.toUpperCase()}</div><div style="font-size:9px;color:#64748b">${cameraSummary.storageConfig.retentionDays} dní</div></div>`;
    sectionsHtml += '</div>';

    if (cameraSummary.cameras.length > 0) {
      sectionsHtml += `<table class="mat"><thead><tr><th style="text-align:left;background:#f0f9ff;color:#075985">Kamera</th><th style="text-align:right;background:#f0f9ff;color:#075985">Ks</th>${showPrices ? '<th style="text-align:right;background:#f0f9ff;color:#075985">Cena</th>' : ''}</tr></thead><tbody>`;
      for (const c of cameraSummary.cameras) {
        sectionsHtml += `<tr><td class="bold">${esc(c.modelName)}</td><td class="num">${c.count}</td>${showPrices ? `<td class="num bold" style="color:#0284c7">${fmt(c.price)} Kč</td>` : ''}</tr>`;
      }
      sectionsHtml += '</tbody></table>';
    }

    if (cameraSummary.nvrs.length > 0 || cameraSummary.switches.length > 0) {
      for (const n of cameraSummary.nvrs) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:9.5px"><span style="font-weight:600">NVR: ${esc(n.name)}</span><span><span style="color:#64748b">${n.count} ks</span>${showPrices ? ` <span style="font-weight:700;color:#0284c7;margin-left:8px">${fmt(n.price)} Kč</span>` : ''}</span></div>`;
      }
      for (const s of cameraSummary.switches) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:9.5px"><span style="font-weight:600">Switch: ${esc(s.name)}</span><span><span style="color:#64748b">${s.count} ks</span>${showPrices ? ` <span style="font-weight:700;color:#0284c7;margin-left:8px">${fmt(s.price)} Kč</span>` : ''}</span></div>`;
      }
    }

    if (cameraSummary.accessories.length > 0) {
      for (const a of cameraSummary.accessories) {
        sectionsHtml += `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:9.5px"><span style="font-weight:600">${esc(a.name)}</span><span><span style="color:#64748b">${a.qty} ks</span>${showPrices ? ` <span style="font-weight:700;color:#0284c7;margin-left:8px">${fmt(a.price)} Kč</span>` : ''}</span></div>`;
      }
    }

    if (showPrices) sectionsHtml += `<div style="background:#f0f9ff;border-top:2px solid #7dd3fc;padding:8px 10px;display:flex;justify-content:space-between"><span style="font-weight:800;color:#075985">Celkem kamery</span><span style="font-weight:800;color:#0284c7;font-size:12px">${fmt(cameraSummary.totalPrice)} Kč</span></div>`;
    sectionsHtml += '</div>';
  }

  const fvTotalPrice = fvIncluded && fvSummary ? fvSummary.totalInvestment : 0;
  const cameraTotalPrice = cameraIncluded && cameraSummary ? cameraSummary.totalPrice : 0;
  const epsTotalPrice = epsIncluded && epsSummary ? epsSummary.totalPrice : 0;
  const combinedGrandTotal = grandTotal + fvTotalPrice + cameraTotalPrice + epsTotalPrice;

  if (showPrices) {
    sectionsHtml += `<div class="total-box">
      <div class="total-head">Celkový souhrn</div>`;
    if (grandTotal > 0) sectionsHtml += `<div class="total-row"><span class="tr-lbl">${floorplanLabel || 'Půdorysný návrhář (produkty + materiál)'}</span><span class="tr-val">${fmt(grandTotal)} Kč</span></div>`;
    if (fvTotalPrice > 0) sectionsHtml += `<div class="total-row"><span class="tr-lbl" style="color:#ea580c">Fotovoltaika</span><span class="tr-val" style="color:#ea580c">${fmt(fvTotalPrice)} Kč</span></div>`;
    if (cameraTotalPrice > 0) sectionsHtml += `<div class="total-row"><span class="tr-lbl" style="color:#0284c7">Kamerový systém</span><span class="tr-val" style="color:#0284c7">${fmt(cameraTotalPrice)} Kč</span></div>`;
    if (epsTotalPrice > 0) sectionsHtml += `<div class="total-row"><span class="tr-lbl" style="color:#dc2626">EPS / EZS</span><span class="tr-val" style="color:#dc2626">${fmt(epsTotalPrice)} Kč</span></div>`;
    sectionsHtml += `<div class="total-grand"><span class="tr-lbl">Celkem</span><span class="tr-val">${fmt(combinedGrandTotal)} Kč</span></div>
    </div>`;
  }

  if (show('schematic') && (designElements.length > 0 || mountingGroups.length > 0)) {
    const allRooms: Array<{ id: string; name: string }> = [];
    for (const floor of floors) {
      for (const room of floor.rooms ?? []) {
        allRooms.push({ id: room.id, name: room.name });
      }
    }

    const schematicSummary = buildSchematicSummary({
      designElements,
      elementTypes,
      assignments: productAssignments,
      mountingGroups,
      designSeriesLinks,
      products,
      productKindMap,
      rooms: allRooms.map(r => ({ id: r.id, name: r.name, points: [], requiredLux: null })),
      floors,
    });

    const { aggregatedRows, frameRows, moduleRows, stats, warnings: summaryWarnings } = schematicSummary;

    sectionsHtml += '<h2><span class="dot" style="background:#6366f1"></span>Schematický návrh</h2>';
    sectionsHtml += '<div class="section">';

    sectionsHtml += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px;background:#f8fafc;border-bottom:1px solid #e2e8f0">`;
    sectionsHtml += `<div style="text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Prvků</div><div style="font-size:14px;font-weight:800;color:#0f172a">${stats.totalElements}</div></div>`;
    sectionsHtml += `<div style="text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Přiřazeno</div><div style="font-size:14px;font-weight:800;color:#10b981">${stats.assignedElements}</div></div>`;
    if (stats.unassignedElements > 0) {
      sectionsHtml += `<div style="text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Nepřiřazeno</div><div style="font-size:14px;font-weight:800;color:#ef4444">${stats.unassignedElements}</div></div>`;
    }
    sectionsHtml += `<div style="text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Vícerámečky</div><div style="font-size:14px;font-weight:800;color:#8b5cf6">${stats.totalGroups}</div></div>`;
    if (stats.totalFrames > 0) {
      sectionsHtml += `<div style="text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Rámečků</div><div style="font-size:14px;font-weight:800;color:#14b8a6">${stats.totalFrames}</div></div>`;
    }
    sectionsHtml += `</div>`;

    if (summaryWarnings.filter(w => w.severity !== 'info').length > 0) {
      sectionsHtml += `<div style="background:#fef3c7;border-bottom:1px solid #fcd34d;padding:8px 10px">`;
      sectionsHtml += `<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:4px">Upozornění</div>`;
      for (const w of summaryWarnings.filter(w => w.severity !== 'info').slice(0, 5)) {
        sectionsHtml += `<div style="font-size:9px;color:#b45309">${esc(w.message)}</div>`;
      }
      sectionsHtml += `</div>`;
    }

    if (aggregatedRows.length > 0) {
      sectionsHtml += `<div style="padding-top:8px"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin:8px 10px 6px">Schematické prvky a přiřazené produkty</div>`;
      sectionsHtml += `<table class="mat"><thead><tr><th style="text-align:left">Typ prvku</th><th style="text-align:left">Přiřazený produkt</th><th style="text-align:right">Počet</th>${showPrices ? '<th style="text-align:right">Cena / ks</th><th style="text-align:right">Celkem</th>' : ''}</tr></thead><tbody>`;
      for (const row of aggregatedRows) {
        const isAssigned = !!row.productId;
        const productDisplay = isAssigned
          ? `${esc(row.productName ?? '')}${row.productCode ? ` <span style="color:#64748b;font-size:8px">(${esc(row.productCode)})</span>` : ''}`
          : '<span style="color:#ef4444;font-weight:700">Nepřiřazeno</span>';
        const lineTotal = row.productPrice * row.quantity;
        const rowBg = isAssigned ? '' : 'background:#fff5f5';
        const roomBreak = row.roomBreakdown.length > 1
          ? `<div style="font-size:8px;color:#94a3b8;margin-top:2px">${row.roomBreakdown.map(rb => `${esc(rb.roomName || 'Nezařazeno')}: ${rb.count}`).join(' · ')}</div>`
          : '';
        sectionsHtml += `<tr style="${rowBg}"><td class="bold">${esc(row.elementTypeName)}${roomBreak}</td><td>${productDisplay}</td><td class="num">${row.quantity}</td>${showPrices && isAssigned ? `<td class="num">${fmt(row.productPrice)} Kč</td><td class="num blue">${fmt(lineTotal)} Kč</td>` : showPrices ? '<td class="num">—</td><td class="num">—</td>' : ''}</tr>`;
      }
      sectionsHtml += '</tbody></table></div>';
    }

    // Per-room element breakdown table
    if (allRooms.length > 0 && schematicSummary.elementRows.length > 0) {
      const roomElementMap = new Map<string, typeof schematicSummary.elementRows>();
      for (const row of schematicSummary.elementRows) {
        const key = row.roomId ?? '__none__';
        if (!roomElementMap.has(key)) roomElementMap.set(key, []);
        roomElementMap.get(key)!.push(row);
      }
      const elementsWithNotes = schematicSummary.elementRows.filter(r => {
        const el = designElements.find(e => r.elementIds.includes(e.id));
        return el && (el.note || el.label || el.circuit_id || el.mounting_height);
      });

      const circuitNameMap = new Map<string, string>();
      for (const floor of floors) {
        for (const circuit of (floor.circuits ?? [])) {
          circuitNameMap.set(circuit.id, circuit.name);
        }
      }

      if (roomElementMap.size > 0) {
        sectionsHtml += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin-bottom:8px">Přehled instalovaných prvků po místnostech</div>`;
        const sortedRooms = [...allRooms, { id: '__none__', name: 'Nezařazeno' }].filter(r => roomElementMap.has(r.id));
        for (const room of sortedRooms) {
          const rows = roomElementMap.get(room.id) ?? [];
          if (rows.length === 0) continue;
          sectionsHtml += `<div style="font-weight:700;font-size:9px;color:#334155;background:#f1f5f9;padding:4px 8px;margin-bottom:0;border-radius:4px 4px 0 0;border:1px solid #e2e8f0">${esc(room.name)}</div>`;
          sectionsHtml += `<table class="mat" style="margin-bottom:10px;border-radius:0 0 4px 4px"><thead><tr><th style="text-align:left">Prvek</th><th style="text-align:left">Produkt</th><th style="text-align:right">Mn.</th><th style="text-align:left">Okruh</th><th style="text-align:left">V.mont.</th><th style="text-align:left">Poznámka</th></tr></thead><tbody>`;
          for (const row of rows) {
            const el = designElements.find(e => row.elementIds.includes(e.id));
            const isAssigned = !!row.productId;
            const productCell = isAssigned
              ? `<span style="color:#059669;font-weight:600">${esc(row.productName ?? '')}</span>${row.productCode ? ` <span style="color:#94a3b8;font-size:8px">(${esc(row.productCode)})</span>` : ''}`
              : '<span style="color:#ef4444;font-size:8px">Nepřiřazeno</span>';
            const rowBg = isAssigned ? '' : 'background:#fff5f5';
            const circuitLabel = el?.circuit_id ? (circuitNameMap.get(el.circuit_id) ?? '—') : '—';
            sectionsHtml += `<tr style="${rowBg}"><td class="bold">${esc(row.elementTypeName)}${el?.label ? ` <span style="color:#64748b;font-size:8px">${esc(el.label)}</span>` : ''}</td><td>${productCell}</td><td class="num">${row.quantity}</td><td style="color:#64748b;font-size:8px">${esc(circuitLabel)}</td><td style="color:#64748b;font-size:8px">${esc(el?.mounting_height || '—')}</td><td style="color:#475569;font-size:8px">${esc(el?.note || '')}</td></tr>`;
          }
          sectionsHtml += '</tbody></table>';
        }
        sectionsHtml += '</div>';

        if (elementsWithNotes.length > 0) {
          sectionsHtml += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:6px">Prvky s poznámkami</div>`;
          sectionsHtml += `<table class="mat"><thead><tr><th style="text-align:left">Prvek</th><th style="text-align:left">Místnost</th><th style="text-align:left">Popis / Poznámka</th></tr></thead><tbody>`;
          for (const row of elementsWithNotes) {
            const el = designElements.find(e => row.elementIds.includes(e.id));
            if (!el) continue;
            const roomName = el.room_id ? (allRooms.find(r => r.id === el.room_id)?.name ?? '—') : '—';
            const detail = [el.label, el.note].filter(Boolean).join(' – ');
            sectionsHtml += `<tr><td class="bold">${esc(row.elementTypeName)}</td><td style="color:#64748b">${esc(roomName)}</td><td>${esc(detail)}</td></tr>`;
          }
          sectionsHtml += '</tbody></table></div>';
        }
      }
    }

    if (frameRows.length > 0) {
      sectionsHtml += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#14b8a6;margin-bottom:6px">Automaticky generované rámečky</div>`;
      sectionsHtml += `<table class="mat"><thead><tr><th style="text-align:left">Rámeček</th><th style="text-align:left">Řada</th><th style="text-align:right">Počet</th>${showPrices ? '<th style="text-align:right">Cena / ks</th><th style="text-align:right">Celkem</th>' : ''}</tr></thead><tbody>`;
      for (const frame of frameRows) {
        const orientLabel = frame.frameSize > 1 ? (frame.orientation === 'horizontal' ? ' H' : ' V') : '';
        const frameName = frame.targetProductName || `${frame.frameSize}R${orientLabel}${frame.colorName ? ` - ${frame.colorName}` : ''}`;
        const lineTotal = frame.unitPrice * frame.quantity;
        const fallbackBadge = !frame.hasMapping && frame.frameSize > 1 ? ' <span style="font-size:7px;color:#f59e0b;font-weight:700;text-transform:uppercase">(fallback)</span>' : '';
        sectionsHtml += `<tr><td class="bold">${esc(frameName)}${fallbackBadge}</td><td style="color:#64748b">${esc(frame.designSeriesName)}</td><td class="num">${frame.quantity}</td>${showPrices ? `<td class="num">${fmt(frame.unitPrice)} Kč</td><td class="num blue">${fmt(lineTotal)} Kč</td>` : ''}</tr>`;
      }
      sectionsHtml += '</tbody></table></div>';
    }

    if (moduleRows.length > 0) {
      sectionsHtml += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#3b82f6;margin-bottom:6px">Moduly vícerámečků</div>`;
      sectionsHtml += `<table class="mat"><thead><tr><th style="text-align:left">Modul</th><th style="text-align:left">Řada</th><th style="text-align:right">Počet</th>${showPrices ? '<th style="text-align:right">Cena / ks</th><th style="text-align:right">Celkem</th>' : ''}</tr></thead><tbody>`;
      for (const mod of moduleRows) {
        const moduleName = mod.productName || mod.moduleName;
        const lineTotal = mod.unitPrice * mod.quantity;
        const missingBadge = !mod.productId ? ' <span style="font-size:7px;color:#f59e0b;font-weight:700;text-transform:uppercase">(bez mapování)</span>' : '';
        sectionsHtml += `<tr><td class="bold">${esc(moduleName)}${missingBadge}</td><td style="color:#64748b">${esc(mod.designSeriesName)}</td><td class="num">${mod.quantity}</td>${showPrices && mod.productId ? `<td class="num">${fmt(mod.unitPrice)} Kč</td><td class="num blue">${fmt(lineTotal)} Kč</td>` : showPrices ? '<td class="num">—</td><td class="num">—</td>' : ''}</tr>`;
      }
      sectionsHtml += '</tbody></table></div>';
    }

    if (mountingGroups.length > 0) {
      sectionsHtml += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0"><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#8b5cf6;margin-bottom:6px">Detail vícerámečků (${mountingGroups.length})</div>`;
      sectionsHtml += `<table class="sm"><thead><tr><th>Označení</th><th>Velikost</th><th>Orientace</th><th>Řada</th><th>Slotů</th><th>Místnost</th></tr></thead><tbody>`;
      for (const mg of mountingGroups) {
        const slotCount = mg.slots.filter(s => s.element_id || s.module_name).length;
        const seriesProduct = mg.design_series_id ? products.find(p => p.id === mg.design_series_id) : null;
        const roomName = mg.room_id ? (allRooms.find(r => r.id === mg.room_id)?.name ?? '—') : '—';
        sectionsHtml += `<tr><td class="bold">${esc(mg.label || '—')}</td><td class="num">${mg.frame_size}R</td><td>${mg.orientation === 'horizontal' ? 'Vodorovně' : 'Svisle'}</td><td>${esc(seriesProduct?.name || '— bez řady')}</td><td class="num">${slotCount}/${mg.frame_size}</td><td style="color:#64748b">${esc(roomName)}</td></tr>`;
      }
      sectionsHtml += '</tbody></table></div>';
    }

    sectionsHtml += '</div>';
  }

  if (show('floorplans')) {
    for (const floor of floors.filter(f => f.floorplanImg)) {
      sectionsHtml += buildFullFloorplanHtml(floor, selected, products, categories, heatingSystems, roomIdToName, pinSize, designElements, elementTypes, mountingGroups, floors, schematicSymbolScale, categoryColorMap);
    }
  }

  if (show('trades')) {
    for (const trade of ALL_TRADES) {
      sectionsHtml += buildTradeSection(trade, floors, selected, products, categories, heatingSystems, roomIdToName, getWastePercent, getMaterialPrice, pinSize, showPrices);
    }
  }

  if (show('heating')) {
    sectionsHtml += buildHeatingCalcHtml(floors, heatingSystems, showPrices);
  }

  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<title>Souhrn projektu - ${esc(projectName || 'Projekt')}</title>
<style>${CSS}</style></head><body><div class="page">
<div class="brand-bar"></div>
<div class="hdr">
  <div class="hdr-left">
    <div class="doc-type">Souhrn projektu</div>
    <h1>${esc(projectName || 'Projekt')}</h1>
  </div>
  <div class="hdr-right">
    <div class="field"><div class="field-label">Datum</div><div class="field-value">${dateStr}</div></div>
    ${clientName ? `<div class="field"><div class="field-label">Klient</div><div class="field-value">${esc(clientName)}</div></div>` : ''}
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="lbl">Produktů</div><div class="val">${selectedProducts.length}</div></div>
  <div class="stat"><div class="lbl">Umístěno</div><div class="val">${totalPlacedCount}</div></div>
  ${fvIncluded && fvSummary && fvSummary.panelCount > 0 ? `<div class="stat"><div class="lbl">FV systém</div><div class="val">${fvSummary.totalKwp} kWp</div></div>` : ''}
  ${cameraIncluded && cameraSummary && cameraSummary.cameraCount > 0 ? `<div class="stat"><div class="lbl">Kamery</div><div class="val">${cameraSummary.cameraCount} ks</div></div>` : ''}
  ${epsIncluded && epsSummary && epsSummary.detectorCount > 0 ? `<div class="stat"><div class="lbl">EPS detektory</div><div class="val">${epsSummary.detectorCount} ks</div></div>` : ''}
  ${showPrices ? `<div class="stat"><div class="lbl">Cena celkem</div><div class="val">${combinedGrandTotal > 0 ? `${fmt(combinedGrandTotal)} Kč` : '—'}</div></div>` : ''}
</div>
${sectionsHtml}
<div class="footer-bar"><span>Vygenerováno: ${dateStr} | HouseSmart</span><span>${esc(projectName || '')}</span></div>
</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => { setTimeout(() => w.print(), 500); };
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm';
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iDoc) {
      iDoc.open();
      iDoc.write(html);
      iDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 600);
    }
  }
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
