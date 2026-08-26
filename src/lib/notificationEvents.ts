/**
 * Katalog notifikačních eventů. Bez záznamu v notification_preferences
 * je event ZAPNUTÝ (default-on) s výchozím počtem dní předem u termínů.
 * Stejné klíče používají DB triggery a edge funkce notify-deadlines.
 */

export const DEFAULT_DAYS_BEFORE = 14;

export interface NotificationEventDef {
  key: string;
  label: string;
  description: string;
  /** událost s termínem — uživatel si volí počet dní předem */
  hasDaysBefore?: boolean;
}

export interface NotificationEventGroup {
  group: string;
  events: NotificationEventDef[];
}

export const NOTIFICATION_EVENT_GROUPS: NotificationEventGroup[] = [
  {
    group: 'Obchod',
    events: [
      { key: 'quote_approved', label: 'Nabídka schválena', description: 'Klient schválil nabídku v portálu nebo interně' },
      { key: 'quote_returned', label: 'Nabídka vrácena', description: 'Klient vrátil nabídku k přepracování' },
      { key: 'viceprace_decided', label: 'Rozhodnutí o vícepracích', description: 'Vícepráce byly schváleny nebo zamítnuty' },
      { key: 'new_lead', label: 'Nový lead', description: 'Přišla poptávka z webového formuláře' },
      { key: 'new_service_ticket', label: 'Nový servisní tiket', description: 'Klient nebo technik založil servisní tiket' },
    ],
  },
  {
    group: 'Úkoly a tým',
    events: [
      { key: 'task_assigned', label: 'Přiřazen úkol', description: 'Někdo vám přiřadil úkol' },
    ],
  },
  {
    group: 'Finance',
    events: [
      { key: 'invoice_overdue', label: 'Faktura po splatnosti', description: 'Vydaná faktura nebyla zaplacena do splatnosti' },
      { key: 'payment_received', label: 'Přijatá platba', description: 'Faktura byla označena jako zaplacená' },
    ],
  },
  {
    group: 'Pošta',
    events: [
      { key: 'email_unassigned', label: 'Nepřiřazený e-mail', description: 'Příchozí e-mail se nepodařilo přiřadit k projektu' },
    ],
  },
  {
    group: 'Termíny',
    events: [
      { key: 'project_deadline', label: 'Termín projektu', description: 'Blíží se deadline projektu', hasDaysBefore: true },
      { key: 'insurance_expiry', label: 'Vypršení pojistky', description: 'Blíží se konec platnosti pojistky u majetku', hasDaysBefore: true },
      { key: 'revision_expiry', label: 'Revize, STK a kontroly', description: 'Blíží se termín revize, STK, emisí či jiné kontroly', hasDaysBefore: true },
      { key: 'service_due', label: 'Plánovaný servis', description: 'Blíží se naplánovaný servisní zásah u projektu', hasDaysBefore: true },
    ],
  },
];

export const ALL_NOTIFICATION_EVENT_KEYS = NOTIFICATION_EVENT_GROUPS
  .flatMap((g) => g.events.map((e) => e.key));
