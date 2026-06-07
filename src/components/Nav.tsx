import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Frontier", n: "01" },
  { to: "/archive", label: "Archive", n: "02" },
  { to: "/residents", label: "Residents", n: "03" },
  { to: "/philosophy", label: "Philosophy", n: "04" },
  { to: "/access", label: "Access", n: "05" },
];

export const Nav = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-5 md:px-8 py-5">
        <Link to="/" className="flex items-center gap-2 isolate" data-hover style={{ mixBlendMode: "normal" }}>
          <img src={new URL('../assets/site99-logo.png', import.meta.url).href} alt="Site 99" className="h-16 md:h-24 w-auto" style={{ mixBlendMode: "normal", opacity: 1 }} />
        </Link>
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
              className="fixed top-5 right-6 md:right-10 z-[160] flex items-center gap-3 mono text-xs uppercase tracking-[0.25em] text-site-black"
            >
              <span className="hidden md:inline">Close</span>
              <span className="relative w-8 h-8 flex items-center justify-center">
                <span className="absolute block w-8 h-px bg-current rotate-45" />
                <span className="absolute block w-8 h-px bg-current -rotate-45" />
              </span>
            </button>
            <div className="min-h-full w-full flex flex-col justify-between gap-10 p-8 md:p-16 pt-28 pb-10">
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
                      <span className="display flex-1 transition-transform duration-500 group-hover:translate-x-4" style={{ fontSize: "clamp(2rem, 7vw, 7rem)", lineHeight: 0.95 }}>
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
