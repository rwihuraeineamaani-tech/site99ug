import { cn } from "@/lib/utils";

export type StateTone = "neutral" | "active" | "pending" | "warn" | "stop" | "done";

const TONE_MAP: Record<string, StateTone> = {
  // contracts
  draft: "neutral",
  signed: "pending",
  active: "active",
  complete: "done",
  terminated: "stop",
  cancelled: "stop",
  // content
  idea: "neutral",
  approved: "active",
  rejected: "stop",
  scheduled: "pending",
  editing: "warn",
  posted: "done",
  archived: "neutral",
  // payroll / finance
  paid: "active",
  redirected: "warn",
  pending: "pending",
  income: "active",
  expense: "warn",
  payroll: "done",
  // clients
  prospect: "neutral",
  lead: "pending",
  retainer: "active",
  dormant: "neutral",
  lost: "stop",
};

const DOT: Record<StateTone, string> = {
  neutral: "bg-state-neutral",
  active: "bg-state-active",
  pending: "bg-state-pending",
  warn: "bg-state-warn",
  stop: "bg-state-stop",
  done: "bg-state-done",
};

const TEXT: Record<StateTone, string> = {
  neutral: "text-state-neutral",
  active: "text-state-active",
  pending: "text-state-pending",
  warn: "text-state-warn",
  stop: "text-state-stop",
  done: "text-state-done",
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
        "inline-flex items-center gap-1.5 border border-rule px-2 py-0.5 rounded-sm eyebrow text-[10px] whitespace-nowrap",
        TEXT[t],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT[t])} />
      {value || "—"}
    </span>
  );
}

export default StatusChip;
