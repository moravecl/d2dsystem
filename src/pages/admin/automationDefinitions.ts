export interface AutomationRule {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_entity: string;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  actions: AutomationAction[];
}

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export const TRIGGER_ENTITIES = [
  { value: 'project', label: 'Projekt', color: 'bg-blue-100 text-blue-700' },
  { value: 'task', label: 'Úkol', color: 'bg-amber-100 text-amber-700' },
  { value: 'invoice', label: 'Faktura', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'quote', label: 'Cenová nabídka', color: 'bg-teal-100 text-teal-700' },
  { value: 'client', label: 'Klient', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'defect', label: 'Vada / Reklamace', color: 'bg-red-100 text-red-700' },
  { value: 'milestone', label: 'Milník', color: 'bg-sky-100 text-sky-700' },
  { value: 'service_ticket', label: 'Servisní tiket', color: 'bg-rose-100 text-rose-700' },
  { value: 'service_schedule', label: 'Servisní plán', color: 'bg-orange-100 text-orange-700' },
  { value: 'warehouse', label: 'Sklad', color: 'bg-slate-200 text-slate-700' },
  { value: 'asset', label: 'Majetek / Zařízení', color: 'bg-stone-200 text-stone-700' },
  { value: 'worklog', label: 'Pracovní záznam', color: 'bg-lime-100 text-lime-700' },
];

export const TRIGGER_EVENTS: Record<string, { value: string; label: string; description?: string }[]> = {
  project: [
    { value: 'status_changed', label: 'Změna stavu', description: 'Např. z "Návrh" na "Realizace"' },
    { value: 'created', label: 'Projekt vytvořen' },
    { value: 'assigned', label: 'Změna odpovědné osoby' },
    { value: 'deadline_approaching', label: 'Blíží se deadline' },
    { value: 'deadline_overdue', label: 'Deadline prosazen' },
    { value: 'updated', label: 'Projekt upraven' },
  ],
  task: [
    { value: 'status_changed', label: 'Změna stavu', description: 'Např. z "K vyřízení" na "Hotovo"' },
    { value: 'created', label: 'Úkol vytvořen' },
    { value: 'assigned', label: 'Úkol přiřazen' },
    { value: 'priority_changed', label: 'Změna priority' },
    { value: 'due_date_approaching', label: 'Blíží se termín splnění' },
    { value: 'overdue', label: 'Úkol po termínu' },
  ],
  invoice: [
    { value: 'status_changed', label: 'Změna stavu', description: 'Např. z "Odeslána" na "Zaplacena"' },
    { value: 'created', label: 'Faktura vytvořena' },
    { value: 'due_date_approaching', label: 'Blíží se splatnost' },
    { value: 'overdue', label: 'Faktura po splatnosti' },
    { value: 'paid', label: 'Faktura uhrazena' },
    { value: 'amount_threshold', label: 'Částka přesáhne limit' },
  ],
  quote: [
    { value: 'status_changed', label: 'Změna stavu', description: 'Např. z "Nová" na "Schválena"' },
    { value: 'created', label: 'Nabídka vytvořena' },
    { value: 'presented', label: 'Nabídka předložena klientovi' },
    { value: 'approved', label: 'Nabídka schválena' },
    { value: 'rejected', label: 'Nabídka zamítnuta' },
    { value: 'approval_pending', label: 'Čeká na schválení (N dní)', description: 'Eskalace pokud se dlouho neschválí' },
  ],
  client: [
    { value: 'created', label: 'Nový klient vytvořen' },
    { value: 'updated', label: 'Klient upraven' },
    { value: 'deactivated', label: 'Klient deaktivován' },
    { value: 'has_overdue_invoices', label: 'Klient má faktury po splatnosti' },
  ],
  defect: [
    { value: 'created', label: 'Vada nahlášena' },
    { value: 'status_changed', label: 'Změna stavu vady', description: 'Např. z "Otevřena" na "Vyřešena"' },
    { value: 'severity_critical', label: 'Nahlášena kritická vada' },
    { value: 'assigned', label: 'Vada přiřazena řešiteli' },
    { value: 'open_too_long', label: 'Vada otevřena příliš dlouho' },
  ],
  milestone: [
    { value: 'status_changed', label: 'Změna stavu milníku' },
    { value: 'created', label: 'Milník vytvořen' },
    { value: 'completed', label: 'Milník dokončen' },
    { value: 'start_approaching', label: 'Blíží se začátek milníku' },
    { value: 'end_approaching', label: 'Blíží se konec milníku' },
    { value: 'overdue', label: 'Milník prosazen' },
    { value: 'progress_threshold', label: 'Postup dosáhne úrovně (%)' },
  ],
  service_ticket: [
    { value: 'created', label: 'Tiket vytvořen' },
    { value: 'status_changed', label: 'Změna stavu tiketu' },
    { value: 'created_from_portal', label: 'Tiket od klienta (portál)' },
    { value: 'assigned', label: 'Tiket přiřazen technikovi' },
    { value: 'priority_urgent', label: 'Urgentní tiket' },
  ],
  service_schedule: [
    { value: 'due_soon', label: 'Servis se blíží', description: 'N dní před termínem' },
    { value: 'overdue', label: 'Servis po termínu' },
    { value: 'completed', label: 'Servis dokončen' },
  ],
  warehouse: [
    { value: 'low_stock', label: 'Nízký stav zásob', description: 'Množství klesne pod minimum' },
    { value: 'item_issued', label: 'Materiál vydán na projekt' },
    { value: 'item_received', label: 'Materiál přijat na sklad' },
    { value: 'unplanned_material', label: 'Neplánový materiál použit' },
    { value: 'cost_overrun', label: 'Překročení materiálového rozpočtu' },
  ],
  asset: [
    { value: 'created', label: 'Majetek zaevidován' },
    { value: 'due_item_approaching', label: 'Blíží se revize/servis/STK', description: 'N dní před termínem' },
    { value: 'due_item_overdue', label: 'Prosazen termín revize/servisu' },
    { value: 'warranty_expiring', label: 'Záruka brzy vyprší' },
    { value: 'status_changed', label: 'Změna stavu majetku' },
  ],
  worklog: [
    { value: 'created', label: 'Pracovní záznam vytvořen' },
    { value: 'hours_exceeded', label: 'Překročeny hodiny na projektu', description: 'Celkový čas přesáhne limit' },
    { value: 'no_activity', label: 'Žádná aktivita N dní', description: 'Na projektu se nic neděje' },
  ],
};

export const INVOICE_STATUSES = [
  { key: 'draft', label: 'Koncept' },
  { key: 'sent', label: 'Odeslána' },
  { key: 'partial', label: 'Částečně uhrazena' },
  { key: 'paid', label: 'Zaplacena' },
  { key: 'overdue', label: 'Po splatnosti' },
  { key: 'cancelled', label: 'Stornována' },
];

export const QUOTE_STATUSES = [
  { key: 'new', label: 'Nová' },
  { key: 'presented', label: 'Předložena' },
  { key: 'approved', label: 'Schválena' },
  { key: 'rejected', label: 'Zamítnuta' },
];

export const DEFECT_STATUSES = [
  { key: 'open', label: 'Otevřena' },
  { key: 'in_progress', label: 'Řešeno' },
  { key: 'resolved', label: 'Vyřešena' },
];

export const DEFECT_SEVERITIES = [
  { key: 'low', label: 'Nízká' },
  { key: 'medium', label: 'Střední' },
  { key: 'high', label: 'Vysoká' },
  { key: 'critical', label: 'Kritická' },
];

export const MILESTONE_STATUSES = [
  { key: 'planned', label: 'Plánovaný' },
  { key: 'in_progress', label: 'V průběhu' },
  { key: 'completed', label: 'Dokončený' },
];

export const SERVICE_TICKET_STATUSES = [
  { key: 'open', label: 'Otevřený' },
  { key: 'in_progress', label: 'V řešení' },
  { key: 'closed', label: 'Uzavřený' },
];

export const ASSET_STATUSES = [
  { key: 'active', label: 'Aktivní' },
  { key: 'inactive', label: 'Neaktivní' },
  { key: 'disposed', label: 'Vyřazeno' },
];

export const PRIORITY_OPTIONS = [
  { key: 'low', label: 'Nízká' },
  { key: 'medium', label: 'Střední' },
  { key: 'high', label: 'Vysoká' },
  { key: 'urgent', label: 'Urgentní' },
];

export const DUE_ITEM_TYPES = [
  { key: 'revision', label: 'Revize' },
  { key: 'service', label: 'Servis' },
  { key: 'warranty', label: 'Záruka' },
  { key: 'insurance', label: 'Pojištění' },
  { key: 'stk', label: 'STK' },
  { key: 'emission', label: 'Emise' },
  { key: 'calibration', label: 'Kalibrace' },
  { key: 'filter_change', label: 'Výměna filtru' },
];

export const ACTION_TYPES = [
  { value: 'create_task', label: 'Vytvořit úkol' },
  { value: 'change_status', label: 'Změnit stav entity' },
  { value: 'send_notification', label: 'Odeslat notifikaci' },
  { value: 'send_email', label: 'Odeslat e-mail' },
  { value: 'assign_user', label: 'Přiřadit osobu' },
  { value: 'set_priority', label: 'Nastavit prioritu' },
  { value: 'add_note', label: 'Přidat poznámku' },
  { value: 'create_invoice', label: 'Vytvořit fakturu' },
  { value: 'create_service_schedule', label: 'Vytvořit servisní plán' },
  { value: 'update_field', label: 'Aktualizovat pole' },
  { value: 'webhook', label: 'Webhook (HTTP)' },
];

export const DEFAULT_PROJECT_STATUSES = [
  { key: 'draft', label: 'Koncept' },
  { key: 'quote', label: 'Nabídka' },
  { key: 'approval', label: 'Schválení' },
  { key: 'execution', label: 'Realizace' },
  { key: 'done', label: 'Dokončeno' },
  { key: 'cancelled', label: 'Zrušeno' },
];

export const DEFAULT_TASK_STATUSES = [
  { key: 'todo', label: 'K vyřízení' },
  { key: 'in_progress', label: 'Rozpracováno' },
  { key: 'done', label: 'Hotovo' },
  { key: 'blocked', label: 'Blokováno' },
];

export function getStatusesForEntity(
  entity: string,
  projectStatuses: { key: string; label: string }[],
  taskStatuses: { key: string; label: string }[],
): { key: string; label: string }[] {
  switch (entity) {
    case 'project': return projectStatuses.length > 0 ? projectStatuses : DEFAULT_PROJECT_STATUSES;
    case 'task': return taskStatuses.length > 0 ? taskStatuses : DEFAULT_TASK_STATUSES;
    case 'invoice': return INVOICE_STATUSES;
    case 'quote': return QUOTE_STATUSES;
    case 'defect': return DEFECT_STATUSES;
    case 'milestone': return MILESTONE_STATUSES;
    case 'service_ticket': return SERVICE_TICKET_STATUSES;
    case 'asset': return ASSET_STATUSES;
    default: return [];
  }
}

export function getEntityLabel(entity: string): string {
  return TRIGGER_ENTITIES.find(e => e.value === entity)?.label ?? entity;
}

export function getEntityColor(entity: string): string {
  return TRIGGER_ENTITIES.find(e => e.value === entity)?.color ?? 'bg-slate-100 text-slate-600';
}

export function getEventLabel(entity: string, event: string): string {
  return (TRIGGER_EVENTS[entity] ?? []).find(e => e.value === event)?.label ?? event;
}

export function getActionLabel(type: string): string {
  return ACTION_TYPES.find(a => a.value === type)?.label ?? type;
}

export function buildTriggerSummary(
  entity: string,
  event: string,
  conditions: Record<string, unknown>,
  projectStatuses: { key: string; label: string }[],
  taskStatuses: { key: string; label: string }[],
): string {
  const entityLabel = getEntityLabel(entity);
  const eventLabel = getEventLabel(entity, event);
  const statuses = getStatusesForEntity(entity, projectStatuses, taskStatuses);

  let condStr = '';

  if (event === 'status_changed') {
    const from = conditions.from_status as string | undefined;
    const to = conditions.to_status as string | undefined;
    const fromLabel = from ? (statuses.find(s => s.key === from)?.label ?? from) : null;
    const toLabel = to ? (statuses.find(s => s.key === to)?.label ?? to) : null;
    if (from || to) {
      condStr = ` (${fromLabel ?? 'libovolný'} → ${toLabel ?? 'libovolný'})`;
    }
  } else if (event === 'due_date_approaching' || event === 'deadline_approaching' ||
    event === 'start_approaching' || event === 'end_approaching' ||
    event === 'due_soon' || event === 'due_item_approaching' ||
    event === 'warranty_expiring') {
    condStr = ` (${conditions.days_before ?? 3} dní před)`;
  } else if (event === 'open_too_long' || event === 'no_activity' || event === 'approval_pending') {
    condStr = ` (${conditions.days_threshold ?? 7} dní)`;
  } else if (event === 'amount_threshold') {
    condStr = ` (> ${conditions.amount ?? 0} Kč)`;
  } else if (event === 'progress_threshold') {
    condStr = ` (>= ${conditions.progress ?? 50}%)`;
  } else if (event === 'hours_exceeded') {
    condStr = ` (> ${conditions.hours ?? 100} h)`;
  } else if (event === 'priority_changed') {
    const to = conditions.to_priority as string | undefined;
    if (to) {
      const label = PRIORITY_OPTIONS.find(p => p.key === to)?.label ?? to;
      condStr = ` (na ${label})`;
    }
  } else if (event === 'assigned') {
    const to = conditions.assigned_to as string | undefined;
    if (to) condStr = ` (konkrétní osobě)`;
  } else if (event === 'severity_critical') {
    const sev = conditions.min_severity as string | undefined;
    if (sev) {
      const label = DEFECT_SEVERITIES.find(s => s.key === sev)?.label ?? sev;
      condStr = ` (${label}+)`;
    }
  } else if (event === 'cost_overrun') {
    condStr = ` (> ${conditions.percent ?? 10}%)`;
  }

  return `${entityLabel}: ${eventLabel}${condStr}`;
}

export const EMPTY_RULE: AutomationRule = {
  name: '',
  description: '',
  is_active: true,
  trigger_entity: 'project',
  trigger_event: 'status_changed',
  trigger_conditions: {},
  actions: [],
};
