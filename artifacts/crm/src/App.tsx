import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/Sidebar";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminLeads from "@/pages/admin/Leads";
import AdminAgents from "@/pages/admin/Agents";
import AdminReports from "@/pages/admin/Reports";
import BulkUpload from "@/pages/admin/BulkUpload";
import AgentDashboard from "@/pages/agent/Dashboard";
import AgentLeads from "@/pages/agent/Leads";
import AgentDialer from "@/pages/agent/Dialer";
import LeadDetail from "@/pages/LeadDetail";
import Settings from "@/pages/Settings";
import CalendarPage from "@/pages/Calendar";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: "admin" | "agent" }) {
  const { user, token } = useAuth();
  const [location] = useLocation();

  if (!token || !user) {
    return <Redirect to="/login" />;
  }

  if (role && user.role !== role) {
    return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/agent/dashboard"} />;
  }

  return <>{children}</>;
}

function AppRouter() {
  const { user, token } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        {token && user
          ? <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/agent/dashboard"} />
          : <Redirect to="/login" />}
      </Route>

      {/* Admin routes */}
      <Route path="/admin/dashboard">
        <ProtectedRoute role="admin">
          <AppLayout><AdminDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/leads/:id">
        <ProtectedRoute role="admin">
          <AppLayout><LeadDetail basePath="admin" /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/leads">
        <ProtectedRoute role="admin">
          <AppLayout><AdminLeads /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/agents">
        <ProtectedRoute role="admin">
          <AppLayout><AdminAgents /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/reports">
        <ProtectedRoute role="admin">
          <AppLayout><AdminReports /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/bulk-upload">
        <ProtectedRoute role="admin">
          <AppLayout><BulkUpload /></AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Agent routes */}
      <Route path="/agent/dashboard">
        <ProtectedRoute role="agent">
          <AppLayout><AgentDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/leads/:id">
        <ProtectedRoute role="agent">
          <AppLayout><LeadDetail basePath="agent" /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/leads">
        <ProtectedRoute role="agent">
          <AppLayout><AgentLeads /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/dialer">
        <ProtectedRoute role="agent">
          <AppLayout><AgentDialer /></AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Calendar routes */}
      <Route path="/admin/calendar">
        <ProtectedRoute role="admin">
          <AppLayout><CalendarPage /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agent/calendar">
        <ProtectedRoute role="agent">
          <AppLayout><CalendarPage /></AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Shared routes */}
      <Route path="/settings">
        <ProtectedRoute>
          <AppLayout><Settings /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route>
        {token && user
          ? <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/agent/dashboard"} />
          : <Redirect to="/login" />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRouter />
            </WouterRouter>
          </AuthProvider>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
