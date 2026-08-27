import { motion } from "framer-motion";
import type { Suggestion } from "./auditRules";

const Lane = ({
  steps,
  tone,
  strike,
}: {
  steps: string[];
  tone: "dim" | "bright";
  strike?: boolean;
}) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
    {steps.map((s, i) => (
      <div key={`${s}-${i}`} className="flex items-center gap-2 md:flex-1">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.09, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={`flex-1 border px-3 py-2.5 text-xs leading-snug md:text-[13px] ${
            tone === "bright"
              ? "border-white/60 bg-white/[0.06] text-white"
              : "border-white/12 bg-transparent text-white/40"
          } ${strike && i > 0 ? "line-through decoration-white/25" : ""}`}
        >
          {s}
        </motion.div>
        {i < steps.length - 1 && (
          <span className={`shrink-0 text-[11px] ${tone === "bright" ? "text-white/70" : "text-white/20"}`}>
            <span className="hidden md:inline">──▶</span>
            <span className="md:hidden">▼</span>
          </span>
        )}
      </div>
    ))}
  </div>
);

export const WorkMap = ({ suggestions }: { suggestions: Suggestion[] }) => (
  <div className="space-y-6">
    {suggestions.map((s) => (
      <div key={s.tag} className="border border-white/12 p-4 md:p-5">
        <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/70">{s.tag}</span>

        <div className="mt-4 space-y-4">
          <div>
            <p className="tech mb-2 text-[10px] uppercase tracking-[0.22em] text-white/30">Manual today</p>
            <Lane steps={s.flow.manual} tone="dim" strike />
          </div>
          <div>
            <p className="tech mb-2 text-[10px] uppercase tracking-[0.22em] text-white/70">Automated</p>
            <Lane steps={s.flow.automated} tone="bright" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
