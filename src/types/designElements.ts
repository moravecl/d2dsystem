export interface DesignElementType {
  id: string;
  org_id: string | null;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  icon: string | null;
  layer: string | null;
  default_params: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDesignElement {
  id: string;
  project_id: string;
  org_id: string | null;
  element_type_id: string;
  floor_id: string | null;
  room_id: string | null;
  x: number;
  y: number;
  rotation: number;
  label: string | null;
  note: string | null;
  circuit_id: string | null;
  mounting_height: string | null;
  quantity: number;
  params: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
  element_type?: DesignElementType;
}

export interface ProductAssignment {
  id: string;
  project_id: string;
  org_id: string | null;
  scope: 'project' | 'room' | 'element';
  scope_ref_id: string | null;
  element_type_id: string | null;
  product_id: string | null;
  assignment_type: 'manual' | 'auto' | 'inherited';
  quantity_override: number | null;
  notes: string | null;
  offer_variant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRule {
  id: string;
  project_id: string;
  org_id: string | null;
  scope: 'project' | 'room';
  scope_ref_id: string | null;
  element_type_id: string | null;
  product_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type CompatibilityType = 'recommended' | 'compatible' | 'incompatible';

export interface ElementTypeProductCompatibility {
  id: string;
  element_type_id: string;
  product_id: string;
  compatibility_type: CompatibilityType;
  notes: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DesignSeriesProductLink {
  id: string;
  design_series_id: string;
  product_id: string;
  role_key: string;
  is_default: boolean;
  priority: number;
  notes: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MountingOrientation = 'horizontal' | 'vertical';

export interface MountingGroup {
  id: string;
  project_id: string;
  floor_id: string | null;
  room_id: string | null;
  x: number;
  y: number;
  rotation: number;
  frame_size: number;
  orientation: MountingOrientation;
  design_series_id: string | null;
  color_name: string | null;
  modules: string[];
  label: string | null;
  notes: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MountingGroupSlot {
  id: string;
  mounting_group_id: string;
  slot_index: number;
  element_id: string | null;
  module_name: string | null;
  product_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ElementSpecification {
  id: string;
  project_id: string;
  org_id: string | null;
  scope: 'project' | 'room' | 'element';
  scope_ref_id: string | null;
  element_type_id: string | null;
  design_series: string | null;
  color_name: string | null;
  color_hex: string | null;
  surface: string | null;
  manufacturer: string | null;
  ip_rating: string | null;
  mounting_type: string | null;
  extra_params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OfferVariant {
  id: string;
  project_id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ELEMENT_CATEGORIES = [
  { id: 'elektro', name: 'Elektro', color: '#3b82f6' },
  { id: 'data', name: 'Data / Sítě', color: '#06b6d4' },
  { id: 'camera', name: 'Kamerové systémy', color: '#8b5cf6' },
  { id: 'eps', name: 'EPS / Zabezpečení', color: '#ef4444' },
  { id: 'hvac', name: 'HVAC / Topení', color: '#f97316' },
  { id: 'water', name: 'Voda / Instalace', color: '#0ea5e9' },
  { id: 'gas', name: 'Plyn', color: '#eab308' },
  { id: 'slaboproud', name: 'Slaboproud', color: '#a855f7' },
  { id: 'smart', name: 'Smart Home', color: '#10b981' },
  { id: 'other', name: 'Ostatní', color: '#6b7280' },
] as const;

export type ElementCategory = typeof ELEMENT_CATEGORIES[number]['id'];

export function getCategoryColor(category: string): string {
  const found = ELEMENT_CATEGORIES.find((c) => c.id === category);
  return found?.color ?? '#6b7280';
}

export function getCategoryName(category: string): string {
  const found = ELEMENT_CATEGORIES.find((c) => c.id === category);
  return found?.name ?? category;
}
