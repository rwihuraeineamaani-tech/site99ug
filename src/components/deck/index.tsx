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
  headline,
  actions,
}: {
  name: string;
  titles: string[];
  tagline: string;
  /** Optional hand-written greeting; falls back to the plain time-of-day one. */
  headline?: string;
  actions?: ReactNode;
}) {
  const { greeting } = useKampalaClock();
  const first = (name || "there").split(/[\s@]/)[0];

  return (
    <header className="relative deck-glow rule-b pb-5 mb-6">
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 rise">
          <div className="eyebrow text-signal mb-2 flex items-center gap-2">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-signal" />
            Command deck
          </div>
          <h1 className="display text-2xl md:text-4xl leading-[0.95]">
            {headline || `${greeting}, ${first}.`}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {titles.map((t) => (
              <span
                key={t}
                className="rounded-full border border-rule bg-paper-sunken px-2.5 py-1 eyebrow text-[10px] text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-sm text-ink-soft max-w-2xl">{tagline}</p>
        </div>
        {actions && (
          <div className="rise flex flex-wrap justify-end gap-2" style={{ ["--d" as string]: "80ms" }}>
            {actions}
          </div>
        )}
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

/* ------------------------------------------------------------------ *
 * Board layout: a slim figures strip and clickable work cards.
 * ------------------------------------------------------------------ */

export type StripFigure = {
  label: string;
  value: number | string;
  to?: string;
  tone?: "default" | "signal" | "quiet";
};

/** One line of small figures — replaces the old wall of big count tiles. */
export function DeckStrip({ figures }: { figures: StripFigure[] }) {
  return (
    <div className="rise surface rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-rule grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
      {figures.map((f) => {
        const inner = (
          <div className="px-4 py-3">
            <div className="eyebrow text-[9px] text-ink-faint truncate">{f.label}</div>
            <div
              className={cn(
                "num text-xl md:text-2xl font-semibold mt-0.5 tabular-nums",
                f.tone === "signal" && "text-signal",
                f.tone === "quiet" && "text-ink-soft"
              )}
            >
              {typeof f.value === "number" ? f.value.toLocaleString() : f.value}
            </div>
          </div>
        );
        return f.to ? (
          <Link key={f.label} to={f.to} className="focus-ring hover:bg-paper-sunken transition-colors">
            {inner}
          </Link>
        ) : (
          <div key={f.label}>{inner}</div>
        );
      })}
    </div>
  );
}

/** A column on the work board. */
export function DeckColumn({
  title,
  count,
  to,
  toLabel = "Open",
  empty = "Nothing here.",
  delay = 0,
  children,
}: {
  title: string;
  count?: number;
  to?: string;
  toLabel?: string;
  empty?: string;
  delay?: number;
  children?: ReactNode;
}) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section
      className="rise surface rounded-xl flex flex-col min-h-[180px]"
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 px-4 py-3 rule-b">
        <h2 className="eyebrow text-[10px]">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="num rounded-full bg-signal/15 text-signal px-2 py-0.5 text-[10px] font-semibold tabular-nums">
            {count}
          </span>
        )}
        {to && (
          <Link to={to} className="ml-auto eyebrow text-[10px] text-signal focus-ring whitespace-nowrap">
            {toLabel} →
          </Link>
        )}
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[420px]">
        {has ? children : <p className="px-2 py-6 text-center text-xs text-ink-faint">{empty}</p>}
      </div>
    </section>
  );
}

/** One clickable job on the board, with its own one-press action. */
export function DeckCard({
  to,
  eyebrow,
  title,
  note,
  tone = "default",
  action,
  right,
  below,
}: {
  to?: string;
  eyebrow?: string;
  title: string;
  note?: string;
  tone?: "default" | "signal" | "late";
  action?: { label: string; onClick: () => void; busy?: boolean };
  right?: ReactNode;
  /** Optional strip under the card body, e.g. a progress bar. */
  below?: ReactNode;
}) {
  const body = (
    <div
      className={cn(
        "rounded-lg border border-rule bg-paper-raised px-3 py-2.5 card-lift",
        tone === "signal" && "border-signal/45",
        tone === "late" && "border-signal bg-signal/[0.06]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className={cn("eyebrow text-[9px] mb-1", tone === "late" ? "text-signal" : "text-ink-faint")}
            >
              {eyebrow}
            </div>
          )}
          <div className="text-sm leading-snug truncate">{title}</div>
          {note && <div className="mt-0.5 text-[11px] text-ink-soft truncate">{note}</div>}
        </div>
        {right}
      </div>
      {below}
      {action && (
        <button
          type="button"
          disabled={action.busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            action.onClick();
          }}
          className="press mt-2 w-full rounded-md border border-signal bg-signal px-2.5 py-1 text-[11px] font-semibold text-paper focus-ring disabled:opacity-50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block focus-ring rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}
