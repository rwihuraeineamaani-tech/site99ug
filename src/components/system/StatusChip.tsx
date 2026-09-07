import { cn } from "@/lib/utils";

export type StateTone =
  | "neutral"
  | "active"
  | "pending"
  | "warn"
  | "stop"
  | "done"
  | "violet"
  | "teal"
  | "amber"
  | "blue"
  | "pink"
  | "lime";

const TONE_MAP: Record<string, StateTone> = {
  // contracts
  draft: "neutral",
  signed: "pending",
  active: "teal",
  complete: "blue",
  terminated: "stop",
  cancelled: "stop",
  // content pipeline
  idea: "violet",
  approved: "teal",
  crewed: "pink",
  rejected: "stop",
  scheduled: "blue",
  shooting: "amber",
  editing: "amber",
  review: "violet",
  handover: "blue",
  posted: "lime",
  archived: "neutral",

  // payroll / finance
  paid: "teal",
  redirected: "amber",
  pending: "pending",
  income: "teal",
  expense: "amber",
  payroll: "blue",
  // clients
  prospect: "violet",
  lead: "pink",
  retainer: "teal",
  dormant: "neutral",
  lost: "stop",
};

/** Soft pill background + text colour per tone. */
export const TONE_SOFT: Record<StateTone, string> = {
  neutral: "bg-paper-sunken text-ink-soft",
  active: "bg-acc-teal-soft text-acc-teal",
  pending: "bg-acc-amber-soft text-acc-amber",
  warn: "bg-acc-amber-soft text-acc-amber",
  stop: "bg-[hsl(0_100%_96%)] text-signal",
  done: "bg-acc-blue-soft text-acc-blue",
  violet: "bg-acc-violet-soft text-acc-violet",
  teal: "bg-acc-teal-soft text-acc-teal",
  amber: "bg-acc-amber-soft text-acc-amber",
  blue: "bg-acc-blue-soft text-acc-blue",
  pink: "bg-acc-pink-soft text-acc-pink",
  lime: "bg-acc-lime-soft text-acc-lime",
};

/** Solid colour, useful for dots, bars and accents. */
export const TONE_SOLID: Record<StateTone, string> = {
  neutral: "bg-ink-faint",
  active: "bg-acc-teal",
  pending: "bg-acc-amber",
  warn: "bg-acc-amber",
  stop: "bg-signal",
  done: "bg-acc-blue",
  violet: "bg-acc-violet",
  teal: "bg-acc-teal",
  amber: "bg-acc-amber",
  blue: "bg-acc-blue",
  pink: "bg-acc-pink",
  lime: "bg-acc-lime",
};

export const TONE_TEXT: Record<StateTone, string> = {
  neutral: "text-ink-soft",
  active: "text-acc-teal",
  pending: "text-acc-amber",
  warn: "text-acc-amber",
  stop: "text-signal",
  done: "text-acc-blue",
  violet: "text-acc-violet",
  teal: "text-acc-teal",
  amber: "text-acc-amber",
  blue: "text-acc-blue",
  pink: "text-acc-pink",
  lime: "text-acc-lime",
};

export function toneFor(value?: string | null): StateTone {
  return TONE_MAP[(value ?? "").toLowerCase()] ?? "neutral";
}

export function StatusChip({
  value,
  tone,
  className,
}: {
  value?: string | null;
  tone?: StateTone;
  className?: string;
}) {
  const t = tone ?? toneFor(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full eyebrow text-[10px] tracking-[0.16em] whitespace-nowrap",
        TONE_SOFT[t],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TONE_SOLID[t])} />
      {value || "—"}
    </span>
  );
}

export default StatusChip;
