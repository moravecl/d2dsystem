import { FloorplanSymbol } from '../../../types/database';
import { FloorScale } from '../../../hooks/useProjectState';
import { distanceBetween } from './geometry';

export interface FloorplanObjectData {
  id: string;
  productId: string;
  floorId: string;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  snapToWall: boolean;
  wallOffsetMm: number;
  roomId: string;
  note: string;
}

export function mmToNormalized(mm: number, scale: FloorScale): number {
  const calibDist = distanceBetween(scale.p1, scale.p2);
  if (calibDist === 0) return 0;
  const mPerUnit = scale.realDistanceM / calibDist;
  return (mm / 1000) / mPerUnit;
}

export function getObjectSizeNormalized(
  symbol: FloorplanSymbol,
  scale: FloorScale,
  rotation: number,
  canvasAspectRatio = 1
): { w: number; h: number } {
  const widthMm = symbol.width_mm ?? 0;
  const heightMm = symbol.height_mm ?? 0;
  const w = mmToNormalized(widthMm, scale);
  const h = mmToNormalized(heightMm, scale);
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  if (normalizedRotation === 90 || normalizedRotation === 270) {
    const ar = canvasAspectRatio || 1;
    return { w: h / ar, h: w * ar };
  }
  return { w, h };
}

export function getRotatedSvgContent(
  symbol: FloorplanSymbol,
  rotation: number
): { viewBox: string; content: string } {
  const vbW = symbol.width_mm || 100;
  const vbH = symbol.height_mm || 100;
  const svgContent = symbol.svg_content || '';
  const rot = ((rotation % 360) + 360) % 360;

  if (rot === 90) {
    return {
      viewBox: `0 0 ${vbH} ${vbW}`,
      content: `<g transform="translate(${vbH},0) rotate(90)">${svgContent}</g>`,
    };
  }
  if (rot === 180) {
    return {
      viewBox: `0 0 ${vbW} ${vbH}`,
      content: `<g transform="translate(${vbW},${vbH}) rotate(180)">${svgContent}</g>`,
    };
  }
  if (rot === 270) {
    return {
      viewBox: `0 0 ${vbH} ${vbW}`,
      content: `<g transform="translate(0,${vbW}) rotate(-90)">${svgContent}</g>`,
    };
  }
  return {
    viewBox: `0 0 ${vbW} ${vbH}`,
    content: svgContent,
  };
}

export function createDefaultObject(
  productId: string,
  floorId: string,
  x: number,
  y: number,
  symbol: FloorplanSymbol
): FloorplanObjectData {
  return {
    id: crypto.randomUUID(),
    productId,
    floorId,
    x,
    y,
    rotation: 0,
    flipX: false,
    flipY: false,
    snapToWall: symbol.snap_to_wall ?? false,
    wallOffsetMm: symbol.wall_offset_mm ?? 0,
    roomId: '',
    note: '',
  };
}
