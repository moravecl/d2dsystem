import type { DueItem, Asset } from '../../types/assets';

export interface DashboardStats {
  clients: number;
  projects: number;
  activeProjects: number;
  products: number;
  pendingQuotes: number;
  approvedQuotes: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOverdue: number;
  hoursThisMonth: number;
  hoursLastMonth: number;
}

export interface RecentProject {
  id: string;
  project_name: string;
  client_name: string;
  status: string;
  address: string;
  deadline: string | null;
  updated_at: string;
}

export interface PipelineCount {
  status: string;
  count: number;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}

export interface ProfileRef {
  id: string;
  display_name: string | null;
  email: string;
}

export interface ServiceAlert {
  id: string;
  type_name: string;
  project_name: string;
  next_date: string;
  project_id: string;
}

export interface WarrantyAlert {
  id: string;
  name: string;
  warranty_end_date: string;
  project_id: string;
  project_name: string;
}

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  author_id: string | null;
  created_at: string;
  image_url: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  all_day: boolean;
  location: string;
  event_type_name: string;
  event_type_color: string;
}

export interface MonthlyInvoice {
  month: string;
  amount: number;
}

export interface QuickJobAlert {
  id: string;
  title: string;
  client_name: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
}

export interface DashboardData {
  profile: { display_name: string | null } | null;
  stats: DashboardStats;
  recentProjects: RecentProject[];
  pipeline: PipelineCount[];
  dueAlerts: (DueItem & { asset?: Asset })[];
  activityFeed: AuditEntry[];
  profiles: ProfileRef[];
  monthlyInvoices: MonthlyInvoice[];
  serviceAlerts: ServiceAlert[];
  openTicketsCount: number;
  warrantyAlerts: WarrantyAlert[];
  newsPosts: NewsPost[];
  newsCommentCounts: Record<string, number>;
  upcomingEvents: UpcomingEvent[];
  quickJobPoolCount: number;
  quickJobAlerts: QuickJobAlert[];
}
