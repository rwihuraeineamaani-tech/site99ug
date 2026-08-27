import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { buildAudit, CATEGORIES, Category, Pain, PAINS, Suggestion, TEAM_SIZES, TeamSize } from "./auditRules";

const stepLabels = ["Business", "Time sinks", "Team"];

export const AuditTool = () => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [pains, setPains] = useState<Pain[]>([]);
  const [team, setTeam] = useState<TeamSize | null>(null);
  const [result, setResult] = useState<Suggestion[] | null>(null);

  const togglePain = (p: Pain) =>
    setPains((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const canNext = step === 0 ? !!category : step === 1 ? pains.length > 0 : !!team;

  const next = () => {
    if (step < 2) return setStep(step + 1);
    setResult(buildAudit(category, pains, team));
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setCategory(null);
    setPains([]);
    setTeam(null);
  };

  const chip = (active: boolean) =>
    `text-left rounded-lg border px-4 py-3.5 text-sm transition-colors ${
      active
        ? "border-ai-accent bg-ai-accent/15 text-white"
        : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/30 hover:text-white"
    }`;

  return (
    <div className="relative rounded-2xl border border-white/12 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-8 md:p-10">
      <div className="flex items-center justify-between gap-4">
        <span className="tech text-[11px] uppercase tracking-[0.28em] text-ai-accent">
          {result ? "Result" : `Step 0${step + 1} / 03 — ${stepLabels[step]}`}
        </span>
        {result && (
          <button onClick={restart} className="tech text-[11px] uppercase tracking-[0.22em] text-white/50 hover:text-white">
            Start over
          </button>
        )}
      </div>

      <div className="mt-4 h-px w-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-px bg-ai-accent"
          initial={false}
          animate={{ width: result ? "100%" : `${((step + 1) / 3) * 100}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mt-8 min-h-[320px]">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <h3 className="display text-3xl md:text-5xl text-white">Where automation pays off first.</h3>
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {result.map((s, i) => (
                  <motion.div
                    key={s.tag}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.45 }}
                    className="rounded-xl border border-white/12 bg-black/40 p-5"
                  >
                    <span className="tech text-[10px] uppercase tracking-[0.24em] text-ai-accent">{s.tag}</span>
                    <p className="mt-3 font-semibold text-white leading-snug">{s.title}</p>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.body}</p>
                  </motion.div>
                ))}
              </div>
              <a
                href="#demo"
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-ai-accent px-7 py-4 text-sm font-semibold text-black hover:bg-white transition-colors"
              >
                Want us to build this for you?
                <span aria-hidden>→</span>
              </a>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <>
                  <h3 className="display text-2xl md:text-4xl text-white">What does your business do?</h3>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h3 className="display text-2xl md:text-4xl text-white">What takes up the most manual time?</h3>
                  <p className="mt-2 tech text-[11px] uppercase tracking-[0.22em] text-white/40">Select all that apply</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PAINS.map((p) => (
                      <button key={p} onClick={() => togglePain(p)} className={chip(pains.includes(p))}>
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="display text-2xl md:text-4xl text-white">Team size</h3>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {TEAM_SIZES.map((t) => (
                      <button key={t} onClick={() => setTeam(t)} className={chip(team === t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!result && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="tech text-[11px] uppercase tracking-[0.22em] text-white/50 hover:text-white disabled:opacity-25"
          >
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="rounded-full bg-ai-accent px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-30 disabled:hover:bg-ai-accent"
          >
            {step === 2 ? "See my results" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
};
