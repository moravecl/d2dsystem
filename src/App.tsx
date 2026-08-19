import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminOrganizations from './pages/superadmin/SuperAdminOrganizations';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminHealth from './pages/superadmin/SuperAdminHealth';
import SuperAdminPlans from './pages/superadmin/SuperAdminPlans';
import SuperAdminAnnouncements from './pages/superadmin/SuperAdminAnnouncements';
import SuperAdminActivity from './pages/superadmin/SuperAdminActivity';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import AppLayout from './components/layout/AppLayout';
import AdminLayout from './components/layout/AdminLayout';
import PortalLayout from './components/portal/PortalLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/crm/ClientsPage';
import ClientDetailPage from './pages/crm/ClientDetailPage';
import ProjectsListPage from './pages/projects/ProjectsListPage';
import ArchivePage from './pages/projects/ArchivePage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import CatalogListPage from './pages/catalog/CatalogListPage';
import CatalogPage from './pages/CatalogPage';
import ExecutionPage from './pages/ExecutionPage';
import DesignEditorPage from './pages/projects/DesignEditorPage';
import ProductAssignmentPage from './pages/projects/ProductAssignmentPage';
import FvDesignerPage from './pages/projects/FvDesignerPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CategoriesPage from './pages/admin/CategoriesPage';
import ProductsPage from './pages/admin/ProductsPage';
import DesignModulesPage from './pages/admin/DesignModulesPage';
import PresetsPage from './pages/admin/PresetsPage';
import UsersPage from './pages/admin/UsersPage';
import InspirationsPage from './pages/admin/InspirationsPage';
import MaterialsPage from './pages/admin/MaterialsPage';
import HeatingSystemsPage from './pages/admin/HeatingSystemsPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import CompanyInfoPage from './pages/admin/CompanyInfoPage';
import DocumentEditorPage from './pages/projects/DocumentEditorPage';
import InspiracePage from './pages/InspiracePage';
import InspirationDetailPage from './pages/InspirationDetailPage';
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalProjectsPage from './pages/portal/PortalProjectsPage';
import PortalProjectDetailPage from './pages/portal/PortalProjectDetailPage';
import AttendancePage from './pages/AttendancePage';
import AssetDashboardPage from './pages/assets/AssetDashboardPage';
import AssetListPage from './pages/assets/AssetListPage';
import AssetDetailPage from './pages/assets/AssetDetailPage';
import DueItemsPage from './pages/assets/DueItemsPage';
import ServiceHistoryPage from './pages/assets/ServiceHistoryPage';
import TasksBoardPage from './pages/tasks/TasksBoardPage';
import TimeTrackingPage from './pages/timetracking/TimeTrackingPage';
import WarehousePage from './pages/warehouse/WarehousePage';
import QrPrintPage from './pages/warehouse/QrPrintPage';
import ReportsPage from './pages/reports/ReportsPage';
import CalendarPage from './pages/calendar/CalendarPage';
import FinancialPage from './pages/financial/FinancialPage';
import InvoiceFormPage from './pages/financial/InvoiceFormPage';
import InvoiceDetailPage from './pages/financial/InvoiceDetailPage';
import ReceivedInvoicesPage from './pages/financial/ReceivedInvoicesPage';
import SuppliersPage from './pages/financial/SuppliersPage';
import CashRegisterPage from './pages/financial/CashRegisterPage';
import FixedCostsPage from './pages/financial/FixedCostsPage';
import CashflowPage from './pages/financial/CashflowPage';
import BankPage from './pages/financial/bank/BankPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import GanttPage from './pages/gantt/GanttPage';
import ServicePage from './pages/service/ServicePage';
import QuickJobsPage from './pages/quickjobs/QuickJobsPage';
import InvoiceSettingsPage from './pages/admin/InvoiceSettingsPage';
import EmailingPage from './pages/emailing/EmailingPage';
import SmtpAccountsPage from './pages/admin/SmtpAccountsPage';
import EmailTemplatesPage from './pages/admin/EmailTemplatesPage';
import LicencePage from './pages/admin/LicencePage';
import GdprPage from './pages/admin/GdprPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import ProjectTypesPage from './pages/admin/ProjectTypesPage';
import CustomFieldsPage from './pages/admin/CustomFieldsPage';
import ProjectTemplatesPage from './pages/admin/ProjectTemplatesPage';
import ProtocolTemplatesPage from './pages/admin/ProtocolTemplatesPage';
import FvCatalogPage from './pages/admin/FvCatalogPage';
import CameraCatalogPage from './pages/admin/CameraCatalogPage';
import CameraDesignerPage from './pages/projects/CameraDesignerPage';
import CameraQuotePage from './pages/projects/CameraQuotePage';
import EpsDesignerPage from './pages/projects/EpsDesignerPage';
import EpsQuotePage from './pages/projects/EpsQuotePage';
import EpsCatalogPage from './pages/admin/EpsCatalogPage';
import AutomationsPage from './pages/admin/AutomationsPage';
import SidebarSettingsPage from './pages/admin/SidebarSettingsPage';
import ResourceGroupsPage from './pages/admin/ResourceGroupsPage';
import InquiryFormsPage from './pages/admin/InquiryFormsPage';
import DesignElementTypesPage from './pages/admin/DesignElementTypesPage';
import DesignerConfigPage from './pages/admin/DesignerConfigPage';
import CompatibilityPage from './pages/admin/CompatibilityPage';
import DesignSeriesLinksPage from './pages/admin/DesignSeriesLinksPage';
import LeadsPage from './pages/leads/LeadsPage';
import EventsPage from './pages/events/EventsPage';
import MeetingsPage from './pages/meetings/MeetingsPage';
import MeetingDetailPage from './pages/meetings/MeetingDetailPage';
import KnowledgePage from './pages/knowledge/KnowledgePage';
import NewsPage from './pages/news/NewsPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import PlanProtectedRoute from './components/ui/PlanProtectedRoute';
import DocumentsPage from './pages/documents/DocumentsPage';

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
