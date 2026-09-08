import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * One job that is genuinely this person's move.
 * Leads with the move itself, then who it is for and when it is due.
 */
export default function WaitingCard({
  to,
  move,
  title,
  refLabel,
  stage,
  client,
  due,
  urgency = "soon",
  action,
}: {
  to: string;
  /** The thing they have to do, e.g. "Approve or reject". */
  move: string;
  title: string;
  refLabel?: string;
  stage?: string;
  client?: string | null;
  /** Human date line, e.g. "today", "2 days late", "Fri 12 Sep". */
  due?: string | null;
  urgency?: "late" | "today" | "soon";
  action?: { label: string; onClick: () => void; busy?: boolean };
}) {
  const dueTone =
    urgency === "late"
      ? "border-signal/60 bg-signal/10 text-signal"
      : urgency === "today"
        ? "border-acc-lime/50 bg-acc-lime/10 text-acc-lime"
        : "border-rule bg-paper-sunken text-ink-faint";

  return (
    <Link to={to} className="block focus-ring rounded-lg">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-rule bg-paper-raised pl-4 pr-3 py-2.5 card-lift",
          urgency === "late" && "border-signal/60",
          urgency === "today" && "border-acc-lime/40"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-0 h-full w-1",
            urgency === "late" ? "bg-signal" : urgency === "today" ? "bg-acc-lime" : "bg-rule"
          )}
        />

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="eyebrow text-[10px] text-ink truncate">{move}</div>
            <div className="mt-1 text-sm leading-snug truncate text-ink-soft">{title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
              {refLabel && <span className="num">{refLabel}</span>}
              {client && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate max-w-[9rem]">{client}</span>
                </>
              )}
              {stage && (
                <>
                  <span aria-hidden>·</span>
                  <span>{stage}</span>
                </>
              )}
            </div>
          </div>

          {due && (
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap", dueTone)}>
              {due}
            </span>
          )}
        </div>

        {action && (
          <button
            type="button"
            disabled={action.busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              action.onClick();
            }}
            className="press mt-2.5 w-full rounded-md border border-signal bg-signal px-2.5 py-1 text-[11px] font-semibold text-paper focus-ring disabled:opacity-50"
          >
            {action.busy ? "Working…" : action.label}
          </button>
        )}
      </div>
    </Link>
  );
}
