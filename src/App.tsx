import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth";
import { ThemeProvider } from "@/components/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy load heavy pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Console = lazy(() => import("./pages/Console"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const ProxmoxServers = lazy(() => import("./pages/ProxmoxServers"));
const Docs = lazy(() => import("./pages/Docs"));
const VMMonitoring = lazy(() => import("./pages/VMMonitoring"));

// Tenant pages
const TenantSelector = lazy(() => import("./pages/TenantSelector"));
const TenantDashboard = lazy(() => import("./pages/TenantDashboard"));
const TenantServers = lazy(() => import("./pages/TenantServers"));
const TenantUsers = lazy(() => import("./pages/TenantUsers"));
const TenantSettings = lazy(() => import("./pages/TenantSettings"));
const TenantAuditLog = lazy(() => import("./pages/TenantAuditLog"));
const ProxmoxApiExplorer = lazy(() => import("./pages/ProxmoxApiExplorer"));
const ApiPlayground = lazy(() => import("./pages/ApiPlayground"));
const ServerMonitoring = lazy(() => import("./pages/ServerMonitoring"));
const NotificationsCenter = lazy(() => import("./pages/NotificationsCenter"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 15000,
    },
  },
});

// Page loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper (redirects to dashboard if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/docs"
        element={
          <Suspense fallback={<PageLoader />}>
            <Docs />
          </Suspense>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/:node/:vmid"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Console />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Admin />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Profile />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/servers"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <ProxmoxServers />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vm/:serverId/:node/:vmid/monitoring"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <VMMonitoring />
            </Suspense>
          </ProtectedRoute>
        }
      />
        {/* Tenant routes */}
        <Route
          path="/tenants"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantSelector />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/users"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantUsers />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/servers"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantServers />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantSettings />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/audit-log"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <TenantAuditLog />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/monitoring"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ServerMonitoring />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <NotificationsCenter />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/api-playground"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ApiPlayground />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/cluster/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ProxmoxApiExplorer section="cluster" />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/nodes/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ProxmoxApiExplorer section="nodes" />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/access/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ProxmoxApiExplorer section="access" />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/pools/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ProxmoxApiExplorer section="pools" />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants/:tenantId/storage/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ProxmoxApiExplorer section="storage" />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
