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
import ResidentLogin from "./pages/ResidentLogin.tsx";
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
import AppTeam from "./pages/app/Team.tsx";
import ClientPortal from "./pages/app/ClientPortal.tsx";
import ContentPipeline from "./pages/app/Content.tsx";
import { Sales, LegalContracts, ManagementOps, Finance } from "./pages/app/Departments.tsx";
import ClientRelations from "./pages/app/Clients.tsx";
import Shoots from "./pages/app/Shoots.tsx";
import EquipmentPage from "./pages/app/Equipment.tsx";

import RequireRole from "./components/system/RequireRole";



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
          path="/app/team"
          element={
            <RequireRole gate="leadership">
              <AppTeam />
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
        <Route
          path="/app/clients"
          element={
            <RequireRole gate="clients">
              <ClientRelations />
            </RequireRole>
          }
        />
        <Route
          path="/app/sales"
          element={
            <RequireRole gate="sales">
              <Sales />
            </RequireRole>
          }
        />
        <Route
          path="/app/legal"
          element={
            <RequireRole gate="legal">
              <LegalContracts />
            </RequireRole>
          }
        />
        <Route
          path="/app/ops"
          element={
            <RequireRole gate="ops">
              <ManagementOps />
            </RequireRole>
          }
        />
        <Route
          path="/app/finance"
          element={
            <RequireRole gate="finance">
              <Finance />
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

        <Route path="/residents/login" element={<ResidentLogin />} />
        <Route path="/residents/portal" element={<ResidentPortal />} />
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
        <ScrollToTop />
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
