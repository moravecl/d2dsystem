import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { PortalAuthProvider } from './contexts/PortalAuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { SuperAdminProvider } from './contexts/SuperAdminContext';
import { ToastProvider } from './components/ui/Toast';
import { TimerProvider } from './contexts/TimerContext';
import { ActiveMeetingProvider } from './contexts/ActiveMeetingContext';
import { TourProvider } from './contexts/TourContext';
import { PageErrorBoundary } from './components/ui/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/superadmin/SuperAdminRoute';

import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';

import PlanProtectedRoute from './components/ui/PlanProtectedRoute';


// Stranky se nacitaji az pri prvni navsteve sve routy (code-splitting).
// Po novem deployi mohou stare chunky vratit 404 - v tom pripade se stranka
// jednou obnovi, aby si stahla aktualni verzi.
function lazyPage<T extends { default: React.ComponentType<any> }>(load: () => Promise<T>) {
  return lazy(() =>
    load()
      .then((mod) => {
        sessionStorage.removeItem('chunk-reload');
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem('chunk-reload')) {
          sessionStorage.setItem('chunk-reload', '1');
          window.location.reload();
          return new Promise<T>(() => {});
        }
        throw err;
      })
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-white/[0.04] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );
}

const SuperAdminLayout = lazyPage(() => import('./components/superadmin/SuperAdminLayout'));
const SuperAdminDashboard = lazyPage(() => import('./pages/superadmin/SuperAdminDashboard'));
const SuperAdminOrganizations = lazyPage(() => import('./pages/superadmin/SuperAdminOrganizations'));
const SuperAdminUsers = lazyPage(() => import('./pages/superadmin/SuperAdminUsers'));
const SuperAdminHealth = lazyPage(() => import('./pages/superadmin/SuperAdminHealth'));
const SuperAdminPlans = lazyPage(() => import('./pages/superadmin/SuperAdminPlans'));
const SuperAdminAnnouncements = lazyPage(() => import('./pages/superadmin/SuperAdminAnnouncements'));
const SuperAdminActivity = lazyPage(() => import('./pages/superadmin/SuperAdminActivity'));
const OnboardingPage = lazyPage(() => import('./pages/onboarding/OnboardingPage'));
const AdminLayout = lazyPage(() => import('./components/layout/AdminLayout'));
const PortalLayout = lazyPage(() => import('./components/portal/PortalLayout'));
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'));
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const ClientsPage = lazyPage(() => import('./pages/crm/ClientsPage'));
const ClientDetailPage = lazyPage(() => import('./pages/crm/ClientDetailPage'));
const ProjectsListPage = lazyPage(() => import('./pages/projects/ProjectsListPage'));
const ArchivePage = lazyPage(() => import('./pages/projects/ArchivePage'));
const ProjectDetailPage = lazyPage(() => import('./pages/projects/ProjectDetailPage'));
const CatalogListPage = lazyPage(() => import('./pages/catalog/CatalogListPage'));
const CatalogPage = lazyPage(() => import('./pages/CatalogPage'));
const ExecutionPage = lazyPage(() => import('./pages/ExecutionPage'));
const DesignEditorPage = lazyPage(() => import('./pages/projects/DesignEditorPage'));
const ProductAssignmentPage = lazyPage(() => import('./pages/projects/ProductAssignmentPage'));
const FvDesignerPage = lazyPage(() => import('./pages/projects/FvDesignerPage'));
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const CategoriesPage = lazyPage(() => import('./pages/admin/CategoriesPage'));
const ProductsPage = lazyPage(() => import('./pages/admin/ProductsPage'));
const DesignModulesPage = lazyPage(() => import('./pages/admin/DesignModulesPage'));
const PresetsPage = lazyPage(() => import('./pages/admin/PresetsPage'));
const UsersPage = lazyPage(() => import('./pages/admin/UsersPage'));
const InspirationsPage = lazyPage(() => import('./pages/admin/InspirationsPage'));
const MaterialsPage = lazyPage(() => import('./pages/admin/MaterialsPage'));
const HeatingSystemsPage = lazyPage(() => import('./pages/admin/HeatingSystemsPage'));
const TemplatesPage = lazyPage(() => import('./pages/admin/TemplatesPage'));
const SystemSettingsPage = lazyPage(() => import('./pages/admin/SystemSettingsPage'));
const CompanyInfoPage = lazyPage(() => import('./pages/admin/CompanyInfoPage'));
const DocumentEditorPage = lazyPage(() => import('./pages/projects/DocumentEditorPage'));
const InspiracePage = lazyPage(() => import('./pages/InspiracePage'));
const InspirationDetailPage = lazyPage(() => import('./pages/InspirationDetailPage'));
const PortalLoginPage = lazyPage(() => import('./pages/portal/PortalLoginPage'));
const PortalProjectsPage = lazyPage(() => import('./pages/portal/PortalProjectsPage'));
const PortalProjectDetailPage = lazyPage(() => import('./pages/portal/PortalProjectDetailPage'));
const AttendancePage = lazyPage(() => import('./pages/AttendancePage'));
const AssetDashboardPage = lazyPage(() => import('./pages/assets/AssetDashboardPage'));
const AssetListPage = lazyPage(() => import('./pages/assets/AssetListPage'));
const AssetDetailPage = lazyPage(() => import('./pages/assets/AssetDetailPage'));
const DueItemsPage = lazyPage(() => import('./pages/assets/DueItemsPage'));
const ServiceHistoryPage = lazyPage(() => import('./pages/assets/ServiceHistoryPage'));
const TasksBoardPage = lazyPage(() => import('./pages/tasks/TasksBoardPage'));
const TimeTrackingPage = lazyPage(() => import('./pages/timetracking/TimeTrackingPage'));
const WarehousePage = lazyPage(() => import('./pages/warehouse/WarehousePage'));
const QrPrintPage = lazyPage(() => import('./pages/warehouse/QrPrintPage'));
const ReportsPage = lazyPage(() => import('./pages/reports/ReportsPage'));
const CalendarPage = lazyPage(() => import('./pages/calendar/CalendarPage'));
const FinancialPage = lazyPage(() => import('./pages/financial/FinancialPage'));
const InvoiceFormPage = lazyPage(() => import('./pages/financial/InvoiceFormPage'));
const InvoiceDetailPage = lazyPage(() => import('./pages/financial/InvoiceDetailPage'));
const ReceivedInvoicesPage = lazyPage(() => import('./pages/financial/ReceivedInvoicesPage'));
const SuppliersPage = lazyPage(() => import('./pages/financial/SuppliersPage'));
const CashRegisterPage = lazyPage(() => import('./pages/financial/CashRegisterPage'));
const FixedCostsPage = lazyPage(() => import('./pages/financial/FixedCostsPage'));
const CashflowPage = lazyPage(() => import('./pages/financial/CashflowPage'));
const BankPage = lazyPage(() => import('./pages/financial/bank/BankPage'));
const EmployeesPage = lazyPage(() => import('./pages/employees/EmployeesPage'));
const GanttPage = lazyPage(() => import('./pages/gantt/GanttPage'));
const ServicePage = lazyPage(() => import('./pages/service/ServicePage'));
const QuickJobsPage = lazyPage(() => import('./pages/quickjobs/QuickJobsPage'));
const InvoiceSettingsPage = lazyPage(() => import('./pages/admin/InvoiceSettingsPage'));
const EmailingPage = lazyPage(() => import('./pages/emailing/EmailingPage'));
const MailboxPage = lazyPage(() => import('./pages/mail/MailboxPage'));
const SmtpAccountsPage = lazyPage(() => import('./pages/admin/SmtpAccountsPage'));
const NotificationSettingsPage = lazyPage(() => import('./pages/admin/NotificationSettingsPage'));
const EmailTemplatesPage = lazyPage(() => import('./pages/admin/EmailTemplatesPage'));
const LicencePage = lazyPage(() => import('./pages/admin/LicencePage'));
const GdprPage = lazyPage(() => import('./pages/admin/GdprPage'));
const AuditLogPage = lazyPage(() => import('./pages/admin/AuditLogPage'));
const ProjectTypesPage = lazyPage(() => import('./pages/admin/ProjectTypesPage'));
const CustomFieldsPage = lazyPage(() => import('./pages/admin/CustomFieldsPage'));
const ProjectTemplatesPage = lazyPage(() => import('./pages/admin/ProjectTemplatesPage'));
const ProtocolTemplatesPage = lazyPage(() => import('./pages/admin/ProtocolTemplatesPage'));
const FvCatalogPage = lazyPage(() => import('./pages/admin/FvCatalogPage'));
const CameraCatalogPage = lazyPage(() => import('./pages/admin/CameraCatalogPage'));
const CameraDesignerPage = lazyPage(() => import('./pages/projects/CameraDesignerPage'));
const CameraQuotePage = lazyPage(() => import('./pages/projects/CameraQuotePage'));
const EpsDesignerPage = lazyPage(() => import('./pages/projects/EpsDesignerPage'));
const EpsQuotePage = lazyPage(() => import('./pages/projects/EpsQuotePage'));
const EpsCatalogPage = lazyPage(() => import('./pages/admin/EpsCatalogPage'));
const AutomationsPage = lazyPage(() => import('./pages/admin/AutomationsPage'));
const SidebarSettingsPage = lazyPage(() => import('./pages/admin/SidebarSettingsPage'));
const ResourceGroupsPage = lazyPage(() => import('./pages/admin/ResourceGroupsPage'));
const InquiryFormsPage = lazyPage(() => import('./pages/admin/InquiryFormsPage'));
const DesignElementTypesPage = lazyPage(() => import('./pages/admin/DesignElementTypesPage'));
const DesignerConfigPage = lazyPage(() => import('./pages/admin/DesignerConfigPage'));
const CompatibilityPage = lazyPage(() => import('./pages/admin/CompatibilityPage'));
const DesignSeriesLinksPage = lazyPage(() => import('./pages/admin/DesignSeriesLinksPage'));
const LeadsPage = lazyPage(() => import('./pages/leads/LeadsPage'));
const EventsPage = lazyPage(() => import('./pages/events/EventsPage'));
const MeetingsPage = lazyPage(() => import('./pages/meetings/MeetingsPage'));
const MeetingDetailPage = lazyPage(() => import('./pages/meetings/MeetingDetailPage'));
const KnowledgePage = lazyPage(() => import('./pages/knowledge/KnowledgePage'));
const NewsPage = lazyPage(() => import('./pages/news/NewsPage'));
const TermsPage = lazyPage(() => import('./pages/legal/TermsPage'));
const PrivacyPage = lazyPage(() => import('./pages/legal/PrivacyPage'));
const DocumentsPage = lazyPage(() => import('./pages/documents/DocumentsPage'));

export default function App() {
  return (
    <PageErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <SuperAdminProvider>
        <OrganizationProvider>
        <TourProvider>
        <TimerProvider>
        <ActiveMeetingProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/podminky" element={<TermsPage />} />
            <Route path="/soukromi" element={<PrivacyPage />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/admin/register" element={<Navigate to="/register" replace />} />

            <Route path="/inspirace" element={<InspiracePage />} />
            <Route path="/inspirace/:slug" element={<InspirationDetailPage />} />

            <Route path="/designer" element={<CatalogPage />} />

            <Route
              path="/portal/login"
              element={
                <PortalAuthProvider>
                  <PortalLoginPage />
                </PortalAuthProvider>
              }
            />
            <Route
              path="/portal"
              element={
                <PortalAuthProvider>
                  <PortalLayout />
                </PortalAuthProvider>
              }
            >
              <Route index element={<PortalProjectsPage />} />
              <Route path="projekt/:id" element={<PortalProjectDetailPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/crm" element={<ClientsPage />} />
              <Route path="/leady" element={<LeadsPage />} />
              <Route path="/crm/:id" element={<ClientDetailPage />} />
              <Route path="/projekty" element={<ProjectsListPage />} />
              <Route path="/archiv" element={<ArchivePage />} />
              <Route path="/projekty/:id" element={<ProjectDetailPage />} />
              <Route path="/projekty/:id/navrh" element={<DesignEditorPage />} />
              <Route path="/projekty/:id/prirazeni" element={<ProductAssignmentPage />} />
              <Route path="/projekty/:id/fv-navrh" element={<FvDesignerPage />} />
              <Route path="/projekty/:id/kamerovy-system" element={<CameraDesignerPage />} />
              <Route path="/projekty/:id/kamerovy-system/kalkulace" element={<CameraQuotePage />} />
              <Route path="/projekty/:id/eps-navrh" element={<EpsDesignerPage />} />
              <Route path="/projekty/:id/eps-navrh/kalkulace" element={<EpsQuotePage />} />
              <Route path="/projekty/:id/dokument/:docId" element={<DocumentEditorPage />} />
              <Route path="/katalog" element={<CatalogListPage />} />
              <Route path="/realizace" element={<ExecutionPage />} />
              <Route path="/dochazka" element={<AttendancePage />} />
              <Route path="/ukoly" element={<TasksBoardPage />} />
              <Route path="/cas" element={<TimeTrackingPage />} />
              <Route path="/sklad" element={<WarehousePage />} />
              <Route path="/warehouse" element={<Navigate to="/sklad" replace />} />
              <Route path="/warehouse/print-qr" element={<QrPrintPage />} />
              <Route path="/reporty" element={<PlanProtectedRoute requiredTier="pro" featureName="Reporty a analýzy"><ReportsPage /></PlanProtectedRoute>} />
              <Route path="/porady" element={<MeetingsPage />} />
              <Route path="/porady/:id" element={<MeetingDetailPage />} />
              <Route path="/udalosti" element={<EventsPage />} />
              <Route path="/kalendar" element={<CalendarPage />} />
              <Route path="/finance" element={<FinancialPage />} />
              <Route path="/finance/faktura/nova" element={<InvoiceFormPage />} />
              <Route path="/finance/faktura/:id" element={<InvoiceDetailPage />} />
              <Route path="/finance/faktura/:id/edit" element={<InvoiceFormPage />} />
              <Route path="/finance/prijate" element={<ReceivedInvoicesPage />} />
              <Route path="/finance/dodavatele" element={<SuppliersPage />} />
              <Route path="/finance/pokladna" element={<CashRegisterPage />} />
              <Route path="/finance/stale-naklady" element={<FixedCostsPage />} />
              <Route path="/finance/cashflow" element={<CashflowPage />} />
              <Route path="/finance/banka" element={<BankPage />} />
              <Route path="/emailing" element={<PlanProtectedRoute requiredTier="pro" featureName="Hromadný emailing"><EmailingPage /></PlanProtectedRoute>} />
              <Route path="/posta" element={<MailboxPage />} />
              <Route path="/zamestnanci" element={<EmployeesPage />} />
              <Route path="/gantt" element={<PlanProtectedRoute requiredTier="pro" featureName="Ganttův diagram"><GanttPage /></PlanProtectedRoute>} />
              <Route path="/dokumenty" element={<DocumentsPage />} />
              <Route path="/znalosti" element={<KnowledgePage />} />
              <Route path="/nastenka" element={<NewsPage />} />
              <Route path="/rychle-zakazky" element={<QuickJobsPage />} />
              <Route path="/servis" element={<ServicePage />} />
              <Route path="/majetek" element={<AssetDashboardPage />} />
              <Route path="/majetek/vozidla" element={<AssetListPage assetType="vehicle" />} />
              <Route path="/majetek/zarizeni" element={<AssetListPage assetType="appliance" />} />
              <Route path="/majetek/budovy" element={<AssetListPage assetType="building" />} />
              <Route path="/majetek/terminy" element={<DueItemsPage />} />
              <Route path="/majetek/historie" element={<ServiceHistoryPage />} />
              <Route path="/majetek/:id" element={<AssetDetailPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="design-modules" element={<DesignModulesPage />} />
              <Route path="presets" element={<PresetsPage />} />
              <Route path="formulare" element={<InquiryFormsPage />} />
              <Route path="inspirations" element={<InspirationsPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              <Route path="heating" element={<HeatingSystemsPage />} />
              <Route path="fv-katalog" element={<FvCatalogPage />} />
              <Route path="camera-katalog" element={<CameraCatalogPage />} />
              <Route path="eps-katalog" element={<EpsCatalogPage />} />
              <Route path="design-element-types" element={<DesignElementTypesPage />} />
              <Route path="designer-config" element={<DesignerConfigPage />} />
              <Route path="compatibility" element={<CompatibilityPage />} />
              <Route path="design-series-links" element={<DesignSeriesLinksPage />} />
              <Route path="project-types" element={<ProjectTypesPage />} />
              <Route path="custom-fields" element={<CustomFieldsPage />} />
              <Route path="project-templates" element={<ProjectTemplatesPage />} />
              <Route path="protocol-templates" element={<ProtocolTemplatesPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="team" element={<Navigate to="/admin/users" replace />} />
              <Route path="roles" element={<Navigate to="/admin/users" replace />} />
              <Route path="system" element={<SystemSettingsPage />} />
              <Route path="firma" element={<CompanyInfoPage />} />
              <Route path="fakturace" element={<InvoiceSettingsPage />} />
              <Route path="smtp" element={<SmtpAccountsPage />} />
              <Route path="email-sablony" element={<EmailTemplatesPage />} />
              <Route path="licence" element={<LicencePage />} />
              <Route path="gdpr" element={<GdprPage />} />
              <Route path="automatizace" element={<AutomationsPage />} />
              <Route path="notifikace" element={<NotificationSettingsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
              <Route path="sidebar" element={<SidebarSettingsPage />} />
              <Route path="resource-groups" element={<ResourceGroupsPage />} />
            </Route>

            <Route
              path="/superadmin"
              element={
                <SuperAdminRoute>
                  <SuperAdminLayout />
                </SuperAdminRoute>
              }
            >
              <Route index element={<SuperAdminDashboard />} />
              <Route path="organizations" element={<SuperAdminOrganizations />} />
              <Route path="users" element={<SuperAdminUsers />} />
              <Route path="health" element={<SuperAdminHealth />} />
              <Route path="plans" element={<SuperAdminPlans />} />
              <Route path="activity" element={<SuperAdminActivity />} />
              <Route path="announcements" element={<SuperAdminAnnouncements />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </ToastProvider>
        </ActiveMeetingProvider>
        </TimerProvider>
        </TourProvider>
        </OrganizationProvider>
        </SuperAdminProvider>
      </AuthProvider>
    </BrowserRouter>
    </PageErrorBoundary>
  );
}
