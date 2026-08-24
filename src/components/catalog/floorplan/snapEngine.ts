import type { Point } from './geometry';
import { closestPointOnSegment, distanceBetween } from './geometry';
import type { FloorScale } from '../../../hooks/useProjectState';

export interface SnapGuide {
  type: 'wall-distance' | 'wall-along' | 'align-x' | 'align-y' | 'spacing';
  from: Point;
  to: Point;
  distCm: number | null;
  offset?: number;
}

export interface SnapResult {
  snapped: Point;
  guides: SnapGuide[];
}

interface SnapConfig {
  wallThreshold: number;
  alignThreshold: number;
  rooms: { id: string; points: Point[] }[];
  otherPins: Point[];
  lightMode: boolean;
  scale?: FloorScale;
}

function normToCm(dist: number, scale?: FloorScale): number | null {
  if (!scale) return null;
  const calibDist = distanceBetween(scale.p1, scale.p2);
  if (calibDist === 0) return null;
  return Math.round((dist / calibDist) * scale.realDistanceM * 100);
}

interface WallInfo {
  a: Point;
  b: Point;
  proj: Point;
  dist: number;
  t: number;
  nx: number;
  ny: number;
  ux: number;
  uy: number;
}

function findNearestWalls(raw: Point, rooms: { id: string; points: Point[] }[], threshold: number): WallInfo[] {
  const walls: WallInfo[] = [];
  for (const room of rooms) {
    const pts = room.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const { point: proj, dist, t } = closestPointOnSegment(raw, a, b);
      if (dist < threshold) {
        const wallDx = b.x - a.x;
        const wallDy = b.y - a.y;
        const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
        if (wallLen > 0) {
          walls.push({
            a, b, proj, dist, t,
            ux: wallDx / wallLen,
            uy: wallDy / wallLen,
            nx: -wallDy / wallLen,
            ny: wallDx / wallLen,
          });
        }
      }
    }
  }
  walls.sort((a, b) => a.dist - b.dist);
  return walls;
}

export function computeSnap(raw: Point, cfg: SnapConfig): SnapResult {
  const guides: SnapGuide[] = [];
  let sx = raw.x;
  let sy = raw.y;

  const walls = findNearestWalls(raw, cfg.rooms, cfg.wallThreshold);
  const bestWall = walls[0] ?? null;

  if (bestWall) {
    const { proj, nx, ny, a, b, ux, uy } = bestWall;
    const offset = 0.008;
    const dot = (raw.x - proj.x) * nx + (raw.y - proj.y) * ny;
    const sign = dot >= 0 ? 1 : -1;
    sx = proj.x + nx * offset * sign;
    sy = proj.y + ny * offset * sign;

    const perpDimOffset = 0.015 * sign;

    const dimLineY1 = proj.x + nx * perpDimOffset;
    const dimLineY2 = proj.y + ny * perpDimOffset;

    guides.push({
      type: 'wall-distance',
      from: proj,
      to: { x: sx, y: sy },
      distCm: normToCm(distanceBetween(proj, { x: sx, y: sy }), cfg.scale),
    });

    const distToA = distanceBetween(proj, a);
    const distToB = distanceBetween(proj, b);

    if (distToA > 0.005) {
      const dimA1 = { x: a.x + nx * perpDimOffset, y: a.y + ny * perpDimOffset };
      const dimA2 = { x: dimLineY1, y: dimLineY2 };
      guides.push({
        type: 'wall-along',
        from: dimA1,
        to: dimA2,
        distCm: normToCm(distToA, cfg.scale),
        offset: perpDimOffset,
      });
    }

    if (distToB > 0.005) {
      const dimB1 = { x: dimLineY1, y: dimLineY2 };
      const dimB2 = { x: b.x + nx * perpDimOffset, y: b.y + ny * perpDimOffset };
      guides.push({
        type: 'wall-along',
        from: dimB1,
        to: dimB2,
        distCm: normToCm(distToB, cfg.scale),
        offset: perpDimOffset,
      });
    }

    const perpWalls = walls.filter((w, i) => {
      if (i === 0) return false;
      const dotUU = Math.abs(w.ux * ux + w.uy * uy);
      return dotUU < 0.3;
    });

    if (perpWalls.length > 0) {
      const pw = perpWalls[0];
      const perpProj = closestPointOnSegment({ x: sx, y: sy }, pw.a, pw.b);
      const perpDist = perpProj.dist;
      if (perpDist > 0.005 && perpDist < cfg.wallThreshold) {
        const perpSign = ((sx - perpProj.point.x) * pw.nx + (sy - perpProj.point.y) * pw.ny) >= 0 ? 1 : -1;
        const perpOffset = 0.015 * perpSign;
        const dimP1 = { x: perpProj.point.x + pw.nx * perpOffset, y: perpProj.point.y + pw.ny * perpOffset };
        const dimP2 = { x: sx + pw.nx * perpOffset, y: sy + pw.ny * perpOffset };
        guides.push({
          type: 'wall-along',
          from: dimP1,
          to: dimP2,
          distCm: normToCm(perpDist, cfg.scale),
          offset: perpOffset,
        });
      }
    }
  }

  let alignedX = false;
  let alignedY = false;

  for (const other of cfg.otherPins) {
    if (!alignedX && Math.abs(raw.x - other.x) < cfg.alignThreshold) {
      sx = other.x;
      alignedX = true;
      guides.push({
        type: 'align-x',
        from: { x: other.x, y: Math.min(sy, other.y) },
        to: { x: other.x, y: Math.max(sy, other.y) },
        distCm: normToCm(Math.abs(sy - other.y), cfg.scale),
      });
    }
    if (!alignedY && Math.abs(raw.y - other.y) < cfg.alignThreshold) {
      sy = other.y;
      alignedY = true;
      guides.push({
        type: 'align-y',
        from: { x: Math.min(sx, other.x), y: other.y },
        to: { x: Math.max(sx, other.x), y: other.y },
        distCm: normToCm(Math.abs(sx - other.x), cfg.scale),
      });
    }
  }

  if (cfg.lightMode && cfg.otherPins.length >= 2) {
    const sorted = [...cfg.otherPins].sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = distanceBetween(sorted[i], sorted[i + 1]);
      if (gap < 0.005) continue;
      const last = sorted[sorted.length - 1];
      const dFromLast = distanceBetween({ x: sx, y: sy }, last);
      if (Math.abs(dFromLast - gap) < cfg.alignThreshold * 2) {
        const dx = sx - last.x;
        const dy = sy - last.y;
        const dLen = Math.sqrt(dx * dx + dy * dy);
        if (dLen > 0) {
          sx = last.x + (dx / dLen) * gap;
          sy = last.y + (dy / dLen) * gap;
          guides.push({
            type: 'spacing',
            from: last,
            to: { x: sx, y: sy },
            distCm: normToCm(gap, cfg.scale),
          });
        }
      }
      break;
    }
  }

  return { snapped: { x: sx, y: sy }, guides };
}

export function createDimensionsFromSnap(
  pinPos: Point,
  rooms: { id: string; points: Point[] }[],
  _scale?: FloorScale,
  threshold = 0.04,
): { p1: Point; p2: Point }[] {
  const dims: { p1: Point; p2: Point }[] = [];
  const walls = findNearestWalls(pinPos, rooms, threshold);
  if (walls.length === 0) return dims;

  const best = walls[0];
  const { proj, a, b, nx, ny, ux, uy } = best;
  const dot = (pinPos.x - proj.x) * nx + (pinPos.y - proj.y) * ny;
  const sign = dot >= 0 ? 1 : -1;
  const perpOffset = 0.015 * sign;

  const distToA = distanceBetween(proj, a);
  const distToB = distanceBetween(proj, b);

  if (distToA > 0.005) {
    dims.push({
      p1: { x: a.x + nx * perpOffset, y: a.y + ny * perpOffset },
      p2: { x: proj.x + nx * perpOffset, y: proj.y + ny * perpOffset },
    });
  }
  if (distToB > 0.005) {
    dims.push({
      p1: { x: proj.x + nx * perpOffset, y: proj.y + ny * perpOffset },
      p2: { x: b.x + nx * perpOffset, y: b.y + ny * perpOffset },
    });
  }

  const perpWalls = walls.filter((w, i) => {
    if (i === 0) return false;
    const dotUU = Math.abs(w.ux * ux + w.uy * uy);
    return dotUU < 0.3;
  });

  if (perpWalls.length > 0) {
    const pw = perpWalls[0];
    const perpProj = closestPointOnSegment(pinPos, pw.a, pw.b);
    if (perpProj.dist > 0.005 && perpProj.dist < threshold) {
      const perpSign = ((pinPos.x - perpProj.point.x) * pw.nx + (pinPos.y - perpProj.point.y) * pw.ny) >= 0 ? 1 : -1;
      const pOff = 0.015 * perpSign;
      dims.push({
        p1: { x: perpProj.point.x + pw.nx * pOff, y: perpProj.point.y + pw.ny * pOff },
        p2: { x: pinPos.x + pw.nx * pOff, y: pinPos.y + pw.ny * pOff },
      });
    }
  }

  return dims;
}
