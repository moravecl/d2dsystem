export const MODULE_KEYS = [
  'dashboard', 'crm', 'leady', 'projekty', 'realizace', 'ukoly',
  'servis', 'cas', 'gantt', 'udalosti', 'kalendar', 'dochazka',
  'katalog', 'sklad', 'majetek', 'finance', 'emailing', 'posta', 'asistent', 'konfigurator', 'zamestnanci',
  'dokumenty', 'znalosti', 'nastenka', 'reporty', 'archiv', 'admin',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  crm: 'CRM',
  leady: 'Leady',
  projekty: 'Projekty',
  realizace: 'Realizace',
  ukoly: 'Úkoly',
  servis: 'Servis',
  cas: 'Čas',
  gantt: 'Gantt',
  udalosti: 'Události',
  kalendar: 'Kalendář',
  dochazka: 'Docházka',
  katalog: 'Katalog',
  sklad: 'Sklad',
  majetek: 'Majetek',
  finance: 'Finance',
  emailing: 'Emailing',
  posta: 'Pošta',
  asistent: 'AI Asistent',
  konfigurator: 'Konfigurátor nabídek',
  zamestnanci: 'Zaměstnanci',
  dokumenty: 'Dokumenty',
  znalosti: 'Znalosti',
  nastenka: 'Nástěnka',
  reporty: 'Reporty',
  archiv: 'Archiv',
  admin: 'Administrace',
};

export const DATA_PERMISSION_KEYS = [
  'view_prices', 'view_purchase_prices', 'view_margins',
  'view_financial_reports', 'view_invoices', 'view_salaries',
  'edit_projects', 'delete_projects',
  'edit_clients', 'delete_clients',
  'edit_products', 'edit_quotes', 'approve_quotes',
  'manage_team', 'manage_roles', 'view_audit_log',
  'manage_settings', 'export_data', 'manage_templates',
  'manage_automations', 'manage_warehouse', 'manage_assets', 'manage_service',
] as const;

export type DataPermissionKey = (typeof DATA_PERMISSION_KEYS)[number];

export const DATA_PERMISSION_GROUPS: { group: string; keys: DataPermissionKey[] }[] = [
  {
    group: 'Finance a ceny',
    keys: ['view_prices', 'view_purchase_prices', 'view_margins', 'view_financial_reports', 'view_invoices', 'view_salaries'],
  },
  {
    group: 'Projekty a klienti',
    keys: ['edit_projects', 'delete_projects', 'edit_clients', 'delete_clients'],
  },
  {
    group: 'Katalog a nabídky',
    keys: ['edit_products', 'edit_quotes', 'approve_quotes'],
  },
  {
    group: 'Správa systému',
    keys: ['manage_team', 'manage_roles', 'view_audit_log', 'manage_settings', 'manage_automations', 'manage_templates'],
  },
  {
    group: 'Provoz',
    keys: ['export_data', 'manage_warehouse', 'manage_assets', 'manage_service'],
  },
];

export const DATA_PERMISSION_LABELS: Record<DataPermissionKey, string> = {
  view_prices: 'Zobrazit prodejní ceny',
  view_purchase_prices: 'Zobrazit nákupní ceny',
  view_margins: 'Zobrazit marže',
  view_financial_reports: 'Zobrazit finanční reporty',
  view_invoices: 'Zobrazit faktury',
  view_salaries: 'Zobrazit mzdy',
  edit_projects: 'Upravovat projekty',
  delete_projects: 'Mazat projekty',
  edit_clients: 'Upravovat klienty',
  delete_clients: 'Mazat klienty',
  edit_products: 'Upravovat produkty v katalogu',
  edit_quotes: 'Upravovat nabídky',
  approve_quotes: 'Schvalovat nabídky',
  manage_team: 'Spravovat tým',
  manage_roles: 'Spravovat role a oprávnění',
  view_audit_log: 'Zobrazit audit log',
  manage_settings: 'Spravovat nastavení systému',
  export_data: 'Exportovat data',
  manage_templates: 'Spravovat šablony dokumentů',
  manage_automations: 'Spravovat automatizace',
  manage_warehouse: 'Spravovat sklad',
  manage_assets: 'Spravovat majetek',
  manage_service: 'Spravovat servis',
};

export interface RolePermissions {
  modules: Partial<Record<ModuleKey, boolean>>;
  data: Partial<Record<DataPermissionKey, boolean>>;
}

export interface CustomRole {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  is_system: boolean;
  permissions: RolePermissions;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserRoleAssignment {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export function getDefaultPermissions(): RolePermissions {
  const modules: Partial<Record<ModuleKey, boolean>> = {};
  MODULE_KEYS.forEach((k) => { modules[k] = false; });
  modules.dashboard = true;

  const data: Partial<Record<DataPermissionKey, boolean>> = {};
  DATA_PERMISSION_KEYS.forEach((k) => { data[k] = false; });

  return { modules, data };
}

/**
 * Vychozi stav pred nactenim opravneni: nic neni povoleno.
 * Pouziva se jako bezpecny default, aby se pri nacitani nikdy
 * kratkodobe nezobrazila data, na ktera uzivatel nema narok.
 */
export function createNoAccessPermissions(): RolePermissions {
  const modules: Partial<Record<ModuleKey, boolean>> = {};
  MODULE_KEYS.forEach((k) => { modules[k] = false; });
  const data: Partial<Record<DataPermissionKey, boolean>> = {};
  DATA_PERMISSION_KEYS.forEach((k) => { data[k] = false; });
  return { modules, data };
}

export function createFullAccessPermissions(): RolePermissions {
  const modules: Partial<Record<ModuleKey, boolean>> = {};
  MODULE_KEYS.forEach((k) => { modules[k] = true; });
  const data: Partial<Record<DataPermissionKey, boolean>> = {};
  DATA_PERMISSION_KEYS.forEach((k) => { data[k] = true; });
  return { modules, data };
}
