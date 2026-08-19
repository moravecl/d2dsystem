export interface Point {
  x: number;
  y: number;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function arCorrectedDist(a: Point, b: Point, ar: number): number {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) / ar;
  return Math.sqrt(dx * dx + dy * dy);
}

function arCalibDist(scale: { p1: Point; p2: Point; aspectRatio?: number }): number {
  return arCorrectedDist(scale.p1, scale.p2, scale.aspectRatio ?? 1);
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distanceBetween(points[i - 1], points[i]);
  }
  return len;
}

export function normalizedToMeters(
  normalizedDist: number,
  scale: { p1: Point; p2: Point; realDistanceM: number; aspectRatio?: number }
): number {
  const calibDist = distanceBetween(scale.p1, scale.p2);
  if (calibDist === 0) return 0;
  return (normalizedDist / calibDist) * scale.realDistanceM;
}

export function polygonAreaNormalized(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y;
    area -= points[i].x * points[j].y;
  }
  return Math.abs(area) / 2;
}

export function polygonAreaM2(
  points: Point[],
  scale: { p1: Point; p2: Point; realDistanceM: number; aspectRatio?: number }
): number {
  const ar = scale.aspectRatio ?? 1;
  const corrected = points.map(p => ({ x: p.x, y: p.y / ar }));
  const normArea = polygonAreaNormalized(corrected);
  const calibDist = arCalibDist(scale);
  if (calibDist === 0) return 0;
  const meterPerUnit = scale.realDistanceM / calibDist;
  return normArea * meterPerUnit * meterPerUnit;
}

export function polylineLengthM(
  points: Point[],
  scale: { p1: Point; p2: Point; realDistanceM: number; aspectRatio?: number }
): number {
  if (points.length < 2) return 0;
  const ar = scale.aspectRatio ?? 1;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += arCorrectedDist(points[i - 1], points[i], ar);
  }
  const calibDist = arCalibDist(scale);
  if (calibDist === 0) return 0;
  return (len / calibDist) * scale.realDistanceM;
}

export function polygonPerimeterNormalized(points: Point[]): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    len += distanceBetween(points[i], next);
  }
  return len;
}

export function polygonPerimeterM(
  points: Point[],
  scale: { p1: Point; p2: Point; realDistanceM: number; aspectRatio?: number }
): number {
  const ar = scale.aspectRatio ?? 1;
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    len += arCorrectedDist(points[i], next, ar);
  }
  const calibDist = arCalibDist(scale);
  if (calibDist === 0) return 0;
  return (len / calibDist) * scale.realDistanceM;
}

export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

export function findRoomAtPoint(point: Point, rooms: { id: string; name: string; points: Point[] }[]): string | undefined {
  for (const room of rooms) {
    if (pointInPolygon(point, room.points)) return room.id;
  }
  return undefined;
}

export interface WallHit {
  roomId: string;
  wallIndex: number;
  position: number;
  distance: number;
  point: Point;
}

export function closestPointOnSegment(p: Point, a: Point, b: Point): { t: number; point: Point; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, point: { ...a }, dist: distanceBetween(p, a) };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, point: proj, dist: distanceBetween(p, proj) };
}

export function findClosestWall(
  clickPt: Point,
  rooms: { id: string; points: Point[] }[],
  maxDist = 0.04
): WallHit | null {
  let best: WallHit | null = null;
  for (const room of rooms) {
    const pts = room.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const { t, point, dist } = closestPointOnSegment(clickPt, a, b);
      if (dist < maxDist && (!best || dist < best.distance)) {
        best = { roomId: room.id, wallIndex: i, position: t, distance: dist, point };
      }
    }
  }
  return best;
}

export function getDoorWallPoints(
  roomPoints: Point[],
  wallIndex: number,
  position: number,
  widthM: number,
  scale: { p1: Point; p2: Point; realDistanceM: number }
): { center: Point; p1: Point; p2: Point; normal: Point; wallAngle: number } | null {
  const a = roomPoints[wallIndex];
  const b = roomPoints[(wallIndex + 1) % roomPoints.length];
  const cx = a.x + (b.x - a.x) * position;
  const cy = a.y + (b.y - a.y) * position;
  const calibDist = distanceBetween(scale.p1, scale.p2);
  if (calibDist === 0) return null;
  const meterInNorm = calibDist / scale.realDistanceM;
  const halfW = (widthM / 2) * meterInNorm;
  const wallDx = b.x - a.x;
  const wallDy = b.y - a.y;
  const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
  if (wallLen === 0) return null;
  const ux = wallDx / wallLen;
  const uy = wallDy / wallLen;
  return {
    center: { x: cx, y: cy },
    p1: { x: cx - ux * halfW, y: cy - uy * halfW },
    p2: { x: cx + ux * halfW, y: cy + uy * halfW },
    normal: { x: -uy, y: ux },
    wallAngle: Math.atan2(wallDy, wallDx),
  };
}

export const STANDARD_BEND_ANGLES = [15, 30, 45, 60, 90] as const;

export interface BendDetail {
  angle: number;
  rawAngle: number;
  point: Point;
}

function angleBetweenSegments(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (len1 === 0 || len2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return 180 - Math.acos(cos) * (180 / Math.PI);
}

function snapAngle(rawAngle: number): number {
  let nearest: number = STANDARD_BEND_ANGLES[0];
  let minDiff = Math.abs(rawAngle - nearest);
  for (const a of STANDARD_BEND_ANGLES) {
    const diff = Math.abs(rawAngle - a);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = a;
    }
  }
  return nearest;
}

export function analyzeBends(points: Point[]): BendDetail[] {
  const bends: BendDetail[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const rawAngle = angleBetweenSegments(points[i - 1], points[i], points[i + 1]);
    if (rawAngle > 5) {
      bends.push({ angle: snapAngle(rawAngle), rawAngle, point: points[i] });
    }
  }
  return bends;
}

export function countBends(points: Point[]): number {
  return analyzeBends(points).length;
}

export function getNearestWallAngle(
  point: Point,
  rooms: { id: string; points: Point[] }[],
  maxDist = 0.06
): number {
  let bestAngle = 0;
  let bestDist = Infinity;
  for (const room of rooms) {
    const pts = room.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const { dist } = closestPointOnSegment(point, a, b);
      if (dist < maxDist && dist < bestDist) {
        bestDist = dist;
        const wallDx = b.x - a.x;
        const wallDy = b.y - a.y;
        bestAngle = Math.atan2(wallDy, wallDx) * (180 / Math.PI);
      }
    }
  }
  return Math.round(bestAngle);
}

export function countTPieces(cables: { points: Point[] }[]): number {
  if (cables.length < 2) return 0;
  const threshold = 0.015;
  const endpoints: Point[] = [];
  for (const cable of cables) {
    if (cable.points.length >= 2) {
      endpoints.push(cable.points[0]);
      endpoints.push(cable.points[cable.points.length - 1]);
    }
  }

  const assigned = new Set<number>();
  let tCount = 0;

  for (let i = 0; i < endpoints.length; i++) {
    if (assigned.has(i)) continue;
    let clusterSize = 1;
    assigned.add(i);
    for (let j = i + 1; j < endpoints.length; j++) {
      if (assigned.has(j)) continue;
      if (distanceBetween(endpoints[i], endpoints[j]) < threshold) {
        clusterSize++;
        assigned.add(j);
      }
    }
    if (clusterSize >= 3) tCount++;
  }

  return tCount;
}
