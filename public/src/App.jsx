import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './utils/AuthContext'
import { CustomizationProvider } from './utils/CustomizationContext'
import { ToastProvider } from './components/ui/Toast'
import QueryClientProvider from './providers/QueryClientProvider'
import ModernSidebar from './components/ModernSidebar'
import CommandPalette from './components/CommandPalette'
import ErrorBoundary from './components/ErrorBoundary'
import OnboardingTour from './components/OnboardingTour'
import Skeleton from './components/ui/Skeleton'
import './styles/Skeleton.css'

// i18n configuration
import './i18n/config'

// Heavy components - lazy loaded
const Dashboard = lazy(() => import('./pages/NewDashboard'))
const Forms = lazy(() => import('./pages/Forms'))
const FormBuilder = lazy(() => import('./pages/FormBuilder'))
const Submissions = lazy(() => import('./pages/Submissions'))
const TableView = lazy(() => import('./pages/TableView'))
const Reports = lazy(() => import('./pages/Reports'))
const Workflows = lazy(() => import('./pages/Workflows'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const NumberFormatSettings = lazy(() => import('./pages/NumberFormatSettings'))
const Analytics = lazy(() => import('./pages/Analytics'))
const TeamCollaboration = lazy(() => import('./pages/TeamCollaboration'))
const Clients = lazy(() => import('./pages/Clients'))
const WorkOrders = lazy(() => import('./pages/WorkOrders'))
const WorkOrderForm = lazy(() => import('./pages/WorkOrderForm'))
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'))
const WorkOrderTemplates = lazy(() => import('./pages/WorkOrderTemplates'))
const WorkOrderTemplateBuilder = lazy(() => import('./pages/WorkOrderTemplateBuilder'))
const Services = lazy(() => import('./pages/Services'))
const Products = lazy(() => import('./pages/Products'))
const Materials = lazy(() => import('./pages/Materials'))
const Properties = lazy(() => import('./pages/Properties'))
const Contracts = lazy(() => import('./pages/Contracts'))
const ContractTemplates = lazy(() => import('./pages/ContractTemplates')) // NEW
const ContractDetail = lazy(() => import('./pages/ContractDetail'))
const Estimates = lazy(() => import('./pages/Estimates'))
const Invoices = lazy(() => import('./pages/Invoices'))
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'))
const Scheduling = lazy(() => import('./pages/Scheduling'))
const Employees = lazy(() => import('./pages/Employees'))
const QuickBooks = lazy(() => import('./pages/QuickBooks'))
const BusinessReports = lazy(() => import('./pages/BusinessReports'))
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'))
const ClientSubmissions = lazy(() => import('./pages/ClientSubmissions'))
const CrewMobile = lazy(() => import('./pages/CrewMobile'))
const ClientCrewTracking = lazy(() => import('./pages/ClientCrewTracking'))
const ClientSignaturePage = lazy(() => import('./pages/ClientSignaturePage'))
const ClientPortal = lazy(() => import('./pages/ClientPortal'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const ShareRoute = lazy(() => import('./components/ShareRoute'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const SetPassword = lazy(() => import('./pages/SetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Verify2FA = lazy(() => import('./pages/Verify2FA'))
const PublicForm = lazy(() => import('./pages/PublicForm'))
const PayInvoice = lazy(() => import('./pages/PayInvoice'))
const RolePicker = lazy(() => import('./pages/RolePicker'))
const BusinessRegistration = lazy(() => import('./pages/BusinessRegistration'))
const AccountReview = lazy(() => import('./pages/AccountReview'))
const BusinessApprovals = lazy(() => import('./pages/BusinessApprovals'))
const BusinessPermissions = lazy(() => import('./pages/BusinessPermissions'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const AppCustomization = lazy(() => import('./pages/AppCustomization'))
const FormEntry = lazy(() => import('./pages/FormEntry'))
const BusinessTheme = lazy(() => import('./components/BusinessTheme'))
const JobWorkflows = lazy(() => import('./pages/JobWorkflows'))
const JobWorkflowBuilder = lazy(() => import('./pages/JobWorkflowBuilder'))
const Automations = lazy(() => import('./pages/Automations'))
const NotificationsCenter = lazy(() => import('./pages/NotificationsCenter'))
const ChooseBusiness = lazy(() => import('./pages/ChooseBusiness'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const MFAOnboarding = lazy(() => import('./pages/MFAOnboarding'));
const AdminBusinessList = lazy(() => import('./pages/AdminBusinessList'));
import './styles/modern-ui.css'
import './styles/responsive-utilities.css'
import './styles/rtl.css'
import './styles/AdminPanel.css'
import './styles/AcceptInvite.css'
import './styles/AccountSettings.css'
import './styles/Analytics.css'
import './styles/AppCustomization.css'
import './styles/Breadcrumb.css'
import './styles/BusinessApprovals.css'
import './styles/BusinessPermissions.css'
import './styles/BusinessRegistration.css'
import './styles/Button.css'
import './styles/ClientCrewTracking.css'
import './styles/ClientEngagement.css'
import './styles/ClientPortal.css'
import './styles/ClientSubmissions.css'
import './styles/CommandPalette.css'
import './styles/ConditionalLogic.css'
import './styles/CrewMobile.css'
import './styles/Dashboard.css'
import './styles/EmptyState.css'
import './styles/FieldEditor.css'
import './styles/FieldPalette.css'
import './styles/FieldRenderer.css'
import './styles/FormBuilder.css'
import './styles/FormCanvas.css'
import './styles/FormEntry.css'
import './styles/FormField.css'
import './styles/FormPreview.css'
import './styles/FormSettings.css'
import './styles/ImageUpload.css'
import './styles/LanguageSwitcher.css'
import './styles/Login.css'
import './styles/MobileBottomNav.css'
import './styles/Modal.css'
import './styles/ModernSidebar.css'
import './styles/OnboardingTour.css'
import './styles/PageHeader.css'
import './styles/PageManager.css'
import './styles/PermissionSelector.css'
import './styles/PublicForm.css'
import './styles/Reports.css'
import './styles/ResponsiveImage.css'
import './styles/ResponsiveTable.css'
import './styles/ServiceCategorySelector.css'
import './styles/Skeleton.css'
import './styles/Submissions.css'
import './styles/TableView.css'
import './styles/TeamCollaboration.css'
import './styles/Toast.css'
import './styles/UserManagement.css'
import './styles/Workflows.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'

// Admin pages
const PlatformDashboard = lazy(() => import('./pages/Admin/PlatformDashboard'))
const TenantDirectory = lazy(() => import('./pages/Admin/TenantDirectory'))
const TenantDetail = lazy(() => import('./pages/Admin/TenantDetail'))
const PlatformMFASetup = lazy(() => import('./pages/Admin/MFASetup'))
const PlanManager = lazy(() => import('./pages/Admin/PlanManager'))
const WebhookExplorer = lazy(() => import('./pages/Admin/WebhookExplorer'))
const BillingHistory = lazy(() => import('./pages/Admin/BillingHistory'))
const AlertsInbox = lazy(() => import('./pages/Admin/AlertsInbox'))
const AdminSidebar = lazy(() => import('./components/Admin/AdminSidebar'))
const ImpersonationBar = lazy(() => import('./components/Admin/ImpersonationBar'))
const AuditExplorer = lazy(() => import('./pages/Admin/AuditExplorer'))
const AdminSystemHealth = lazy(() => import('./pages/SystemHealth'))

function PrivateRoute({ children, allowPending = false, adminOnly = false, superAdminOnly = false, clientOnly = false }) {
  const { user, loading, needsMfa } = useAuth()

  // Only block if we have NO user and we ARE loading
  if (loading && !user) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton variant="rectangular" height="40px" width="200px" style={{ marginBottom: '24px' }} />
        <div className="dashboard-skeleton-grid">
          <Skeleton variant="rounded" height="200px" />
          <Skeleton variant="rounded" height="200px" />
          <Skeleton variant="rounded" height="200px" />
        </div>
      </div>
    )
  }

  if (needsMfa) {
    return <Navigate to="/verify-2fa" replace />
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  // Redirect clients to client portal
  if (user.role === 'client' && !clientOnly && !window.location.pathname.startsWith('/client')) {
    return <Navigate to="/client/portal" />
  }

  if (user.role === 'client' && !clientOnly) {
    return <Navigate to="/client/portal" />
  }

  if (!allowPending && user.accountStatus && user.accountStatus !== 'active' && !user.isSuperAdmin) {
    return <Navigate to="/account-review" />
  }

  if (adminOnly && !user.isAdmin && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  if (superAdminOnly && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  return children
}

// Loading component for lazy loaded routes
function LoadingFallback() {
  return (
    <div className="modern-layout" style={{ background: 'var(--bg-secondary)' }}>
      {/* Sidebar Placeholder */}
      <aside className="modern-sidebar" style={{ opacity: 0.5, pointerEvents: 'none' }}>
        <div className="sidebar-logo"><Skeleton width="120px" height="32px" /></div>
        <div className="sidebar-nav">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ padding: '12px' }}><Skeleton height="40px" /></div>
          ))}
        </div>
      </aside>

      {/* Content Placeholder */}
      <main className="modern-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
          <Skeleton width="240px" height="40px" />
          <Skeleton width="120px" height="40px" />
        </div>
        <div className="dashboard-skeleton-grid">
          <div className="card-skeleton"><Skeleton height="100%" /></div>
          <div className="card-skeleton"><Skeleton height="100%" /></div>
          <div className="card-skeleton"><Skeleton height="100%" /></div>
        </div>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  // Routes that don't need sidebar
  const publicRoutes = (
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/mfa-onboarding" element={<MFAOnboarding />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/client/set-password" element={<SetPassword />} />
      <Route path="/client/dashboard" element={<PrivateRoute clientOnly={true}><ClientPortal /></PrivateRoute>} />
      <Route path="/client/portal" element={<PrivateRoute clientOnly={true}><ClientPortal /></PrivateRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />
      <Route path="/share/:shareKey/fill" element={<PublicForm />} />
      <Route path="/share/:shareKey" element={<ShareRoute />} />
      <Route path="/pay/:token" element={<PayInvoice />} />
      <Route path="/contracts/:id/sign/:token" element={<ClientSignaturePage />} />
      <Route
        path="/business-registration"
        element={
          <PrivateRoute>
            <BusinessRegistration />
          </PrivateRoute>
        }
      />
      <Route
        path="/account-review"
        element={
          <PrivateRoute allowPending>
            <AccountReview />
          </PrivateRoute>
        }
      />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/choose-business" element={<PrivateRoute><ChooseBusiness /></PrivateRoute>} />
      <Route path="/choose-role" element={<RolePicker />} />
    </>
  )

  // 👑 ENTERPRISE ADMIN ROUTES
  const adminRoutes = (
    <Route path="/admin" element={<AdminSidebar />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<PrivateRoute superAdminOnly><PlatformDashboard /></PrivateRoute>} />
      <Route path="tenants" element={<PrivateRoute superAdminOnly><TenantDirectory /></PrivateRoute>} />
      <Route path="tenants/:id" element={<PrivateRoute superAdminOnly><TenantDetail /></PrivateRoute>} />
      <Route path="plans" element={<PrivateRoute superAdminOnly><PlanManager /></PrivateRoute>} />
      <Route path="webhooks" element={<PrivateRoute superAdminOnly><WebhookExplorer /></PrivateRoute>} />
      <Route path="billing" element={<PrivateRoute superAdminOnly><BillingHistory /></PrivateRoute>} />
      <Route path="alerts" element={<PrivateRoute superAdminOnly><AlertsInbox /></PrivateRoute>} />
      <Route path="mfa-setup" element={<PrivateRoute superAdminOnly><PlatformMFASetup /></PrivateRoute>} />
      <Route path="approvals" element={<PrivateRoute superAdminOnly><BusinessApprovals /></PrivateRoute>} />
      <Route path="business-permissions" element={<PrivateRoute superAdminOnly><BusinessPermissions /></PrivateRoute>} />
      <Route path="global-businesses" element={<PrivateRoute superAdminOnly><AdminBusinessList /></PrivateRoute>} />
      <Route path="audit-logs" element={<PrivateRoute superAdminOnly><AuditExplorer /></PrivateRoute>} />
      <Route path="system-health" element={<PrivateRoute superAdminOnly><AdminSystemHealth /></PrivateRoute>} />
    </Route>
  )

  // Routes that need sidebar
  const protectedRoutes = (
    <Route element={<ModernSidebar />}>
      <Route path="/notifications" element={<PrivateRoute><NotificationsCenter /></PrivateRoute>} />
      <Route path="/marketplace" element={<PrivateRoute><Marketplace /></PrivateRoute>} />
    </Route>
  )

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {publicRoutes}
        {adminRoutes}
        {protectedRoutes}
        <Route path="/:tenantSlug" element={<ModernSidebar />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="forms" element={<PrivateRoute><Forms /></PrivateRoute>} />
          <Route path="properties" element={<PrivateRoute><Properties /></PrivateRoute>} />
          <Route path="form/:id" element={<PrivateRoute><FormBuilder /></PrivateRoute>} />
          <Route path="form/:id/submissions" element={<PrivateRoute><Submissions /></PrivateRoute>} />
          <Route path="form/:id/entry" element={<PrivateRoute><FormEntry /></PrivateRoute>} />
          <Route path="form/:id/table" element={<PrivateRoute><TableView /></PrivateRoute>} />
          <Route path="form/:id/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="form/:id/workflows" element={<PrivateRoute><Workflows /></PrivateRoute>} />
          <Route path="form/:id/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="form/:id/team" element={<PrivateRoute><TeamCollaboration /></PrivateRoute>} />
          <Route path="clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
          <Route path="clients/:id" element={<PrivateRoute><ClientDetail /></PrivateRoute>} />
          <Route path="work-orders" element={<PrivateRoute><WorkOrders /></PrivateRoute>} />
          <Route path="work-orders/new" element={<PrivateRoute><WorkOrderForm /></PrivateRoute>} />
          <Route path="work-orders/edit/:id" element={<PrivateRoute><WorkOrderForm /></PrivateRoute>} />
          <Route path="work-orders/:id" element={<PrivateRoute><WorkOrderDetail /></PrivateRoute>} />
          <Route path="work-orders/templates" element={<PrivateRoute><WorkOrderTemplates /></PrivateRoute>} />
          <Route path="work-orders/templates/new" element={<PrivateRoute><WorkOrderTemplateBuilder /></PrivateRoute>} />
          <Route path="work-orders/templates/:id" element={<PrivateRoute><WorkOrderTemplateBuilder /></PrivateRoute>} />
          <Route path="job-workflows" element={<PrivateRoute><JobWorkflows /></PrivateRoute>} />
          <Route path="job-workflows/new" element={<PrivateRoute><JobWorkflowBuilder /></PrivateRoute>} />
          <Route path="job-workflows/:id" element={<PrivateRoute><JobWorkflowBuilder /></PrivateRoute>} />
          <Route path="invoices" element={<PrivateRoute><Invoices /></PrivateRoute>} />
          <Route path="invoices/new" element={<PrivateRoute><InvoiceForm /></PrivateRoute>} />
          <Route path="scheduling" element={<PrivateRoute><Scheduling /></PrivateRoute>} />
          <Route path="contracts" element={<PrivateRoute><Contracts /></PrivateRoute>} />
          <Route path="contracts/templates" element={<PrivateRoute><ContractTemplates /></PrivateRoute>} />
          <Route path="contracts/:id" element={<PrivateRoute><ContractDetail /></PrivateRoute>} />
          <Route path="automations" element={<PrivateRoute><Automations /></PrivateRoute>} />
          <Route path="estimates" element={<PrivateRoute><Estimates /></PrivateRoute>} />
          <Route path="services" element={<PrivateRoute><Services /></PrivateRoute>} />
          <Route path="products" element={<PrivateRoute><Products /></PrivateRoute>} />
          <Route path="materials" element={<PrivateRoute><Materials /></PrivateRoute>} />
          <Route path="employees" element={<PrivateRoute><Employees /></PrivateRoute>} />
          <Route path="crew-mobile" element={<PrivateRoute><CrewMobile /></PrivateRoute>} />
          <Route path="quickbooks" element={<PrivateRoute><QuickBooks /></PrivateRoute>} />
          <Route path="business-reports" element={<PrivateRoute><BusinessReports /></PrivateRoute>} />
          <Route path="reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="notifications" element={<PrivateRoute><NotificationsCenter /></PrivateRoute>} />
          <Route path="number-format-settings" element={<PrivateRoute><NumberFormatSettings /></PrivateRoute>} />
          <Route path="customer/:customerId/submissions" element={<PrivateRoute><CustomerDashboard /></PrivateRoute>} />
          <Route path="client/submissions/:shareKey" element={<PrivateRoute><ClientSubmissions /></PrivateRoute>} />
          <Route path="client/crew-tracking" element={<PrivateRoute><ClientCrewTracking /></PrivateRoute>} />
          <Route path="audit-log" element={<PrivateRoute><AuditLog /></PrivateRoute>} />
          <Route path="system-health" element={<PrivateRoute><SystemHealth /></PrivateRoute>} />
          <Route path="account-settings" element={<PrivateRoute><AccountSettings /></PrivateRoute>} />
          <Route path="user-management" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
          <Route path="app-customization" element={<PrivateRoute><AppCustomization /></PrivateRoute>} />
          {/* Add more routes as needed, following the pattern */}
        </Route>
        <Route path="/" element={<Navigate to="/choose-business" />} />
        <Route path="/dashboard" element={<Navigate to="/choose-business" />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <AuthProvider>
          <CustomizationProvider>
            <ToastProvider>
              <BusinessTheme />
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true
                }}
              >
                <ImpersonationBar />
                <AppRoutes />
                <CommandPalette />
                <OnboardingTour />
              </BrowserRouter>
            </ToastProvider>
          </CustomizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
