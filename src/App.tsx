import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Archive from "./pages/Archive.tsx";
import Residents from "./pages/Residents.tsx";
import Philosophy from "./pages/Philosophy.tsx";
import Access from "./pages/Access.tsx";
import Admin from "./pages/Admin.tsx";

import ResidentPortal from "./pages/ResidentPortal.tsx";
import NotFound from "./pages/NotFound.tsx";
import TikTokViralEconomicsUganda from "./pages/blog/TikTokViralEconomicsUganda.tsx";
import Services from "./pages/Services.tsx";
import About from "./pages/About.tsx";
import Events from "./pages/Events.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import TicketThankYou from "./pages/TicketThankYou.tsx";
import TicketView from "./pages/TicketView.tsx";
import EventsAdmin from "./pages/EventsAdmin.tsx";
import TicketScanner from "./pages/TicketScanner.tsx";
import ScrollToTop from "./components/ScrollToTop";
import AILayout from "./components/ai/AILayout";
import AIOverview from "./pages/ai/Overview.tsx";
import AISystems from "./pages/ai/Systems.tsx";
import AIKazi from "./pages/ai/Kazi.tsx";
import AIAbout from "./pages/ai/About.tsx";
import AIContact from "./pages/ai/Contact.tsx";
import { ThemeWipeProvider } from "./components/ThemeWipe";
import Login from "./pages/Login.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import StudioCalendar from "./pages/app/Calendar.tsx";
import AppSettings from "./pages/app/Settings.tsx";

import ClientPortal from "./pages/app/ClientPortal.tsx";
import ContentPipeline from "./pages/app/Content.tsx";
import SalesPage from "./pages/app/Sales.tsx";
import LegalOverview from "./pages/app/legal/Overview.tsx";
import LegalContractsPage from "./pages/app/legal/Contracts.tsx";
import LegalPartnerships from "./pages/app/legal/Partnerships.tsx";
import LegalDocuments from "./pages/app/legal/Documents.tsx";
import LegalCompliance from "./pages/app/legal/Compliance.tsx";
import OpsOverview from "./pages/app/ops/Overview.tsx";
import OpsPeople from "./pages/app/ops/People.tsx";
import OpsWorkload from "./pages/app/ops/Workload.tsx";
import OpsDeadlines from "./pages/app/ops/Deadlines.tsx";
import OpsWeeklyReport from "./pages/app/ops/WeeklyReport.tsx";
import OpsAnnouncements from "./pages/app/ops/Announcements.tsx";
import FinanceOverview from "./pages/app/finance/Overview.tsx";
import FinanceCashbook from "./pages/app/finance/Cashbook.tsx";
import FinanceRequests from "./pages/app/finance/Requests.tsx";
import FinancePayments from "./pages/app/finance/Payments.tsx";
import FinanceMonthly from "./pages/app/finance/MonthlyRun.tsx";
import FinanceLoans from "./pages/app/finance/Loans.tsx";
import FinanceBudgets from "./pages/app/finance/Budgets.tsx";
import FinanceReports from "./pages/app/finance/Reports.tsx";
import FinanceLookup from "./pages/app/finance/Lookup.tsx";
import FinanceFiling from "./pages/app/finance/Filing.tsx";
import FinanceInvoices from "./pages/app/finance/Invoices.tsx";
import FinanceTransaction from "./pages/app/FinanceTransaction.tsx";
import ResidentsHub from "./pages/app/Residents.tsx";
import ResidentRecordPage from "./pages/app/ResidentRecord.tsx";
import ResidentStrategyPage from "./pages/app/ResidentStrategy.tsx";
import StrategyOverview from "./pages/app/strategy/Overview.tsx";
import StrategyMapBuilder from "./pages/app/strategy/MapBuilder.tsx";
import StrategyGoals from "./pages/app/strategy/Goals.tsx";
import StrategyApprovals from "./pages/app/strategy/Approvals.tsx";
import ApprovalsPage from "./pages/app/Approvals.tsx";
import ChatPage from "./pages/app/Chat.tsx";
import TodoPage from "./pages/app/Todo.tsx";
import LeadershipTaskPage from "./pages/app/LeadershipTask.tsx";
import BriefsPage from "./pages/app/Briefs.tsx";
import BriefDetailPage from "./pages/app/BriefDetail.tsx";
import AnnouncementsPage from "./pages/app/Announcements.tsx";
import AnnouncementDetailPage from "./pages/app/AnnouncementDetail.tsx";
import SystemAdmin from "./pages/app/SystemAdmin.tsx";

import Shoots from "./pages/app/Shoots.tsx";
import ShootDayRun from "./pages/app/ShootDay.tsx";
import ShootDayReport from "./pages/app/ShootDayReport.tsx";

import EquipmentPage from "./pages/app/Equipment.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";


import RequireRole from "./components/system/RequireRole";
import RolesProvider from "./components/system/RolesProvider";



const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <ThemeWipeProvider>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.startsWith("/ai-automations") ? "/ai-automations" : location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/philosophy" element={<Philosophy />} />
        <Route path="/access" element={<Access />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/app"
          element={
            <RequireRole gate="staff">
              <Dashboard />
            </RequireRole>
          }
        />
        <Route
          path="/app/calendar"
          element={
            <RequireRole gate="staff">
              <StudioCalendar />
            </RequireRole>
          }
        />
        <Route
          path="/app/settings"
          element={
            <RequireRole gate="staff">
              <AppSettings />
            </RequireRole>
          }
        />

        <Route path="/app/team" element={<Navigate to="/app/system-admin" replace />} />

        <Route
          path="/app/system-admin"
          element={
            <RequireRole gate="admin">
              <SystemAdmin />
            </RequireRole>
          }
        />
        <Route
          path="/app/content"
          element={
            <RequireRole gate="content">
              <ContentPipeline />
            </RequireRole>
          }
        />
        <Route path="/app/clients" element={<Navigate to="/app/residents" replace />} />
        <Route
          path="/app/approvals"
          element={
            <RequireRole gate="staff">
              <ApprovalsPage />
            </RequireRole>
          }
        />
        <Route
          path="/app/inbox"
          element={<Navigate to="/app/chat" replace />}
        />
        <Route path="/app/todo" element={<RequireRole gate="staff"><TodoPage /></RequireRole>} />
        <Route path="/app/todo/:id" element={<RequireRole gate="staff"><LeadershipTaskPage /></RequireRole>} />
        <Route path="/app/chat" element={<RequireRole gate="staff"><ChatPage /></RequireRole>} />
        <Route path="/app/chat/:threadId" element={<RequireRole gate="staff"><ChatPage /></RequireRole>} />
        <Route path="/app/briefs" element={<RequireRole gate="staff"><BriefsPage /></RequireRole>} />
        <Route path="/app/briefs/:id" element={<RequireRole gate="staff"><BriefDetailPage /></RequireRole>} />
        <Route path="/app/announcements" element={<RequireRole gate="staff"><AnnouncementsPage /></RequireRole>} />
        <Route path="/app/announcements/:id" element={<RequireRole gate="staff"><AnnouncementDetailPage /></RequireRole>} />
        <Route
          path="/app/residents"
          element={
            <RequireRole gate="clients">
              <ResidentsHub />
            </RequireRole>
          }
        />
        <Route
          path="/app/residents/:id"
          element={
            <RequireRole gate="clients">
              <ResidentRecordPage />
            </RequireRole>
          }
        />
        <Route path="/app/strategy" element={<RequireRole gate="staff"><StrategyOverview /></RequireRole>} />
        <Route path="/app/strategy/map" element={<RequireRole gate="staff"><StrategyMapBuilder /></RequireRole>} />
        <Route path="/app/strategy/goals" element={<RequireRole gate="staff"><StrategyGoals /></RequireRole>} />
        <Route path="/app/strategy/approvals" element={<RequireRole gate="staff"><StrategyApprovals /></RequireRole>} />
        <Route
          path="/app/residents/:id/strategy"
          element={
            <RequireRole gate="clients">
              <ResidentStrategyPage />
            </RequireRole>
          }
        />

        <Route
          path="/app/shoots"
          element={
            <RequireRole gate="content">
              <Shoots />
            </RequireRole>
          }
        />
        <Route
          path="/app/shoots/:dayId"
          element={
            <RequireRole gate="content">
              <ShootDayRun />
            </RequireRole>
          }
        />
        <Route
          path="/app/shoots/:dayId/report"
          element={
            <RequireRole gate="content">
              <ShootDayReport />
            </RequireRole>
          }
        />


        <Route
          path="/app/equipment"
          element={
            <RequireRole gate="ops">
              <EquipmentPage />
            </RequireRole>
          }
        />

        <Route
          path="/app/sales"
          element={
            <RequireRole gate="sales">
              <SalesPage />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal"
          element={
            <RequireRole gate="legal">
              <LegalOverview />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal/contracts"
          element={
            <RequireRole gate="legal">
              <LegalContractsPage />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal/partnerships"
          element={
            <RequireRole gate="legal">
              <LegalPartnerships />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal/documents"
          element={
            <RequireRole gate="legal">
              <LegalDocuments />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal/compliance"
          element={
            <RequireRole gate="legal">
              <LegalCompliance />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops"
          element={
            <RequireRole gate="ops">
              <OpsOverview />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops/people"
          element={
            <RequireRole gate="ops">
              <OpsPeople />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops/workload"
          element={
            <RequireRole gate="ops">
              <OpsWorkload />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops/deadlines"
          element={
            <RequireRole gate="ops">
              <OpsDeadlines />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops/report"
          element={
            <RequireRole gate="ops">
              <OpsWeeklyReport />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops/announcements"
          element={
            <RequireRole gate="ops">
              <OpsAnnouncements />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance"
          element={
            <RequireRole gate="finance">
              <FinanceOverview />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/invoices"
          element={
            <RequireRole gate="finance">
              <FinanceInvoices />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/filing"
          element={
            <RequireRole gate="finance">
              <FinanceFiling />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/cashbook"
          element={
            <RequireRole gate="finance">
              <FinanceCashbook />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/requests"
          element={
            <RequireRole gate="staff">
              <FinanceRequests />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/payments"
          element={
            <RequireRole gate="finance">
              <FinancePayments />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/monthly"
          element={
            <RequireRole gate="finance">
              <FinanceMonthly />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/loans"
          element={
            <RequireRole gate="finance">
              <FinanceLoans />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/budgets"
          element={
            <RequireRole gate="finance">
              <FinanceBudgets />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/reports"
          element={
            <RequireRole gate="finance">
              <FinanceReports />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/lookup"
          element={
            <RequireRole gate="finance">
              <FinanceLookup />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance/t/:id"
          element={
            <RequireRole gate="finance">
              <FinanceTransaction />
            </RequireRole>
          }
        />
        <Route path="/admin" element={<Navigate to="/app/site" replace />} />
        <Route
          path="/app/site"
          element={
            <RequireRole gate="site">
              <Admin />
            </RequireRole>
          }
        />

        <Route
          path="/app/events"
          element={
            <RequireRole gate="staff">
              <EventsAdmin />
            </RequireRole>
          }
        />
        <Route
          path="/app/scan"
          element={
            <RequireRole gate="staff">
              <TicketScanner />
            </RequireRole>
          }
        />
        <Route
          path="/portal"
          element={
            <RequireRole gate="client">
              <ClientPortal />
            </RequireRole>
          }
        />
        <Route path="/portal/chat" element={<RequireRole gate="client"><ChatPage /></RequireRole>} />
        <Route path="/portal/chat/:threadId" element={<RequireRole gate="client"><ChatPage /></RequireRole>} />

        <Route path="/residents/login" element={<Navigate to="/login" replace />} />
        <Route path="/residents/portal" element={<ResidentPortal />} />
        <Route path="/residents/chat" element={<RequireRole gate="resident"><ChatPage /></RequireRole>} />
        <Route path="/residents/chat/:threadId" element={<RequireRole gate="resident"><ChatPage /></RequireRole>} />
        <Route path="/blog/tiktok-viral-economics-uganda" element={<TikTokViralEconomicsUganda />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
        <Route path="/ai-automations" element={<AILayout />}>
          <Route index element={<AIOverview />} />
          <Route path="systems" element={<AISystems />} />
          <Route path="kazi" element={<AIKazi />} />
          <Route path="about" element={<AIAbout />} />
          <Route path="contact" element={<AIContact />} />
        </Route>
        <Route path="/events" element={<Events />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/tickets/thank-you" element={<TicketThankYou />} />
        <Route path="/t/:token" element={<TicketView />} />
        <Route path="/admin/events" element={<Navigate to="/app/events" replace />} />
        <Route path="/admin/scan" element={<Navigate to="/app/scan" replace />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
    </ThemeWipeProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RolesProvider>
        <ScrollToTop />
        <AnimatedRoutes />
        </RolesProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
