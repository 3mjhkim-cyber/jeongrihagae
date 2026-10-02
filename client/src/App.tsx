import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SubscriptionNudgeBanner } from "@/components/SubscriptionNudgeBanner";
import { useScissorCursor } from "@/hooks/useScissorCursor";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Booking from "@/pages/Booking";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Calendar from "@/pages/Calendar";
import Deposit from "@/pages/Deposit";
import PlatformAdmin from "@/pages/PlatformAdmin";
import ShopsAdmin from "@/pages/ShopsAdmin";
import AuditLogs from "@/pages/AuditLogs";
import ShopSettings from "@/pages/ShopSettings";
import Operations from "@/pages/Operations";
import Revenue from "@/pages/Revenue";
import Subscription from "@/pages/Subscription";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Refund from "@/pages/Refund";
import Support from "@/pages/Support";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {location.startsWith("/admin") && <SubscriptionNudgeBanner />}
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/book/:slug" component={Booking} />
          <Route path="/admin/dashboard" component={Dashboard} />
          <Route path="/admin/customers" component={Customers} />
          <Route path="/admin/calendar" component={Calendar} />
          <Route path="/admin/settings" component={ShopSettings} />
          <Route path="/admin/operations" component={Operations} />
          <Route path="/admin/revenue" component={Revenue} />
          <Route path="/admin/subscription" component={Subscription} />
          {/* 가맹점 관리 전용 페이지 — 전체 목록/검색/페이지네이션 */}
          {/* 슈퍼관리자 화면 (사장님 화면 /admin/* 과 분리) */}
          <Route path="/superadmin" component={PlatformAdmin} />
          <Route path="/superadmin/shops" component={ShopsAdmin} />
          <Route path="/superadmin/audit-logs" component={AuditLogs} />
          {/* 예전 슈퍼관리자 주소 → 새 주소 */}
          <Route path="/admin/platform"><Redirect to="/superadmin" replace /></Route>
          <Route path="/admin/shops"><Redirect to="/superadmin/shops" replace /></Route>
          <Route path="/deposit/:id" component={Deposit} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/refund" component={Refund} />
          <Route path="/support" component={Support} />
          <Route component={NotFound} />
        </Switch>
      </main>

      <MobileBottomNav />

      {location !== '/' && (
        <footer className="hidden lg:block py-6 text-center text-muted-foreground text-sm border-t border-border bg-white">
          <p>&copy; 2024 정리하개. All rights reserved.</p>
        </footer>
      )}
    </div>
  );
}

function App() {
  useScissorCursor();
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
