import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Count a number up once, on first paint. Respects reduced motion. */
export function useCountUp(target: number, ms = 700) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    if (done.current) {
      setN(target);
      return;
    }
    done.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/** Kampala time, ticking every 30 seconds. */
export function useKampalaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Kampala",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }).format(now)
  );
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { time, date, greeting };
}

export function DeckHeader({
  name,
  titles,
  tagline,
  actions,
}: {
  name: string;
  titles: string[];
  tagline: string;
  actions?: ReactNode;
}) {
  const { time, date, greeting } = useKampalaClock();
  const first = (name || "there").split(/[\s@]/)[0];

  return (
    <header className="relative deck-glow rule-b pb-6 mb-8">
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 rise">
          <div className="eyebrow text-signal mb-2 flex items-center gap-2">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-signal" />
            Command deck
          </div>
          <h1 className="display text-3xl md:text-5xl leading-[0.95] capitalize">
            {greeting}, {first}.
          </h1>
          {titles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {titles.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-rule bg-paper-sunken px-2.5 py-1 eyebrow text-[10px] text-ink-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-ink-soft max-w-2xl">{tagline}</p>
        </div>
        <div className="rise text-right" style={{ ["--d" as string]: "80ms" }}>
          <div className="display text-4xl md:text-5xl num tracking-tight">{time}</div>
          <div className="mt-1 eyebrow text-ink-faint">{date} · Kampala</div>
          {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function DeckStat({
  label,
  value,
  hint,
  to,
  tone = "default",
  delay = 0,
}: {
  label: string;
  value: number | string;
  hint?: string;
  to?: string;
  tone?: "default" | "signal" | "quiet";
  delay?: number;
}) {
  const numeric = typeof value === "number";
  const counted = useCountUp(numeric ? value : 0);
  const body = (
    <div
      className={cn(
        "surface card-lift rounded-xl p-4 md:p-5 h-full relative overflow-hidden",
        tone === "signal" && "border-signal/45"
      )}
    >
      {tone === "signal" && (
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal to-transparent" />
      )}
      <div className="eyebrow text-ink-faint">{label}</div>
      <div
        className={cn(
          "display text-3xl md:text-4xl mt-2 num",
          tone === "signal" && "text-signal",
          tone === "quiet" && "text-ink-soft"
        )}
      >
        {numeric ? counted.toLocaleString() : value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-ink-soft">{hint}</div>}
    </div>
  );
  return (
    <div className="rise" style={{ ["--d" as string]: `${delay}ms` }}>
      {to ? (
        <Link to={to} className="block h-full focus-ring rounded-xl">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function DeckPanel({
  index,
  title,
  hint,
  to,
  toLabel = "Open",
  empty,
  delay = 0,
  className,
  children,
}: {
  index?: string;
  title: string;
  hint?: string;
  to?: string;
  toLabel?: string;
  empty?: string;
  delay?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("rise mt-10", className)} style={{ ["--d" as string]: `${delay}ms` }}>
      <div className="rule-b pb-3 mb-4 flex items-baseline gap-4">
        {index && <span className="eyebrow text-ink-faint">{index}</span>}
        <h2 className="display text-lg md:text-xl">{title}</h2>
        {hint && <span className="eyebrow text-ink-faint">{hint}</span>}
        {to && (
          <Link to={to} className="ml-auto eyebrow text-signal focus-ring whitespace-nowrap">
            {toLabel} →
          </Link>
        )}
      </div>
      {children ?? <p className="surface rounded-xl px-5 py-6 text-sm text-ink-soft">{empty ?? "Nothing here."}</p>}
    </section>
  );
}

export function DeckList({ children }: { children: ReactNode }) {
  return <ul className="surface rounded-xl overflow-hidden divide-y divide-rule">{children}</ul>;
}

export default DeckHeader;
