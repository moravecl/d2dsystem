import type { ProductAssignment } from '../types/designElements';
import type { CompatibilityMap } from '../hooks/useElementTypeCompatibility';

export type AssignmentItemType = 'direct_product' | 'design_series' | null;
export type AssignmentSourceLevel = 'element' | 'room' | 'project' | null;
export type CompatibilityStatus = 'compatible' | 'recommended' | 'incompatible' | 'unknown';

export interface ResolvedAssignment {
  effectiveProductId: string | null;
  itemType: AssignmentItemType;
  sourceLevel: AssignmentSourceLevel;
  inherited: boolean;
  matchedAssignment: ProductAssignment | null;
  compatibilityStatus: CompatibilityStatus;
}

export interface ResolveAssignmentParams {
  elementId: string;
  elementTypeId: string;
  roomId: string | null;
  assignments: ProductAssignment[];
  productKindMap?: Map<string, string>;
  compatibilityMap?: CompatibilityMap;
}

function getCompatibilityStatus(
  elementTypeId: string,
  productId: string,
  compatibilityMap?: CompatibilityMap
): CompatibilityStatus {
  if (!compatibilityMap) return 'unknown';
  const compat = compatibilityMap.getCompatibility(elementTypeId, productId);
  if (compat === null) return 'unknown';
  if (compat === 'recommended') return 'recommended';
  if (compat === 'compatible') return 'compatible';
  return 'incompatible';
}

export function resolveAssignmentForElement(params: ResolveAssignmentParams): ResolvedAssignment {
  const { elementId, elementTypeId, roomId, assignments, productKindMap, compatibilityMap } = params;

  const elementAssignment = assignments.find(
    (a) => a.scope === 'element' && a.scope_ref_id === elementId
  );
  if (elementAssignment?.product_id) {
    const kind = productKindMap?.get(elementAssignment.product_id);
    const compatStatus = getCompatibilityStatus(elementTypeId, elementAssignment.product_id, compatibilityMap);
    return {
      effectiveProductId: elementAssignment.product_id,
      itemType: kind === 'design_series' ? 'design_series' : 'direct_product',
      sourceLevel: 'element',
      inherited: false,
      matchedAssignment: elementAssignment,
      compatibilityStatus: compatStatus,
    };
  }

  if (roomId) {
    const roomTypeAssignment = assignments.find(
      (a) =>
        a.scope === 'room' &&
        a.scope_ref_id === roomId &&
        a.element_type_id === elementTypeId
    );
    if (roomTypeAssignment?.product_id) {
      const kind = productKindMap?.get(roomTypeAssignment.product_id);
      const compatStatus = getCompatibilityStatus(elementTypeId, roomTypeAssignment.product_id, compatibilityMap);
      return {
        effectiveProductId: roomTypeAssignment.product_id,
        itemType: kind === 'design_series' ? 'design_series' : 'direct_product',
        sourceLevel: 'room',
        inherited: true,
        matchedAssignment: roomTypeAssignment,
        compatibilityStatus: compatStatus,
      };
    }

    const roomGenericAssignment = assignments.find(
      (a) =>
        a.scope === 'room' &&
        a.scope_ref_id === roomId &&
        a.element_type_id === null
    );
    if (roomGenericAssignment?.product_id) {
      const kind = productKindMap?.get(roomGenericAssignment.product_id);
      const compatStatus = getCompatibilityStatus(elementTypeId, roomGenericAssignment.product_id, compatibilityMap);
      return {
        effectiveProductId: roomGenericAssignment.product_id,
        itemType: kind === 'design_series' ? 'design_series' : 'direct_product',
        sourceLevel: 'room',
        inherited: true,
        matchedAssignment: roomGenericAssignment,
        compatibilityStatus: compatStatus,
      };
    }
  }

  const projectTypeAssignment = assignments.find(
    (a) =>
      a.scope === 'project' &&
      a.element_type_id === elementTypeId
  );
  if (projectTypeAssignment?.product_id) {
    const kind = productKindMap?.get(projectTypeAssignment.product_id);
    const compatStatus = getCompatibilityStatus(elementTypeId, projectTypeAssignment.product_id, compatibilityMap);
    return {
      effectiveProductId: projectTypeAssignment.product_id,
      itemType: kind === 'design_series' ? 'design_series' : 'direct_product',
      sourceLevel: 'project',
      inherited: true,
      matchedAssignment: projectTypeAssignment,
      compatibilityStatus: compatStatus,
    };
  }

  const projectGenericAssignment = assignments.find(
    (a) =>
      a.scope === 'project' &&
      a.element_type_id === null
  );
  if (projectGenericAssignment?.product_id) {
    const kind = productKindMap?.get(projectGenericAssignment.product_id);
    const compatStatus = getCompatibilityStatus(elementTypeId, projectGenericAssignment.product_id, compatibilityMap);
    return {
      effectiveProductId: projectGenericAssignment.product_id,
      itemType: kind === 'design_series' ? 'design_series' : 'direct_product',
      sourceLevel: 'project',
      inherited: true,
      matchedAssignment: projectGenericAssignment,
      compatibilityStatus: compatStatus,
    };
  }

  return {
    effectiveProductId: null,
    itemType: null,
    sourceLevel: null,
    inherited: false,
    matchedAssignment: null,
    compatibilityStatus: 'unknown',
  };
}

export interface ElementAssignmentSummary {
  elementId: string;
  resolved: ResolvedAssignment;
}

export interface ProjectAssignmentStats {
  totalElements: number;
  assignedCount: number;
  unassignedCount: number;
  inheritedCount: number;
  directCount: number;
  designSeriesCount: number;
  directProductCount: number;
  incompatibleCount: number;
  recommendedCount: number;
}

export interface ProjectDesignElementMin {
  id: string;
  element_type_id: string;
  room_id: string | null;
}

export function resolveAllAssignments(
  elements: ProjectDesignElementMin[],
  assignments: ProductAssignment[],
  productKindMap?: Map<string, string>,
  compatibilityMap?: CompatibilityMap
): Map<string, ResolvedAssignment> {
  const result = new Map<string, ResolvedAssignment>();

  for (const el of elements) {
    const resolved = resolveAssignmentForElement({
      elementId: el.id,
      elementTypeId: el.element_type_id,
      roomId: el.room_id,
      assignments,
      productKindMap,
      compatibilityMap,
    });
    result.set(el.id, resolved);
  }

  return result;
}

export function computeAssignmentStats(
  resolutions: Map<string, ResolvedAssignment>
): ProjectAssignmentStats {
  let totalElements = 0;
  let assignedCount = 0;
  let unassignedCount = 0;
  let inheritedCount = 0;
  let directCount = 0;
  let designSeriesCount = 0;
  let directProductCount = 0;
  let incompatibleCount = 0;
  let recommendedCount = 0;

  for (const resolved of resolutions.values()) {
    totalElements++;

    if (resolved.effectiveProductId) {
      assignedCount++;

      if (resolved.inherited) {
        inheritedCount++;
      } else {
        directCount++;
      }

      if (resolved.itemType === 'design_series') {
        designSeriesCount++;
      } else if (resolved.itemType === 'direct_product') {
        directProductCount++;
      }

      if (resolved.compatibilityStatus === 'incompatible') {
        incompatibleCount++;
      } else if (resolved.compatibilityStatus === 'recommended') {
        recommendedCount++;
      }
    } else {
      unassignedCount++;
    }
  }

  return {
    totalElements,
    assignedCount,
    unassignedCount,
    inheritedCount,
    directCount,
    designSeriesCount,
    directProductCount,
    incompatibleCount,
    recommendedCount,
  };
}
