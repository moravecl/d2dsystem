export type AssetType = 'vehicle' | 'appliance' | 'building' | 'tool';
export type OwnerType = 'company' | 'client';
export type AssetStatus = 'active' | 'inactive' | 'disposed';
export type EventType = 'service' | 'revision' | 'damage' | 'insurance' | 'warranty_claim' | 'stk' | 'calibration' | 'filter_change' | 'other';
export type DueType = 'revision' | 'service' | 'warranty' | 'insurance' | 'stk' | 'emission' | 'vignette' | 'calibration' | 'filter_change' | 'other';
export type DueStatus = 'ok' | 'upcoming' | 'overdue' | 'completed';

export interface Asset {
  id: string;
  asset_type: AssetType;
  name: string;
  code: string;
  tags: string[];
  owner_type: OwnerType;
  client_id: string | null;
  project_id: string | null;
  building_id: string | null;
  location_address: string;
  location_room: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  purchase_date: string | null;
  supplier: string;
  warranty_until: string | null;
  warranty_terms: string;
  note: string;
  status: AssetStatus;
  vin: string;
  license_plate: string;
  fuel_type: string;
  odometer_km: number;
  device_type: string;
  building_type: string;
  main_breaker: string;
  connection_type: string;
  heating_type: string;
  has_fve: boolean;
  has_recuperation: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetEvent {
  id: string;
  asset_id: string;
  event_type: EventType;
  title: string;
  description: string;
  event_date: string;
  odometer_km: number | null;
  motor_hours: number | null;
  cost: number;
  supplier: string;
  document_url: string | null;
  performed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DueItem {
  id: string;
  asset_id: string;
  due_type: DueType;
  label: string;
  due_date: string | null;
  due_km: number | null;
  due_motor_hours: number | null;
  interval_months: number | null;
  interval_km: number | null;
  status: DueStatus;
  responsible_user_id: string | null;
  notify: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  insurance_company: string | null;
  insurance_policy_number: string | null;
  insurance_price: number | null;
  insurance_payment_frequency: 'quarterly' | 'semi_annual' | 'annual' | null;
  insurance_coverages: string[];
}

export interface InsuranceCoverageType {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
  organization_id: string | null;
  sort_order: number;
}

export interface AssetDocument {
  id: string;
  asset_id: string;
  name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  vehicle: 'Vozidlo',
  appliance: 'Zařízení',
  building: 'Budova',
  tool: 'Nářadí/Stroj',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  service: 'Servis',
  revision: 'Revize',
  damage: 'Škoda',
  insurance: 'Pojištění',
  warranty_claim: 'Reklamace',
  stk: 'STK',
  calibration: 'Kalibrace',
  filter_change: 'Výměna filtru',
  other: 'Ostatní',
};

export const DUE_TYPE_LABELS: Record<DueType, string> = {
  revision: 'Revize',
  service: 'Servisní prohlídka',
  warranty: 'Záruka',
  insurance: 'Pojištění',
  stk: 'STK',
  emission: 'Emise',
  vignette: 'Dálniční známka',
  calibration: 'Kalibrace',
  filter_change: 'Výměna filtru',
  other: 'Ostatní',
};

export const DEVICE_TYPES = [
  'FVE měnič', 'Baterie', 'Wallbox', 'Rekuperace', 'Tepelné čerpadlo',
  'Kotel', 'Rozvaděč', 'Spotřebič', 'Klimatizace', 'Ostatní',
];

export const BUILDING_TYPES = [
  { value: 'rd', label: 'Rodinný dům' },
  { value: 'firma', label: 'Firemní objekt' },
  { value: 'obec', label: 'Obecní objekt' },
];

export const FUEL_TYPES = ['Benzin', 'Nafta', 'CNG', 'LPG', 'Elektro', 'Hybrid'];

export function computeDueStatus(item: { due_date: string | null; status: string }): DueStatus {
  if (item.status === 'completed') return 'completed';
  if (!item.due_date) return 'ok';
  const now = new Date();
  const due = new Date(item.due_date);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'upcoming';
  return 'ok';
}

export function dueStatusColor(status: DueStatus) {
  switch (status) {
    case 'ok': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
    case 'upcoming': return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    case 'overdue': return 'bg-red-500/15 text-red-400 border-red-500/25';
    case 'completed': return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  }
}

export function dueStatusLabel(status: DueStatus) {
  switch (status) {
    case 'ok': return 'OK';
    case 'upcoming': return 'Brzy';
    case 'overdue': return 'Po termínu';
    case 'completed': return 'Splněno';
  }
}
