import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const SYSTEMS = [
  "School management",
  "Inventory control",
  "Ticketing engine",
  "CRM & logistics",
  "Booking engine",
  "Billing automation",
];

export const SystemLedger = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % SYSTEMS.length), 2200);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="w-full"
    >
      <p className="tech mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-white/45">
        System architecture online:
      </p>
      <div className="flex flex-col">
        {SYSTEMS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s}
              type="button"
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group flex items-center justify-between gap-4 border-b border-white/15 py-2.5 text-left transition-colors"
            >
              <span
                className={`tech text-[10px] uppercase tracking-[0.22em] transition-colors sm:text-[11px] ${
                  on ? "text-white" : "text-white/55 group-hover:text-white/85"
                }`}
              >
                {s}
              </span>
              <span
                className={`tech shrink-0 border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] transition-colors ${
                  on ? "border-white text-white" : "border-white/25 text-white/40"
                }`}
              >
                {on ? (
                  <motion.span
                    animate={{ opacity: [1, 0.45, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="inline-block"
                  >
                    Active
                  </motion.span>
                ) : (
                  "Ready"
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
