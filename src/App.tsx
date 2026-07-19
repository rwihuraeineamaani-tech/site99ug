import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
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
import AdminLogin from "./pages/AdminLogin.tsx";
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

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/philosophy" element={<Philosophy />} />
        <Route path="/access" element={<Access />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/residents/login" element={<ResidentLogin />} />
        <Route path="/residents/portal" element={<ResidentPortal />} />
        <Route path="/blog/tiktok-viral-economics-uganda" element={<TikTokViralEconomicsUganda />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
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
