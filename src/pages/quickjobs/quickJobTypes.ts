export interface QuickJob {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  client_id: string | null;
  client_name: string;
  project_id: string | null;
  address: string;
  address_lat: number | null;
  address_lon: number | null;
  priority: string;
  estimated_hours: number;
  status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  scheduled_date: string | null;
  scheduled_note: string;
  completed_at: string | null;
  completion_notes: string;
  tags: string[];
  billing_status: string;
  total_work_hours: number;
  total_material_cost: number;
  total_work_cost: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickJobWorkEntry {
  id: string;
  quick_job_id: string;
  worker_name: string;
  worker_id: string | null;
  hours: number;
  hourly_rate: number;
  description: string;
  work_date: string;
  synced_to_attendance: boolean;
  synced_to_project: boolean;
  organization_id: string;
  created_at: string;
}

export interface QuickJobMaterialEntry {
  id: string;
  quick_job_id: string;
  material_name: string;
  product_id: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  organization_id: string;
  created_at: string;
}

export interface QuickJobRow extends QuickJob {
  project_name?: string;
  claimed_by_name?: string;
  crm_client_name?: string;
}

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pool: { label: 'Sběrník', color: 'bg-slate-500/15 text-slate-300 border border-slate-500/25' },
  claimed: { label: 'Přiřazeno', color: 'bg-blue-500/15 text-blue-300 border border-blue-500/25' },
  scheduled: { label: 'Naplánováno', color: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25' },
  in_progress: { label: 'Probíhá', color: 'bg-amber-500/15 text-amber-300 border border-amber-500/25' },
  done: { label: 'Hotovo', color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' },
  cancelled: { label: 'Zrušeno', color: 'bg-red-500/15 text-red-300 border border-red-500/25' },
};

export const BILLING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  none: { label: 'Nevyfakturováno', color: 'bg-slate-500/15 text-slate-300' },
  ready: { label: 'K fakturaci', color: 'bg-amber-500/15 text-amber-300' },
  invoiced: { label: 'Vyfakturováno', color: 'bg-emerald-500/15 text-emerald-300' },
};

export const MATERIAL_UNITS = ['ks', 'm', 'm2', 'm3', 'kg', 'l', 'hod', 'bal', 'sada'] as const;

export const PRIORITY_MAP: Record<string, { label: string; dot: string }> = {
  low: { label: 'Nízká', dot: 'bg-slate-400' },
  normal: { label: 'Normální', dot: 'bg-blue-500' },
  high: { label: 'Vysoká', dot: 'bg-amber-500' },
  urgent: { label: 'Urgentní', dot: 'bg-red-500' },
};

export const STATUS_FLOW = ['pool', 'claimed', 'scheduled', 'in_progress', 'done'] as const;
