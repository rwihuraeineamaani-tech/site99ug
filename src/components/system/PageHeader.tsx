import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("rule-b mb-5 flex flex-col items-stretch gap-4 pb-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:pb-5", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow text-signal mb-2">{eyebrow}</div>}
        <h1 className="display break-words text-3xl leading-[0.95] md:text-5xl">{title}</h1>
        {lede && <p className="mt-3 text-ink-soft max-w-2xl text-sm md:text-base">{lede}</p>}
      </div>
      {actions && <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:shrink-0 sm:pb-0">{actions}</div>}
    </header>
  );
}

export function SectionHeading({
  index,
  title,
  hint,
  className,
}: {
  index?: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rule-b pb-3 mb-5 flex items-baseline gap-4", className)}>
      {index && <span className="eyebrow text-ink-faint">{index}</span>}
      <h2 className="display text-lg md:text-xl">{title}</h2>
      {hint && <span className="ml-auto eyebrow text-ink-faint">{hint}</span>}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "signal";
}) {
  return (
    <div className="surface rounded-sm p-4 md:p-5">
      <div className="eyebrow text-ink-faint">{label}</div>
      <div
        className={cn(
          "display text-2xl md:text-3xl mt-2 num",
          tone === "signal" && "text-signal"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-ink-soft">{hint}</div>}
    </div>
  );
}

export default PageHeader;
