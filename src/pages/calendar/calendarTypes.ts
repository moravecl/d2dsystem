export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'task' | 'milestone' | 'deadline' | 'due_item' | 'vacation' | 'service' | 'event' | 'meeting' | 'quick_job';
  color: string;
  link?: string;
  meta?: Record<string, string>;
  startHour?: number;
  endHour?: number;
  assignee?: string;
  project?: string;
}

export interface SpanningEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  accentColor: string;
  link?: string;
  meta?: Record<string, string>;
}

export type ViewMode = 'month' | 'week' | 'day' | 'montaze';

export interface ResourceGroupMember {
  id: string;
  profile_id: string;
  role: 'lead' | 'member';
  display_name: string;
}

export type ResourceGroupType =
  | 'installation_team'
  | 'service_team'
  | 'design_team'
  | 'individual'
  | 'vehicle'
  | 'equipment'
  | 'external'
  | 'installation'
  | 'service'
  | 'design'
  | 'other';

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  installation_team: 'Montážní tým',
  service_team: 'Servisní tým',
  design_team: 'Projekční tým',
  individual: 'Jednotlivec',
  vehicle: 'Vozidlo',
  equipment: 'Vybavení',
  external: 'Externista',
  installation: 'Montáže',
  service: 'Servis',
  design: 'Projekce',
  other: 'Jiné',
};

export interface ResourceGroup {
  id: string;
  name: string;
  color: string;
  type: ResourceGroupType;
  is_active: boolean;
  capacity_hours_per_day: number;
  members: ResourceGroupMember[];
}

export interface InstallationJob {
  id: string;
  project_id: string;
  project_name: string;
  client_name?: string;
  resource_group_id?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  budget?: number;
  address?: string;
  job_type: 'montaz' | 'service' | 'revision' | 'other';
  technicians: string[];
}

export const JOB_TYPE_COLORS: Record<string, string> = {
  montaz: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  service: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  revision: 'bg-teal-500/20 border-teal-500/40 text-teal-300',
  other: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  montaz: 'Montáž',
  service: 'Servis',
  revision: 'Revize',
  other: 'Jiné',
};

export const DAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
export const DAY_NAMES_FULL = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

export const TYPE_LABELS: Record<string, string> = {
  task: 'Úkol',
  milestone: 'Milník',
  deadline: 'Termín projektu',
  due_item: 'Revize majetku',
  vacation: 'Dovolená',
  service: 'Servisní výjezd',
  event: 'Událost',
  meeting: 'Porada / Schůzka',
  quick_job: 'Rychlá zakázka',
};

export const LEGEND_ITEMS = [
  { type: 'task', label: 'Úkoly', color: 'bg-blue-100 text-blue-700' },
  { type: 'milestone', label: 'Milníky', color: 'bg-amber-100 text-amber-700' },
  { type: 'deadline', label: 'Termíny projektu', color: 'bg-red-100 text-red-700' },
  { type: 'due_item', label: 'Revize majetku', color: 'bg-orange-100 text-orange-700' },
  { type: 'vacation', label: 'Dovolené', color: 'bg-teal-100 text-teal-700' },
  { type: 'service', label: 'Servis', color: 'bg-cyan-100 text-cyan-700' },
  { type: 'event', label: 'Události', color: 'bg-rose-100 text-rose-700' },
  { type: 'meeting', label: 'Porady', color: 'bg-sky-100 text-sky-700' },
  { type: 'quick_job', label: 'Rychlé zakázky', color: 'bg-amber-100 text-amber-700' },
];

export function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getEventsForDate(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
  return events.filter(e => e.date === dateStr);
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
