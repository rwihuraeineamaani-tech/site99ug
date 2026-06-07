import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Frontier", n: "01" },
  { to: "/archive", label: "Archive", n: "02" },
  { to: "/residents", label: "Residents", n: "03" },
  { to: "/services", label: "Services", n: "04" },
  { to: "/about", label: "About", n: "05" },
  { to: "/philosophy", label: "Philosophy", n: "06" },
  { to: "/access", label: "Access", n: "07" },
];

const services = [
  { to: "/services#brand-strategy", label: "Brand Strategy & Identity" },
  { to: "/services#content-film", label: "Content & Film" },
  { to: "/services#campaigns", label: "Campaigns & Broadcast" },
  { to: "/services#residency", label: "Digital Residency" },
  { to: "/services#ai-automation", label: "AI & Automations" },
  { to: "/services#web-design", label: "Website Design" },
  { to: "/services#social-media", label: "Social Media Handling" },
];

const inlineLinks = [
  { to: "/residents", label: "Residents" },
  { to: "/archive", label: "Projects" },
  { to: "/about", label: "About" },
];

export const Nav = () => {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    setServicesOpen(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  useEffect(() => {
    if (!servicesOpen) return;
    const handler = (e: MouseEvent) => {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [servicesOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-8 md:px-16 py-5">
        <Link to="/" className="flex items-center gap-2 isolate" data-hover style={{ mixBlendMode: "normal" }}>
          <img src={new URL('../assets/site99-logo.png', import.meta.url).href} alt="Site 99" className="h-16 md:h-24 w-auto" style={{ mixBlendMode: "normal", opacity: 1 }} />
        </Link>

        {/* Desktop inline links */}
        <nav className="hidden md:flex items-center gap-1 bg-site-black/85 backdrop-blur-md text-site-white rounded-full px-5 py-2.5 border border-white/10">
          <div
            className="relative"
            ref={servicesRef}
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              onClick={() => setServicesOpen((o) => !o)}
              data-hover
              className="mono text-xs uppercase tracking-[0.25em] flex items-center gap-1.5 px-3 py-1.5 hover:opacity-70 transition-opacity"
            >
              Services
              <motion.span
                animate={{ rotate: servicesOpen ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="inline-block text-[10px]"
              >
                ▾
              </motion.span>
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 min-w-[280px]"
                >
                  <div className="bg-site-black text-site-white border border-white/10 rounded-xl py-2 shadow-2xl">
                    {services.map((s) => (
                      <Link
                        key={s.to}
                        to={s.to}
                        data-hover
                        onClick={() => setServicesOpen(false)}
                        className="block px-5 py-2.5 mono text-[11px] uppercase tracking-[0.2em] hover:bg-site-red transition-colors"
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {inlineLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-hover
              className="mono text-xs uppercase tracking-[0.25em] px-3 py-1.5 hover:opacity-70 transition-opacity"
            >
              {l.label}
            </Link>
          ))}
        </nav>


        <button
          onClick={() => setOpen((o) => !o)}
          className="relative z-[200] flex items-center gap-3 mono text-xs uppercase tracking-[0.25em] font-sans mix-blend-difference text-site-white"
          data-hover
          aria-label="Toggle menu"
        >
          <span className="hidden md:inline">{open ? "Close" : "Menu"}</span>
          <div className="relative w-8 h-8 flex flex-col justify-center items-end gap-1.5">
            <motion.span
              animate={{ rotate: open ? 45 : 0, y: open ? 4 : 0, width: open ? 32 : 32 }}
              className="block h-px bg-current origin-center"
            />
            <motion.span
              animate={{ rotate: open ? -45 : 0, y: open ? -3 : 0, width: open ? 32 : 20 }}
              className="block h-px bg-current origin-center"
            />
          </div>
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "circle(0% at 100% 0%)" }}
            animate={{ clipPath: "circle(150% at 100% 0%)" }}
            exit={{ clipPath: "circle(0% at 100% 0%)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[150] bg-site-red text-site-black overflow-y-auto overscroll-contain"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              data-hover
              className="fixed top-5 right-4 md:right-6 z-[160] flex items-center gap-3 mono text-xs uppercase tracking-[0.25em] text-site-black"
            >
              <span className="hidden md:inline">Close</span>
              <span className="relative w-8 h-8 flex items-center justify-center">
                <span className="absolute block w-8 h-px bg-current rotate-45" />
                <span className="absolute block w-8 h-px bg-current -rotate-45" />
              </span>
            </button>
            <div className="min-h-full w-full flex flex-col justify-between gap-10 p-6 md:p-12 pt-28 pb-10">
              <nav className="flex-1 flex flex-col justify-center gap-2 md:gap-4">
                {links.map((l, i) => (
                  <motion.div
                    key={l.to}
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link
                      to={l.to}
                      className="group flex items-baseline gap-6 md:gap-12 border-b border-site-black/30 pb-2 md:pb-4"
                      data-hover
                    >
                      <span className="mono text-xs md:text-sm">{l.n}</span>
                      <span className="display flex-1 transition-transform duration-500 group-hover:translate-x-4" style={{ fontSize: "clamp(1.75rem, 6vw, 6rem)", lineHeight: 0.95 }}>
                        {l.label}
                      </span>
                      <span className="mono text-xs hidden md:inline opacity-0 group-hover:opacity-100 transition">→</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col md:flex-row justify-between gap-4 mono text-xs uppercase tracking-widest"
              >
                <span>© SITE 99 — Narrative Control Co.</span>
                <span>Lat 0.000 · Long 99.000</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
