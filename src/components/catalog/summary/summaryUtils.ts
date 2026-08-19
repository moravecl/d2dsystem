import { polylineLength, normalizedToMeters } from '../floorplan/geometry';
import type { FloorScale, Floor } from '../../../hooks/useProjectState';
import type { ProjectDesignElement } from '../../../types/designElements';
import type { MountingGroupWithSlots } from '../../../hooks/useMountingGroups';

export const CATEGORY_PRINT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'bg-emerald-600': { bg: '#ecfdf5', text: '#064e3b', border: '#a7f3d0', dot: '#059669' },
  'bg-yellow-500': { bg: '#fefce8', text: '#713f12', border: '#fde68a', dot: '#eab308' },
  'bg-amber-600': { bg: '#fffbeb', text: '#78350f', border: '#fcd34d', dot: '#d97706' },
  'bg-blue-600': { bg: '#eff6ff', text: '#1e3a5f', border: '#bfdbfe', dot: '#2563eb' },
  'bg-cyan-600': { bg: '#ecfeff', text: '#164e63', border: '#a5f3fc', dot: '#0891b2' },
  'bg-red-600': { bg: '#fef2f2', text: '#7f1d1d', border: '#fecaca', dot: '#dc2626' },
};

export function getPrintColor(pillColor: string) {
  return CATEGORY_PRINT_COLORS[pillColor] ?? { bg: '#f8fafc', text: '#0f172a', border: '#e2e8f0', dot: '#475569' };
}

export function getCableLengthStr(cable: { points: { x: number; y: number }[] }, scale?: FloorScale): string {
  const normalized = polylineLength(cable.points);
  if (scale) return `${normalizedToMeters(normalized, scale).toFixed(1)} m`;
  return `${(normalized * 100).toFixed(0)} j.`;
}

export interface PdfSections {
  items: boolean;
  rooms: boolean;
  routes: boolean;
  fittings: boolean;
  summary: boolean;
  floorplans: boolean;
  trades: boolean;
  heating: boolean;
  fv: boolean;
  camera: boolean;
  eps: boolean;
}

export function getFloorDesignElements(
  floor: Floor,
  floors: Floor[],
  designElements: ProjectDesignElement[]
): ProjectDesignElement[] {
  const directMatch = designElements.filter(el => el.floor_id === floor.id);
  if (directMatch.length > 0) return directMatch;

  const floorIndex = floors.findIndex(f => f.id === floor.id);
  if (floorIndex === -1) return [];

  const uniqueFloorIds = [...new Set(designElements.map(el => el.floor_id).filter(Boolean))];

  if (floorIndex === 0 && uniqueFloorIds.length > 0) {
    const firstSchematicFloorId = uniqueFloorIds.find(fid =>
      fid?.startsWith('floor-') || fid === 'floor-1'
    ) || uniqueFloorIds[0];
    if (firstSchematicFloorId) {
      return designElements.filter(el => el.floor_id === firstSchematicFloorId);
    }
  }

  const byName = floors.find(f => f.name === floor.name && f.id !== floor.id);
  if (byName) {
    const nameMatch = designElements.filter(el => el.floor_id === byName.id);
    if (nameMatch.length > 0) return nameMatch;
  }

  return [];
}

export function getFloorMountingGroups(
  floor: Floor,
  floors: Floor[],
  mountingGroups: MountingGroupWithSlots[]
): MountingGroupWithSlots[] {
  const directMatch = mountingGroups.filter(mg => mg.floor_id === floor.id);
  if (directMatch.length > 0) return directMatch;

  const floorIndex = floors.findIndex(f => f.id === floor.id);
  if (floorIndex === -1) return [];

  const uniqueFloorIds = [...new Set(mountingGroups.map(mg => mg.floor_id).filter(Boolean))];

  if (floorIndex === 0 && uniqueFloorIds.length > 0) {
    const firstSchematicFloorId = uniqueFloorIds.find(fid =>
      fid?.startsWith('floor-') || fid === 'floor-1'
    ) || uniqueFloorIds[0];
    if (firstSchematicFloorId) {
      return mountingGroups.filter(mg => mg.floor_id === firstSchematicFloorId);
    }
  }

  return [];
}
