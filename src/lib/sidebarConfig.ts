import {
  LayoutDashboard,
  Users,
  Megaphone,
  FolderKanban,
  HardHat,
  CheckSquare,
  Wrench,
  Clock,
  GanttChart,
  Calendar,
  Package,
  Warehouse,
  BoxIcon,
  DollarSign,
  Mail,
  UserCog,
  BarChart3,
  Archive,
  CalendarDays,
  BookOpen,
  Newspaper,
  FileArchive,
  MessageSquare,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SidebarItemDef {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  expandable?: boolean;
}

export const ALL_SIDEBAR_ITEMS: SidebarItemDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'crm', label: 'CRM', icon: Users, to: '/crm' },
  { key: 'leady', label: 'Leady', icon: Megaphone, to: '/leady' },
  { key: 'projekty', label: 'Projekty', icon: FolderKanban, to: '/projekty' },
  { key: 'realizace', label: 'Realizace', icon: HardHat, to: '/realizace' },
  { key: 'ukoly', label: 'Úkoly', icon: CheckSquare, to: '/ukoly' },
  { key: 'rychle-zakazky', label: 'Rychlé zakázky', icon: Zap, to: '/rychle-zakazky' },
  { key: 'servis', label: 'Servis', icon: Wrench, to: '/servis' },
  { key: 'cas', label: 'Čas', icon: Clock, to: '/cas' },
  { key: 'gantt', label: 'Gantt', icon: GanttChart, to: '/gantt' },
  { key: 'porady', label: 'Porady', icon: MessageSquare, to: '/porady' },
  { key: 'udalosti', label: 'Události', icon: CalendarDays, to: '/udalosti' },
  { key: 'kalendar', label: 'Kalendář', icon: Calendar, to: '/kalendar' },
  { key: 'dochazka', label: 'Docházka', icon: Clock, to: '/dochazka' },
  { key: 'katalog', label: 'Katalog', icon: Package, to: '/katalog' },
  { key: 'sklad', label: 'Sklad', icon: Warehouse, to: '/sklad' },
  { key: 'majetek', label: 'Majetek', icon: BoxIcon, to: '/majetek', expandable: true },
  { key: 'finance', label: 'Finance', icon: DollarSign, to: '/finance', expandable: true },
  { key: 'emailing', label: 'Emailing', icon: Mail, to: '/emailing' },
  { key: 'zamestnanci', label: 'Zaměstnanci', icon: UserCog, to: '/zamestnanci' },
  { key: 'dokumenty', label: 'Dokumenty', icon: FileArchive, to: '/dokumenty' },
  { key: 'znalosti', label: 'Znalosti', icon: BookOpen, to: '/znalosti' },
  { key: 'nastenka', label: 'Nástěnka', icon: Newspaper, to: '/nastenka' },
  { key: 'reporty', label: 'Reporty', icon: BarChart3, to: '/reporty' },
  { key: 'archiv', label: 'Archív', icon: Archive, to: '/archiv' },
];

export interface SidebarItemSetting {
  key: string;
  visible: boolean;
  groupId?: string | null;
}

export interface SidebarGroup {
  id: string;
  name: string;
  description: string;
  collapsed?: boolean;
}

export const DEFAULT_GROUPS: SidebarGroup[] = [
  { id: 'obchod', name: 'Obchod', description: 'CRM, leady a projekty' },
  { id: 'realizace', name: 'Realizace', description: 'Stavba, ukoly a servis' },
  { id: 'planovani', name: 'Planovani', description: 'Cas, kalendar a porady' },
  { id: 'provoz', name: 'Provoz', description: 'Sklad, majetek a finance' },
  { id: 'ostatni', name: 'Ostatni', description: 'Dokumenty, znalosti a dalsi' },
];

const DEFAULT_GROUP_MAP: Record<string, string> = {
  dashboard: '',
  crm: 'obchod',
  leady: 'obchod',
  projekty: 'obchod',
  realizace: 'realizace',
  ukoly: 'realizace',
  'rychle-zakazky': 'realizace',
  servis: 'realizace',
  cas: 'planovani',
  gantt: 'planovani',
  porady: 'planovani',
  udalosti: 'planovani',
  kalendar: 'planovani',
  dochazka: 'planovani',
  katalog: 'provoz',
  sklad: 'provoz',
  majetek: 'provoz',
  finance: 'provoz',
  emailing: 'ostatni',
  zamestnanci: 'ostatni',
  dokumenty: 'ostatni',
  znalosti: 'ostatni',
  nastenka: 'ostatni',
  reporty: 'ostatni',
  archiv: 'ostatni',
};

export const DEFAULT_ORDER: SidebarItemSetting[] = ALL_SIDEBAR_ITEMS.map((item) => ({
  key: item.key,
  visible: true,
  groupId: DEFAULT_GROUP_MAP[item.key] || null,
}));
