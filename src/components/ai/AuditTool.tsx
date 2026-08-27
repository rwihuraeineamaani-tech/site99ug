import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { WorkMap } from "./WorkMap";
import {
  auditToText,
  buildAudit,
  buildRoadmap,
  CATEGORIES,
  Category,
  estimateHours,
  HOURS_BANDS,
  HoursBand,
  Pain,
  PAINS,
  Suggestion,
  TEAM_SIZES,
  TeamSize,
  Tool,
  TOOLS,
} from "./auditRules";

const stepLabels = ["Business", "Time sinks", "Hours", "Tools", "Team"];
const STEPS = stepLabels.length;

const Counter = ({ value }: { value: number }) => {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    mv.set(value);
    const unsub = spring.on("change", (v) => setShown(Math.round(v)));
    return () => unsub();
  }, [value, mv, spring]);

  return <>{shown}</>;
};

export const AuditTool = () => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [pains, setPains] = useState<Pain[]>([]);
  const [band, setBand] = useState<HoursBand | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [team, setTeam] = useState<TeamSize | null>(null);
  const [result, setResult] = useState<Suggestion[] | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, v: T) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const canNext =
    step === 0 ? !!category : step === 1 ? pains.length > 0 : step === 2 ? !!band : step === 3 ? tools.length > 0 : !!team;

  const next = () => {
    if (step < STEPS - 1) return setStep(step + 1);
    setResult(buildAudit(category, pains, team));
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setCategory(null);
    setPains([]);
    setBand(null);
    setTools([]);
    setTeam(null);
    setCopied(false);
  };

  const hours = estimateHours(band, pains, team, tools);
  const roadmap = result ? buildRoadmap(result).filter((p) => p.items.length) : [];

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      auditToText(category, pains, band, tools, team, result, hours),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const chip = (active: boolean) =>
    `text-left rounded-none border px-4 py-3.5 text-sm transition-colors ${
      active
        ? "border-white bg-white/10 text-white"
        : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/30 hover:text-white"
    }`;

  return (
    <div className="relative rounded-none border border-white/15 bg-black p-5 sm:p-8 md:p-10">
      <div className="flex items-center justify-between gap-4">
        <span className="tech text-[11px] uppercase tracking-[0.28em] text-white">
          {result ? "Result" : `Step 0${step + 1} / 0${STEPS} — ${stepLabels[step]}`}
        </span>
        {result && (
          <button onClick={restart} className="tech text-[11px] uppercase tracking-[0.22em] text-white/50 hover:text-white">
            Start over
          </button>
        )}
      </div>

      <div className="mt-4 h-px w-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-px bg-white"
          initial={false}
          animate={{ width: result ? "100%" : `${((step + 1) / STEPS) * 100}%` }}
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

              {/* RECLAIM */}
              <div className="mt-8 border border-white/15 p-5 md:p-7">
                <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Estimated reclaim</span>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="display text-6xl md:text-8xl leading-none text-white">
                    <Counter value={hours} />
                  </span>
                  <span className="tech text-[11px] uppercase tracking-[0.22em] text-white/60">hours / week back</span>
                </div>
                <p className="mt-3 text-sm text-white/50">
                  ≈ {hours * 4} hours a month. An estimate from your answers, not a promise — we confirm it in the build scope.
                </p>
              </div>

              {/* WORK MAP */}
              <div className="mt-10">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <h4 className="display text-2xl md:text-3xl text-white">Your work map</h4>
                  <span className="tech text-[10px] uppercase tracking-[0.22em] text-white/35">Today vs automated</span>
                </div>
                <WorkMap suggestions={result} />
              </div>

              {/* OPPORTUNITIES */}
              <div className="mt-10">
                <h4 className="display text-2xl md:text-3xl text-white">Opportunities</h4>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {result.map((s, i) => (
                    <motion.div
                      key={s.tag}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.45 }}
                      className="rounded-none border border-white/15 bg-black p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="tech text-[10px] uppercase tracking-[0.24em] text-white">{s.tag}</span>
                        <span className="tech border border-white/20 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/50">
                          {s.effort}
                        </span>
                      </div>
                      <p className="mt-3 font-semibold text-white leading-snug">{s.title}</p>
                      <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.body}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ROADMAP */}
              <div className="mt-10">
                <h4 className="display text-2xl md:text-3xl text-white">Build roadmap</h4>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {roadmap.map((p) => (
                    <div key={p.phase} className="border border-white/12 p-5">
                      <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Phase 0{p.phase}</span>
                      <p className="mt-2 font-semibold text-white">{p.label}</p>
                      <ul className="mt-3 space-y-1.5">
                        {p.items.map((it) => (
                          <li key={it} className="text-sm text-white/60">
                            — {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#demo"
                  className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black hover:bg-white/85 transition-colors"
                >
                  Want us to build this for you?
                  <span aria-hidden>→</span>
                </a>
                <button
                  onClick={copy}
                  className="tech rounded-full border border-white/25 px-6 py-4 text-[11px] uppercase tracking-[0.22em] text-white/70 transition-colors hover:border-white hover:text-white"
                >
                  {copied ? "Copied" : "Copy my audit"}
                </button>
              </div>
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
                      <button key={p} onClick={() => toggle(setPains, p)} className={chip(pains.includes(p))}>
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="display text-2xl md:text-4xl text-white">Hours a week on those tasks?</h3>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {HOURS_BANDS.map((h) => (
                      <button key={h} onClick={() => setBand(h)} className={chip(band === h)}>
                        {h}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h3 className="display text-2xl md:text-4xl text-white">What do you run it on today?</h3>
                  <p className="mt-2 tech text-[11px] uppercase tracking-[0.22em] text-white/40">Select all that apply</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {TOOLS.map((t) => (
                      <button key={t} onClick={() => toggle(setTools, t)} className={chip(tools.includes(t))}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 4 && (
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
            className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-30"
          >
            {step === STEPS - 1 ? "See my results" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
};
