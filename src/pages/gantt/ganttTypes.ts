export interface ProjectRef {
  id: string;
  project_name: string;
  status: string;
  deadline: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  sort_order: number;
  color: string;
  progress: number;
  depends_on: string[];
}

export const STATUS_COLORS: Record<string, string> = {
  lead: '#64748b', design: '#3b82f6', quote: '#06b6d4', approval: '#f59e0b',
  in_progress: '#10b981', completed: '#94a3b8', cancelled: '#ef4444',
};

export const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', design: 'Návrh', quote: 'Nabídka', approval: 'Schválení',
  in_progress: 'Realizace', completed: 'Hotovo', cancelled: 'Zrušeno',
};

export const MS_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Plánováno', color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Probíhá', color: 'bg-blue-50 text-blue-600' },
  completed: { label: 'Hotovo', color: 'bg-emerald-50 text-emerald-600' },
};

export const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export interface ViewPreset { key: string; label: string; days: number }

export const VIEW_PRESETS: ViewPreset[] = [
  { key: '1w', label: '1T', days: 7 },
  { key: '2w', label: '2T', days: 14 },
  { key: '1m', label: '1M', days: 31 },
  { key: '2m', label: '2M', days: 61 },
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 183 },
  { key: '12m', label: '12M', days: 365 },
];

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('cs-CZ');
}

export function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
