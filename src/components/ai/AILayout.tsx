import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AIFooter } from "./AIFooter";
import { AINav } from "./AINav";
import { ParticleField } from "./ParticleField";

export default function AILayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="ai-theme grain relative min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <ParticleField />
        <div className="ai-grid absolute inset-0 opacity-[0.14]" />
        <div className="absolute inset-0 bg-[radial-gradient(75vw_60vw_at_65%_8%,hsl(0_0%_100%/0.06),transparent_70%)]" />
      </div>

      <AINav />

      <div className="relative z-10 pt-14">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
        <AIFooter />
      </div>
    </div>
  );
}
