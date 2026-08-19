import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Trash2, Image as ImageIcon, Upload, Ruler, RotateCcw, Grid3x3 as Grid3X3, Move, MousePointer, Hand } from 'lucide-react';
import type { RoofSurface } from '../../lib/fvCalculations';
import type { FvPanel } from '../../hooks/useFvCatalog';

interface MountingDrawConfig {
  showConstruction: boolean;
  hookSpacingMm: number;
}

interface Props {
  roof: RoofSurface;
  panel: FvPanel | null;
  mounting?: MountingDrawConfig;
  onUpdatePanelCount: (count: number) => void;
  onUpdatePoints?: (points: { x: number; y: number }[], scale?: RoofSurface['scale']) => void;
  onImageChange?: (imageUrl: string | null) => void;
  onUpdatePlacedPanels?: (panels: PlacedPanel[], fillRegion: { x: number; y: number }[]) => void;
  onSnapshotChange?: (dataUrl: string) => void;
}

type Mode = 'view' | 'draw' | 'panels' | 'scale' | 'fill' | 'delete' | 'moveField';

const FIELD_GAP_THRESHOLD_MM = 200;

interface PlacedPanel {
  x: number;
  y: number;
  rotated: boolean;
}

const PANEL_FILL = 'rgba(249,115,22,0.55)';
const PANEL_STROKE = '#ea580c';
const PANEL_SELECTED_STROKE = '#2563eb';
const ROOF_FILL = 'rgba(249,115,22,0.12)';
const ROOF_STROKE = '#f97316';
const FILL_FILL = 'rgba(16,185,129,0.18)';
const FILL_STROKE = '#10b981';
const SNAP_THRESHOLD = 8;

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function computeRoofAngle(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  let longestDist = 0;
  let longestAngle = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > longestDist) {
      longestDist = dist;
      longestAngle = Math.atan2(dy, dx);
    }
  }
  return longestAngle;
}

function snapPanel(
  panel: { x: number; y: number },
  existing: PlacedPanel[],
  getPanelSize: (rotated: boolean) => { w: number; h: number },
  getGaps: () => { gH: number; gV: number },
  isRotated: boolean,
): { x: number; y: number } {
  if (existing.length === 0) return panel;
  const sz = getPanelSize(isRotated);
  const gaps = getGaps();
  let bestX = panel.x;
  let bestY = panel.y;
  let snappedX = false;
  let snappedY = false;

  for (const ep of existing) {
    const esz = getPanelSize(ep.rotated);
    const rightEdge = ep.x + esz.w / 2 + gaps.gH + sz.w / 2;
    const leftEdge = ep.x - esz.w / 2 - gaps.gH - sz.w / 2;
    const bottomEdge = ep.y + esz.h / 2 + gaps.gV + sz.h / 2;
    const topEdge = ep.y - esz.h / 2 - gaps.gV - sz.h / 2;

    if (!snappedX && Math.abs(panel.x - rightEdge) < SNAP_THRESHOLD) { bestX = rightEdge; snappedX = true; }
    if (!snappedX && Math.abs(panel.x - leftEdge) < SNAP_THRESHOLD) { bestX = leftEdge; snappedX = true; }
    if (!snappedY && Math.abs(panel.y - ep.y) < SNAP_THRESHOLD) { bestY = ep.y; snappedY = true; }
    if (!snappedY && Math.abs(panel.y - bottomEdge) < SNAP_THRESHOLD) { bestY = bottomEdge; snappedY = true; }
    if (!snappedY && Math.abs(panel.y - topEdge) < SNAP_THRESHOLD) { bestY = topEdge; snappedY = true; }
    if (!snappedX && Math.abs(panel.x - ep.x) < SNAP_THRESHOLD) { bestX = ep.x; snappedX = true; }
  }

  return { x: bestX, y: bestY };
}

interface RowPanel {
  rx: number;
  ry: number;
  rotated: boolean;
  origIdx: number;
}

function splitRowIntoFields(
  rowPanels: RowPanel[],
  getPanelSizePx: (rotated: boolean) => { w: number; h: number },
  gapThresholdPx: number,
): RowPanel[][] {
  if (rowPanels.length <= 1) return [rowPanels];
  const sorted = [...rowPanels].sort((a, b) => a.rx - b.rx);
  const fields: RowPanel[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevHalfW = getPanelSizePx(prev.rotated).w / 2;
    const curHalfW = getPanelSizePx(cur.rotated).w / 2;
    const gap = cur.rx - curHalfW - (prev.rx + prevHalfW);
    if (gap > gapThresholdPx) {
      fields.push([cur]);
    } else {
      fields[fields.length - 1].push(cur);
    }
  }
  return fields;
}

function findFieldIndices(
  panels: PlacedPanel[],
  targetIdx: number,
  angle: number,
  getPanelSizePx: (rotated: boolean) => { w: number; h: number },
  getGapSizePx: () => { gH: number; gV: number },
): number[] {
  if (panels.length === 0 || targetIdx < 0) return [];
  const cosNeg = Math.cos(-angle);
  const sinNeg = Math.sin(-angle);
  const pSz0 = getPanelSizePx(false);
  const gaps = getGapSizePx();
  const maxGapH = Math.max(gaps.gH * 3, pSz0.w * 0.3);
  const maxGapV = pSz0.h + gaps.gV * 2;

  const rotated = panels.map((pp, idx) => ({
    rx: pp.x * cosNeg - pp.y * sinNeg,
    ry: pp.x * sinNeg + pp.y * cosNeg,
    idx,
  }));

  const visited = new Set<number>();
  const queue = [targetIdx];
  visited.add(targetIdx);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cr = rotated[cur];
    const curSz = getPanelSizePx(panels[cur].rotated);
    for (let i = 0; i < rotated.length; i++) {
      if (visited.has(i)) continue;
      const or = rotated[i];
      const oSz = getPanelSizePx(panels[i].rotated);
      const dx = Math.abs(or.rx - cr.rx);
      const dy = Math.abs(or.ry - cr.ry);
      const touchH = (curSz.w / 2 + oSz.w / 2) + maxGapH;
      const touchV = (curSz.h / 2 + oSz.h / 2) + maxGapV;
      const sameRow = dy < pSz0.h * 0.3 && dx < touchH;
      const adjRow = dy < touchV && dx < touchH;
      if (sameRow || adjRow) {
        visited.add(i);
        queue.push(i);
      }
    }
  }
  return Array.from(visited);
}

const RAIL_COLOR = 'rgba(100,116,139,0.7)';
const HOOK_COLOR = 'rgba(71,85,105,0.85)';

export default function RoofCanvas({ roof, panel, mounting, onUpdatePanelCount, onUpdatePoints, onImageChange, onUpdatePlacedPanels, onSnapshotChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [mode, setMode] = useState<Mode>('view');
  const [points, setPoints] = useState<{ x: number; y: number }[]>(roof.points ?? []);
  const [drawing, setDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 450 });
  const [placedPanels, setPlacedPanels] = useState<PlacedPanel[]>(roof.placedPanels ?? []);
  const [scalePoints, setScalePoints] = useState<{ x: number; y: number }[]>([]);
  const [scaleDist, setScaleDist] = useState('10');
  const [scale, setScale] = useState<RoofSurface['scale'] | undefined>(roof.scale);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('4/3');
  const [panelRotation, setPanelRotation] = useState<'portrait' | 'landscape'>('portrait');
  const [fillRegion, setFillRegion] = useState<{ x: number; y: number }[]>(roof.fillRegion ?? []);
  const [fillingDraw, setFillingDraw] = useState(false);
  const [fillTempPts, setFillTempPts] = useState<{ x: number; y: number }[]>([]);
  const [gapH, setGapH] = useState<number>(panel?.gap_h_mm ?? 20);
  const [gapV, setGapV] = useState<number>(panel?.gap_v_mm ?? 20);
  const [roofAngle, setRoofAngle] = useState(0);
  const [selectedPanelIdx, setSelectedPanelIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [fieldIndices, setFieldIndices] = useState<number[]>([]);
  const [draggingField, setDraggingField] = useState(false);

  useEffect(() => {
    setGapH(panel?.gap_h_mm ?? 20);
    setGapV(panel?.gap_v_mm ?? 20);
  }, [panel]);

  useEffect(() => {
    onUpdatePlacedPanels?.(placedPanels, fillRegion);
  }, [placedPanels, fillRegion]);

  useEffect(() => {
    if (points.length >= 3) {
      setRoofAngle(computeRoofAngle(points));
    }
  }, [points]);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!roof.imageUrl) {
      bgImageRef.current = null;
      setBgLoaded(false);
      setAspectRatio('4/3');
      return;
    }
    setBgLoaded(false);
    const img = new Image();
    img.onload = () => {
      bgImageRef.current = img;
      setBgLoaded(true);
      setAspectRatio(`${img.naturalWidth}/${img.naturalHeight}`);
    };
    img.onerror = () => {
      bgImageRef.current = null;
      setBgLoaded(false);
    };
    img.src = roof.imageUrl;
    return () => { img.onload = null; img.onerror = null; };
  }, [roof.imageUrl]);

  const getPanelSizePx = useCallback((rotated: boolean) => {
    const isLandscape = panelRotation === 'landscape';
    const flipped = isLandscape !== rotated;
    const defaultW = flipped ? 30 : 20;
    const defaultH = flipped ? 20 : 30;
    if (!panel || !scale || canvasSize.w === 0) return { w: defaultW, h: defaultH };
    const dx = (scale.p2.x - scale.p1.x);
    const dy = (scale.p2.y - scale.p1.y);
    const pixelDist = Math.sqrt((dx * canvasSize.w) ** 2 + (dy * canvasSize.h) ** 2);
    const pixelsPerM = pixelDist / scale.realDistanceM;
    const pixelsPerMm = pixelsPerM / 1000;
    const rawW = flipped ? panel.height_mm : panel.width_mm;
    const rawH = flipped ? panel.width_mm : panel.height_mm;
    return {
      w: Math.max(10, rawW * pixelsPerMm),
      h: Math.max(15, rawH * pixelsPerMm),
    };
  }, [panel, scale, canvasSize.w, canvasSize.h, panelRotation]);

  const getGapSizePx = useCallback(() => {
    if (!scale || canvasSize.w === 0) return { gH: 3, gV: 3 };
    const dx = (scale.p2.x - scale.p1.x);
    const dy = (scale.p2.y - scale.p1.y);
    const pixelDist = Math.sqrt((dx * canvasSize.w) ** 2 + (dy * canvasSize.h) ** 2);
    const pixelsPerM = pixelDist / scale.realDistanceM;
    const pixelsPerMm = pixelsPerM / 1000;
    return {
      gH: Math.max(1, gapH * pixelsPerMm),
      gV: Math.max(1, gapV * pixelsPerMm),
    };
  }, [scale, canvasSize.w, canvasSize.h, gapH, gapV]);

  const getFieldGapThresholdPx = useCallback(() => {
    if (!scale || canvasSize.w === 0) return 30;
    const dx = (scale.p2.x - scale.p1.x);
    const dy = (scale.p2.y - scale.p1.y);
    const pixelDist = Math.sqrt((dx * canvasSize.w) ** 2 + (dy * canvasSize.h) ** 2);
    const pxPerMm = pixelDist / (scale.realDistanceM * 1000);
    return FIELD_GAP_THRESHOLD_MM * pxPerMm;
  }, [scale, canvasSize.w, canvasSize.h]);

  const computeFillPanels = useCallback((region: { x: number; y: number }[], cw: number, ch: number) => {
    if (region.length < 3) return [];
    const pSz = getPanelSizePx(false);
    const gaps = getGapSizePx();
    const stepX = pSz.w + gaps.gH;
    const stepY = pSz.h + gaps.gV;

    const angle = computeRoofAngle(region);
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    const absRegion = region.map(p => ({ x: p.x * cw, y: p.y * ch }));
    const rotated = absRegion.map(p => ({
      x: p.x * cosA - p.y * sinA,
      y: p.x * sinA + p.y * cosA,
    }));

    const xs = rotated.map(p => p.x);
    const ys = rotated.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const cosB = Math.cos(angle);
    const sinB = Math.sin(angle);

    const result: PlacedPanel[] = [];
    for (let py = minY + pSz.h / 2; py < maxY; py += stepY) {
      for (let px = minX + pSz.w / 2; px < maxX; px += stepX) {
        const corners = [
          { x: px - pSz.w / 2, y: py - pSz.h / 2 },
          { x: px + pSz.w / 2, y: py - pSz.h / 2 },
          { x: px - pSz.w / 2, y: py + pSz.h / 2 },
          { x: px + pSz.w / 2, y: py + pSz.h / 2 },
          { x: px, y: py },
        ];
        const allInside = corners.every(c => {
          const rx = c.x * cosB - c.y * sinB;
          const ry = c.x * sinB + c.y * cosB;
          return pointInPolygon(rx, ry, absRegion);
        });
        if (allInside) {
          const rx = px * cosB - py * sinB;
          const ry = px * sinB + py * cosB;
          result.push({ x: rx, y: ry, rotated: false });
        }
      }
    }
    return result;
  }, [getPanelSizePx, getGapSizePx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bgImageRef.current && bgLoaded) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    const allPts = drawing ? [...tempPoints] : points;

    if (allPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(allPts[0].x * canvas.width, allPts[0].y * canvas.height);
      for (let i = 1; i < allPts.length; i++) {
        ctx.lineTo(allPts[i].x * canvas.width, allPts[i].y * canvas.height);
      }
      if (!drawing) ctx.closePath();
      ctx.fillStyle = ROOF_FILL;
      ctx.fill();
      ctx.strokeStyle = ROOF_STROKE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const activeFillPts = fillingDraw ? fillTempPts : fillRegion;
    if (activeFillPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(activeFillPts[0].x * canvas.width, activeFillPts[0].y * canvas.height);
      for (let i = 1; i < activeFillPts.length; i++) {
        ctx.lineTo(activeFillPts[i].x * canvas.width, activeFillPts[i].y * canvas.height);
      }
      if (!fillingDraw) ctx.closePath();
      ctx.fillStyle = FILL_FILL;
      ctx.fill();
      ctx.strokeStyle = FILL_STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const angle = roofAngle;

    const fieldGapPx = getFieldGapThresholdPx();

    if (mounting?.showConstruction && placedPanels.length > 0 && panel) {
      const pSz0 = getPanelSizePx(false);
      const railOffset = pSz0.h / 4;
      const hookSpacingPx = (() => {
        if (!scale || !mounting.hookSpacingMm) return 40;
        const dx = (scale.p2.x - scale.p1.x);
        const dy = (scale.p2.y - scale.p1.y);
        const pixelDist = Math.sqrt((dx * canvas.width) ** 2 + (dy * canvas.height) ** 2);
        const pxPerMm = pixelDist / (scale.realDistanceM * 1000);
        return Math.max(12, mounting.hookSpacingMm * pxPerMm);
      })();

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cosNeg = Math.cos(-angle);
      const sinNeg = Math.sin(-angle);

      const rotated: RowPanel[] = placedPanels.map((pp, idx) => ({
        rx: pp.x * cosNeg - pp.y * sinNeg,
        ry: pp.x * sinNeg + pp.y * cosNeg,
        rotated: pp.rotated,
        origIdx: idx,
      }));

      const uniqueRows: number[] = [];
      for (const r of rotated) {
        const ry = Math.round(r.ry);
        if (!uniqueRows.some(ur => Math.abs(ur - ry) < pSz0.h * 0.3)) {
          uniqueRows.push(ry);
        }
      }

      for (const rowY of uniqueRows) {
        const rowPanels = rotated.filter(r => Math.abs(Math.round(r.ry) - rowY) < pSz0.h * 0.3);
        if (rowPanels.length === 0) continue;

        const fields = splitRowIntoFields(rowPanels, getPanelSizePx, fieldGapPx);

        for (const field of fields) {
          const fieldMinX = Math.min(...field.map(r => r.rx - getPanelSizePx(r.rotated).w / 2)) - 4;
          const fieldMaxX = Math.max(...field.map(r => r.rx + getPanelSizePx(r.rotated).w / 2)) + 4;

          const rail1Y = rowY - railOffset;
          const rail2Y = rowY + railOffset;

          for (const ry of [rail1Y, rail2Y]) {
            const p1x = fieldMinX * cosA - ry * sinA;
            const p1y = fieldMinX * sinA + ry * cosA;
            const p2x = fieldMaxX * cosA - ry * sinA;
            const p2y = fieldMaxX * sinA + ry * cosA;

            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.strokeStyle = RAIL_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();

            const railLen = fieldMaxX - fieldMinX;
            const hookCount = Math.max(2, Math.ceil(railLen / hookSpacingPx) + 1);
            const actualSpacing = railLen / (hookCount - 1);
            for (let hi = 0; hi < hookCount; hi++) {
              const hx = fieldMinX + hi * actualSpacing;
              const absHx = hx * cosA - ry * sinA;
              const absHy = hx * sinA + ry * cosA;
              ctx.beginPath();
              ctx.arc(absHx, absHy, 3, 0, Math.PI * 2);
              ctx.fillStyle = HOOK_COLOR;
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }
    }

    const isDeleteMode = mode === 'delete';
    const isMoveFieldMode = mode === 'moveField';
    const fieldSet = new Set(fieldIndices);

    for (let pi = 0; pi < placedPanels.length; pi++) {
      const p = placedPanels[pi];
      const pSz = getPanelSizePx(p.rotated);
      const isSelected = pi === selectedPanelIdx;
      const isInField = isMoveFieldMode && fieldSet.has(pi);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      const px = -pSz.w / 2;
      const py = -pSz.h / 2;

      ctx.fillStyle = isDeleteMode
        ? 'rgba(239,68,68,0.35)'
        : isInField
          ? 'rgba(59,130,246,0.45)'
          : PANEL_FILL;
      ctx.fillRect(px, py, pSz.w, pSz.h);
      ctx.strokeStyle = isSelected
        ? PANEL_SELECTED_STROKE
        : isInField
          ? '#3b82f6'
          : isDeleteMode
            ? '#ef4444'
            : PANEL_STROKE;
      ctx.lineWidth = isSelected || isInField ? 2.5 : 1.5;
      ctx.strokeRect(px, py, pSz.w, pSz.h);

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      for (let r = 1; r < 3; r++) {
        const ly = py + (pSz.h / 3) * r;
        ctx.beginPath();
        ctx.moveTo(px, ly);
        ctx.lineTo(px + pSz.w, ly);
        ctx.stroke();
      }
      const lx = px + pSz.w / 2;
      ctx.beginPath();
      ctx.moveTo(lx, py);
      ctx.lineTo(lx, py + pSz.h);
      ctx.stroke();

      ctx.restore();
    }

    if (mounting?.showConstruction && placedPanels.length > 0 && panel) {
      const pSz0 = getPanelSizePx(false);
      const railOff = pSz0.h / 4;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cosNeg = Math.cos(-angle);
      const sinNeg = Math.sin(-angle);

      const rot: RowPanel[] = placedPanels.map((pp, idx) => ({
        rx: pp.x * cosNeg - pp.y * sinNeg,
        ry: pp.x * sinNeg + pp.y * cosNeg,
        rotated: pp.rotated,
        origIdx: idx,
      }));

      const uRows: number[] = [];
      for (const r of rot) {
        const ry = Math.round(r.ry);
        if (!uRows.some(ur => Math.abs(ur - ry) < pSz0.h * 0.3)) uRows.push(ry);
      }

      const MID_CLR = 'rgba(234,88,12,0.85)';
      const END_CLR = 'rgba(37,99,235,0.85)';

      for (const rowY of uRows) {
        const rowP = rot.filter(r => Math.abs(Math.round(r.ry) - rowY) < pSz0.h * 0.3);
        if (rowP.length < 1) continue;

        const fields = splitRowIntoFields(rowP, getPanelSizePx, fieldGapPx);

        for (const field of fields) {
          field.sort((a, b) => a.rx - b.rx);

          for (const railY of [rowY - railOff, rowY + railOff]) {
            const edgeLeft = field[0].rx - getPanelSizePx(field[0].rotated).w / 2;
            const edgeRight = field[field.length - 1].rx + getPanelSizePx(field[field.length - 1].rotated).w / 2;

            for (const ex of [edgeLeft, edgeRight]) {
              const ax = ex * cosA - railY * sinA;
              const ay = ex * sinA + railY * cosA;
              ctx.save();
              ctx.translate(ax, ay);
              ctx.rotate(angle);
              ctx.fillStyle = END_CLR;
              ctx.fillRect(-2, -4, 4, 8);
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(-2, -4, 4, 8);
              ctx.restore();
            }

            for (let i = 0; i < field.length - 1; i++) {
              const rightEdge = field[i].rx + getPanelSizePx(field[i].rotated).w / 2;
              const leftEdge = field[i + 1].rx - getPanelSizePx(field[i + 1].rotated).w / 2;
              const mx = (rightEdge + leftEdge) / 2;
              const ax = mx * cosA - railY * sinA;
              const ay = mx * sinA + railY * cosA;
              ctx.save();
              ctx.translate(ax, ay);
              ctx.rotate(angle);
              ctx.fillStyle = MID_CLR;
              ctx.beginPath();
              ctx.moveTo(-3, -4);
              ctx.lineTo(3, -4);
              ctx.lineTo(3, 4);
              ctx.lineTo(-3, 4);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 0.5;
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }
    }

    for (const pt of allPts) {
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
    }

    for (const pt of activeFillPts) {
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
    }

    if (scalePoints.length > 0) {
      for (const sp of scalePoints) {
        ctx.beginPath();
        ctx.arc(sp.x * canvas.width, sp.y * canvas.height, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sp.x * canvas.width, sp.y * canvas.height, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
      }
      if (scalePoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(scalePoints[0].x * canvas.width, scalePoints[0].y * canvas.height);
        ctx.lineTo(scalePoints[1].x * canvas.width, scalePoints[1].y * canvas.height);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (scale) {
          const mx = ((scalePoints[0].x + scalePoints[1].x) / 2) * canvas.width;
          const my = ((scalePoints[0].y + scalePoints[1].y) / 2) * canvas.height;
          ctx.font = 'bold 11px system-ui';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 3;
          const text = `${scale.realDistanceM} m`;
          ctx.strokeText(text, mx + 8, my - 4);
          ctx.fillText(text, mx + 8, my - 4);
        }
      }
    }

    if (onSnapshotChange && placedPanels.length > 0) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        onSnapshotChange(dataUrl);
      } catch {
      }
    }
  }, [points, placedPanels, drawing, tempPoints, scalePoints, canvasSize, getPanelSizePx, bgLoaded, scale, fillRegion, fillingDraw, fillTempPts, roofAngle, selectedPanelIdx, mounting, panel, mode, fieldIndices, getFieldGapThresholdPx, onSnapshotChange]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const findPanelAt = (absX: number, absY: number): number => {
    const angle = roofAngle;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);
    for (let i = placedPanels.length - 1; i >= 0; i--) {
      const p = placedPanels[i];
      const sz = getPanelSizePx(p.rotated);
      const dx = absX - p.x;
      const dy = absY - p.y;
      const localX = dx * cosA - dy * sinA;
      const localY = dx * sinA + dy * cosA;
      if (Math.abs(localX) < sz.w / 2 + 4 && Math.abs(localY) < sz.h / 2 + 4) {
        return i;
      }
    }
    return -1;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const absX = pt.x * canvasSize.w;
    const absY = pt.y * canvasSize.h;

    if (mode === 'panels') {
      const idx = findPanelAt(absX, absY);
      if (idx >= 0) {
        setSelectedPanelIdx(idx);
        setDraggingIdx(idx);
        setDragStart({ x: absX, y: absY });
        e.preventDefault();
      }
      return;
    }

    if (mode === 'moveField') {
      const idx = findPanelAt(absX, absY);
      if (idx >= 0) {
        const fi = findFieldIndices(placedPanels, idx, roofAngle, getPanelSizePx, getGapSizePx);
        setFieldIndices(fi);
        setDraggingField(true);
        setDragStart({ x: absX, y: absY });
        e.preventDefault();
      }
      return;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStart === null) return;
    const pt = getCanvasPoint(e);
    const absX = pt.x * canvasSize.w;
    const absY = pt.y * canvasSize.h;
    const dx = absX - dragStart.x;
    const dy = absY - dragStart.y;

    if (draggingField && fieldIndices.length > 0) {
      const next = [...placedPanels];
      for (const fi of fieldIndices) {
        next[fi] = { ...next[fi], x: next[fi].x + dx, y: next[fi].y + dy };
      }
      setPlacedPanels(next);
      setDragStart({ x: absX, y: absY });
      return;
    }

    if (draggingIdx !== null) {
      const p = placedPanels[draggingIdx];
      const newPos = { x: p.x + dx, y: p.y + dy };
      const others = placedPanels.filter((_, i) => i !== draggingIdx);
      const snapped = snapPanel(newPos, others, getPanelSizePx, getGapSizePx, p.rotated);
      const next = [...placedPanels];
      next[draggingIdx] = { ...p, x: snapped.x, y: snapped.y };
      setPlacedPanels(next);
      setDragStart({ x: absX, y: absY });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingIdx(null);
    setDraggingField(false);
    setDragStart(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === 'scale') {
      if (scalePoints.length === 0) {
        setScalePoints([pt]);
      } else if (scalePoints.length === 1) {
        setScalePoints(prev => [...prev, pt]);
      }
      return;
    }

    if (mode === 'draw') {
      if (!drawing) { setDrawing(true); setTempPoints([pt]); return; }
      const first = tempPoints[0];
      const dx = (pt.x - first.x) * canvas.width;
      const dy = (pt.y - first.y) * canvas.height;
      if (tempPoints.length > 2 && Math.sqrt(dx * dx + dy * dy) < 14) {
        const finalPoints = tempPoints;
        setPoints(finalPoints);
        setDrawing(false);
        setTempPoints([]);
        onUpdatePoints?.(finalPoints, scale);
        setMode('view');
        return;
      }
      setTempPoints(prev => [...prev, pt]);
      return;
    }

    if (mode === 'fill') {
      if (!fillingDraw) {
        setFillingDraw(true);
        setFillTempPts([pt]);
        return;
      }
      const first = fillTempPts[0];
      const dx = (pt.x - first.x) * canvas.width;
      const dy = (pt.y - first.y) * canvas.height;
      if (fillTempPts.length > 2 && Math.sqrt(dx * dx + dy * dy) < 14) {
        const region = fillTempPts;
        setFillRegion(region);
        setFillingDraw(false);
        setFillTempPts([]);
        const filled = computeFillPanels(region, canvas.width, canvas.height);
        setPlacedPanels(filled);
        onUpdatePanelCount(filled.length);
        return;
      }
      setFillTempPts(prev => [...prev, pt]);
      return;
    }

    if (mode === 'delete') {
      const absX = pt.x * canvas.width;
      const absY = pt.y * canvas.height;
      const idx = findPanelAt(absX, absY);
      if (idx >= 0) {
        const next = placedPanels.filter((_, i) => i !== idx);
        setPlacedPanels(next);
        onUpdatePanelCount(next.length);
      }
      return;
    }

    if (mode === 'moveField') {
      if (draggingField) return;
      const absX = pt.x * canvas.width;
      const absY = pt.y * canvas.height;
      const idx = findPanelAt(absX, absY);
      if (idx >= 0) {
        const fi = findFieldIndices(placedPanels, idx, roofAngle, getPanelSizePx, getGapSizePx);
        setFieldIndices(fi);
      } else {
        setFieldIndices([]);
      }
      return;
    }

    if (mode === 'panels') {
      if (draggingIdx !== null) return;
      const absX = pt.x * canvas.width;
      const absY = pt.y * canvas.height;
      const clickedIdx = findPanelAt(absX, absY);
      if (clickedIdx >= 0) {
        setSelectedPanelIdx(clickedIdx);
      } else {
        const newPanel: PlacedPanel = { x: absX, y: absY, rotated: false };
        const snapped = snapPanel(newPanel, placedPanels, getPanelSizePx, getGapSizePx, false);
        const next = [...placedPanels, { x: snapped.x, y: snapped.y, rotated: false }];
        setPlacedPanels(next);
        onUpdatePanelCount(next.length);
        setSelectedPanelIdx(next.length - 1);
      }
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPanelIdx === null) return;
    const next = placedPanels.filter((_, i) => i !== selectedPanelIdx);
    setPlacedPanels(next);
    onUpdatePanelCount(next.length);
    setSelectedPanelIdx(null);
  };

  const handleRotateSelected = () => {
    if (selectedPanelIdx === null) return;
    const next = [...placedPanels];
    next[selectedPanelIdx] = { ...next[selectedPanelIdx], rotated: !next[selectedPanelIdx].rotated };
    setPlacedPanels(next);
  };

  const finishScale = () => {
    if (scalePoints.length !== 2) return;
    const dist = parseFloat(scaleDist);
    if (!dist || dist <= 0) return;
    const s = { p1: scalePoints[0], p2: scalePoints[1], realDistanceM: dist };
    setScale(s);
    onUpdatePoints?.(points, s);
    setMode('view');
  };

  const clearRoof = () => {
    setPoints([]);
    setDrawing(false);
    setTempPoints([]);
    setPlacedPanels([]);
    setFillRegion([]);
    setFillingDraw(false);
    setFillTempPts([]);
    setSelectedPanelIdx(null);
    onUpdatePanelCount(0);
    onUpdatePoints?.([], scale);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setScale(undefined);
      setScalePoints([]);
      setMode('scale');
      onImageChange?.(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const refillWithGaps = () => {
    const canvas = canvasRef.current;
    if (!canvas || fillRegion.length < 3) return;
    const filled = computeFillPanels(fillRegion, canvas.width, canvas.height);
    setPlacedPanels(filled);
    onUpdatePanelCount(filled.length);
    setSelectedPanelIdx(null);
  };

  const hasImage = !!roof.imageUrl;
  const needsScale = hasImage && !scale;
  const canRefill = fillRegion.length >= 3;

  const MODES: { id: Mode; label: string; icon?: typeof Move }[] = [
    { id: 'view', label: 'Prohlížet' },
    { id: 'draw', label: 'Kreslit střechu' },
    { id: 'fill', label: 'Vyplnit panely', icon: Grid3X3 },
    { id: 'panels', label: 'Ruční panely', icon: Move },
    { id: 'moveField', label: 'Posunout pole', icon: Hand },
    { id: 'delete', label: 'Mazat panely', icon: MousePointer },
    { id: 'scale', label: 'Měřítko', icon: Ruler },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {MODES.map(m => {
          const disabled = needsScale && m.id !== 'scale';
          return (
            <button
              key={m.id}
              onClick={() => { if (disabled) return; setMode(m.id); setDrawing(false); setTempPoints([]); setFillingDraw(false); setFillTempPts([]); setSelectedPanelIdx(null); setFieldIndices([]); setDraggingField(false); }}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 ${
                mode === m.id
                  ? m.id === 'delete' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                  : disabled
                  ? 'bg-white/[0.06] text-slate-300 cursor-not-allowed'
                  : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}
            >
              {m.icon && <m.icon className="w-3 h-3" />}
              {m.label}
            </button>
          );
        })}

        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

        <label className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-white/[0.06] text-slate-400 hover:bg-white/[0.08] transition cursor-pointer flex items-center gap-1">
          {hasImage ? <ImageIcon className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
          {hasImage ? 'Změnit foto' : 'Nahrát foto'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        {hasImage && (
          <button
            onClick={() => onImageChange?.(null)}
            className="px-2 py-1 rounded-lg text-[10px] font-extrabold text-red-500 hover:bg-red-500/10 transition flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Foto
          </button>
        )}

        {points.length > 0 && (
          <button
            onClick={clearRoof}
            className="px-2 py-1 rounded-lg text-[10px] font-extrabold text-red-500 hover:bg-red-500/10 transition flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Smazat vše
          </button>
        )}

        {(mode === 'panels' || mode === 'fill') && (
          <>
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            <button
              onClick={() => setPanelRotation(r => r === 'portrait' ? 'landscape' : 'portrait')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-white/[0.06] text-slate-400 hover:bg-white/[0.08] transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {panelRotation === 'portrait' ? 'Na šířku' : 'Na výšku'}
            </button>
          </>
        )}
      </div>

      {mode === 'panels' && selectedPanelIdx !== null && (
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-2 flex items-center gap-2 text-[10px] font-extrabold text-blue-400">
          <span>Panel #{selectedPanelIdx + 1}</span>
          <button
            onClick={handleRotateSelected}
            className="px-2 py-0.5 bg-blue-500/20 hover:bg-blue-200 rounded-lg transition flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Otočit panel
          </button>
          <button
            onClick={handleDeleteSelected}
            className="px-2 py-0.5 bg-red-500/20 hover:bg-red-200 text-red-400 rounded-lg transition flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Smazat
          </button>
          <span className="text-blue-500 ml-auto">Tažením přesuňte panel</span>
        </div>
      )}

      {mode === 'delete' && (
        <div className="bg-red-500/10 border border-red-200 rounded-xl p-2 text-[10px] font-extrabold text-red-400">
          Kliknutím na panel ho odeberete. Každý klik smaže jeden panel.
        </div>
      )}

      {mode === 'moveField' && (
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-2 text-[10px] font-extrabold text-blue-400">
          {fieldIndices.length > 0
            ? `Vybráno pole ${fieldIndices.length} panelů. Tažením posunete celé pole.`
            : 'Klikněte na panel pro výběr pole. Tažením posunete všechny panely v poli.'}
        </div>
      )}

      {mode === 'fill' && (
        <div className="bg-emerald-500/10 border border-emerald-200 rounded-xl p-2.5 space-y-2">
          <div className="text-[10px] font-extrabold text-emerald-400">
            {!fillingDraw && fillRegion.length === 0 && 'Nakreslete oblast pro automatické vyplnění panely. Klikejte body, posledním kliknutím blízko prvního bodu uzavřete oblast.'}
            {fillingDraw && `${fillTempPts.length} bodů – klikni blízko prvního bodu pro uzavření.`}
            {!fillingDraw && fillRegion.length > 0 && `Oblast nastavena – ${placedPanels.length} panelů. Panely jsou zarovnány podle úhlu střechy. Změňte mezery a klikněte "Přepočítat".`}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-extrabold text-emerald-400">Mezera H:</label>
              <input
                type="number"
                className="w-14 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-medium bg-white/[0.06] text-emerald-900"
                value={gapH}
                min="0"
                onChange={e => setGapH(parseInt(e.target.value) || 0)}
              />
              <span className="text-[10px] text-emerald-400 font-extrabold">mm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-extrabold text-emerald-400">Mezera V:</label>
              <input
                type="number"
                className="w-14 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-medium bg-white/[0.06] text-emerald-900"
                value={gapV}
                min="0"
                onChange={e => setGapV(parseInt(e.target.value) || 0)}
              />
              <span className="text-[10px] text-emerald-400 font-extrabold">mm</span>
            </div>
            {canRefill && (
              <button
                onClick={refillWithGaps}
                className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold hover:bg-emerald-700 transition"
              >
                <Grid3X3 className="w-3 h-3" /> Přepočítat
              </button>
            )}
            {canRefill && (
              <button
                onClick={() => { setFillRegion([]); setPlacedPanels([]); onUpdatePanelCount(0); setSelectedPanelIdx(null); }}
                className="flex items-center gap-1 text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg text-[10px] font-extrabold transition"
              >
                <X className="w-3 h-3" /> Reset oblasti
              </button>
            )}
          </div>
          {!scale && (
            <div className="text-[10px] text-amber-400 font-extrabold">
              Bez nastaveného měřítka se použije odhadovaná velikost panelů. Nastavte nejprve měřítko pro přesné výsledky.
            </div>
          )}
        </div>
      )}

      {mode === 'scale' && (
        <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-2.5 text-xs font-extrabold text-blue-400 space-y-2">
          {scalePoints.length === 0 && 'Klikněte na dva body se známou vzdáleností.'}
          {scalePoints.length === 1 && 'Klikněte na druhý bod.'}
          {scalePoints.length === 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span>Vzdálenost mezi body:</span>
              <input
                type="number"
                className="w-20 border border-blue-300 rounded-lg px-2 py-1 text-xs font-medium bg-white/[0.06]"
                value={scaleDist}
                onChange={e => setScaleDist(e.target.value)}
                placeholder="m"
                autoFocus
              />
              <span className="text-xs">m</span>
              <button onClick={finishScale} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-lg text-xs font-extrabold">
                <Check className="w-3 h-3" /> OK
              </button>
              <button onClick={() => setScalePoints([])} className="p-1 text-blue-500 hover:text-blue-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {scale && <div className="text-[10px] text-blue-500 font-extrabold">Měřítko nastaveno: {scale.realDistanceM} m</div>}
        </div>
      )}

      {mode === 'panels' && !scale && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-2.5 text-[10px] font-extrabold text-amber-400">
          Bez měřítka budou panely v defaultní velikosti. Přepněte na "Měřítko" pro přesné rozměry.
        </div>
      )}

      {mode === 'draw' && (
        <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-2 text-[10px] font-extrabold text-orange-700">
          {!drawing ? 'Klikni pro první bod střechy.' : `${tempPoints.length} bodů – klikni blízko prvního bodu pro uzavření.`}
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
          mode === 'draw' ? 'border-orange-300' :
          mode === 'scale' ? 'border-blue-300' :
          mode === 'panels' ? 'border-amber-300' :
          mode === 'fill' ? 'border-emerald-300' :
          mode === 'delete' ? 'border-red-300' :
          mode === 'moveField' ? 'border-blue-300' :
          'border-white/10'
        } ${hasImage ? 'bg-slate-900' : 'bg-white/[0.04]'}`}
        style={{
          aspectRatio,
          cursor: mode === 'draw' || mode === 'scale' || mode === 'fill' ? 'crosshair'
            : mode === 'panels' ? (draggingIdx !== null ? 'grabbing' : 'cell')
            : mode === 'delete' ? 'crosshair'
            : mode === 'moveField' ? (draggingField ? 'grabbing' : 'grab')
            : 'default',
        }}
      >
        <canvas
          ref={canvasRef}
          data-roof-id={roof.id}
          width={canvasSize.w}
          height={canvasSize.h}
          className="w-full h-full"
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
        {needsScale && mode !== 'scale' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center z-10">
            <div className="bg-navy-800/60 rounded-2xl shadow-xl p-5 max-w-xs text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 mx-auto flex items-center justify-center mb-2">
                <Ruler className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-xs font-extrabold text-white mb-1">Nastavte měřítko</div>
              <div className="text-[10px] text-slate-500 mb-3">Pro správné rozměry panelů je nutné nejprve zkalibrovat měřítko na fotografii.</div>
              <button
                onClick={() => { setMode('scale'); setScalePoints([]); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 mx-auto"
              >
                <Ruler className="w-3.5 h-3.5" /> Kalibrovat měřítko
              </button>
            </div>
          </div>
        )}
        {!hasImage && placedPanels.length === 0 && mode === 'view' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className="w-full h-full border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-3 p-6 cursor-pointer pointer-events-auto hover:border-orange-300 hover:bg-orange-500/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-extrabold text-slate-500">Nahrajte fotografii střechy</p>
                <p className="text-[10px] text-slate-400 mt-0.5">nebo kreslete ručně přepnutím na "Kreslit střechu"</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500">
        <div className="flex items-center gap-3">
          <span>{placedPanels.length} panelů umístěno</span>
          {panel && <span className="text-orange-600">{Math.round(placedPanels.length * panel.power_wp / 1000 * 100) / 100} kWp</span>}
        </div>
        <div className="flex items-center gap-2">
          {points.length >= 3 && (
            <span className="text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md">
              Úhel střechy: {Math.round(roofAngle * 180 / Math.PI)}°
            </span>
          )}
          {scale && (
            <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">
              Měřítko: {scale.realDistanceM} m
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
