import type { Point } from './geometry';
import { distanceBetween } from './geometry';

export type PipePattern = 'meandr' | 'spiral';

function signedArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return a / 2;
}

function normalize2D(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

function insetPolygon(polygon: Point[], distance: number): Point[] {
  const n = polygon.length;
  if (n < 3) return [];

  const area = signedArea(polygon);
  if (Math.abs(area) < 1e-12) return [];
  const sign = area > 0 ? 1 : -1;

  const offsetEdges: { p1: Point; p2: Point }[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    const norm = normalize2D({ x: sign * (-dy), y: sign * dx });
    offsetEdges.push({
      p1: { x: polygon[i].x + norm.x * distance, y: polygon[i].y + norm.y * distance },
      p2: { x: polygon[j].x + norm.x * distance, y: polygon[j].y + norm.y * distance },
    });
  }

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const e1 = offsetEdges[i];
    const e2 = offsetEdges[(i + 1) % n];
    const pt = lineIntersection(e1.p1, e1.p2, e2.p1, e2.p2);
    result.push(pt ?? e1.p2);
  }

  const newArea = Math.abs(signedArea(result));
  if (newArea < distance * distance * 0.1 || newArea > Math.abs(area)) return [];

  return result;
}

function scanlineIntersections(polygon: Point[], y: number): number[] {
  const xs: number[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = polygon[i];
    const p2 = polygon[j];
    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
      const t = (y - p1.y) / (p2.y - p1.y);
      xs.push(p1.x + t * (p2.x - p1.x));
    }
  }
  xs.sort((a, b) => a - b);
  return xs;
}

function generateMeander(polygon: Point[], spacingNorm: number): Point[] {
  const margin = spacingNorm * 0.5;
  const inner = insetPolygon(polygon, margin);
  if (inner.length < 3) return [];

  const ys = inner.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const path: Point[] = [];
  let leftToRight = true;
  let y = minY;

  while (y <= maxY) {
    const xs = scanlineIntersections(inner, y);
    if (xs.length >= 2) {
      if (leftToRight) {
        path.push({ x: xs[0], y });
        path.push({ x: xs[xs.length - 1], y });
      } else {
        path.push({ x: xs[xs.length - 1], y });
        path.push({ x: xs[0], y });
      }
    }
    leftToRight = !leftToRight;
    y += spacingNorm;
  }

  return path;
}

function resamplePolygon(polygon: Point[], maxSeg: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    result.push(curr);
    const segLen = distanceBetween(curr, next);
    if (segLen > maxSeg) {
      const segs = Math.ceil(segLen / maxSeg);
      for (let j = 1; j < segs; j++) {
        const t = j / segs;
        result.push({
          x: curr.x + (next.x - curr.x) * t,
          y: curr.y + (next.y - curr.y) * t,
        });
      }
    }
  }
  return result;
}

function closestIndexOnLoop(loop: Point[], target: Point): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const d = distanceBetween(loop[i], target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function rotateLoop(loop: Point[], startIdx: number): Point[] {
  return [...loop.slice(startIdx), ...loop.slice(0, startIdx)];
}

function generateSpiral(polygon: Point[], spacingNorm: number): Point[] {
  const margin = spacingNorm * 0.5;

  const levels: Point[][] = [];
  let current = insetPolygon(polygon, margin);

  while (current.length >= 3) {
    const a = Math.abs(signedArea(current));
    if (a < spacingNorm * spacingNorm * 0.3) break;
    levels.push(resamplePolygon(current, spacingNorm * 0.4));
    current = insetPolygon(current, spacingNorm);
  }

  if (levels.length === 0) return [];

  const path: Point[] = [];

  let entryPt = levels[0][0];
  for (let lvl = 0; lvl < levels.length; lvl++) {
    const startIdx = closestIndexOnLoop(levels[lvl], entryPt);
    const loop = rotateLoop(levels[lvl], startIdx);

    for (const p of loop) {
      path.push(p);
    }
    path.push(loop[0]);

    if (lvl < levels.length - 1) {
      entryPt = loop[0];
    }
  }

  return path;
}

export function generateHeatingPipes(
  roomPoints: Point[],
  spacingNorm: number,
  pattern: PipePattern
): Point[] {
  if (roomPoints.length < 3 || spacingNorm <= 0) return [];
  if (pattern === 'spiral') return generateSpiral(roomPoints, spacingNorm);
  return generateMeander(roomPoints, spacingNorm);
}

export function pipeSpacingToNorm(
  spacingMm: number,
  scale: { p1: Point; p2: Point; realDistanceM: number }
): number {
  const spacingM = spacingMm / 1000;
  const calibDist = distanceBetween(scale.p1, scale.p2);
  if (calibDist === 0 || scale.realDistanceM === 0) return 0;
  return (spacingM * calibDist) / scale.realDistanceM;
}
