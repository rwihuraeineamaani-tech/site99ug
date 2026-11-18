import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TARGET_LABEL } from "@/lib/clientMonth";
import { goalProgress, loadClientActuals, metricLabel, monthLabel, monthOf, visibleToClient, type Goal, type Target } from "@/lib/strategy";
import { Eye } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  residentId: string;
  clientName?: string;
  month?: string;
  /** Targets to show; omit to hide the targets card. */
  targets?: Target[];
  /** Goals to show; omit to hide the goals card. */
  goals?: Goal[];
  /** Ids being sent now, marked as new in the preview. */
  sending?: string[];
  confirmLabel?: string;
  onConfirm?: () => void;
  busy?: boolean;
};

const fmt = (n: number | null | undefined) => (n == null ? "0" : Number(n).toLocaleString("en-GB"));

/** Shows staff exactly how targets and goals will look on the client's dashboard. */
export default function ClientPreview({ open, onOpenChange, residentId, clientName, month, targets, goals, sending = [], confirmLabel, onConfirm, busy }: Props) {
  const m = month ?? monthOf(new Date().toISOString());
  const [actuals, setActuals] = useState<Record<string, number>>({});
  useEffect(() => {
    if (open && residentId) loadClientActuals(residentId, m).then(setActuals).catch(() => setActuals({}));
  }, [open, residentId, m]);

  const tag = (id: string, state: unknown) =>
    sending.includes(id) ? (
      <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[10px] text-signal">New, shows after approval</span>
    ) : !visibleToClient(state) ? (
      <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-[10px] text-ink-faint">Not sent yet</span>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> What {clientName || "the client"} will see
          </DialogTitle>
          <DialogDescription>
            This is their dashboard view. Nothing here reaches the client until a founder approves it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {targets && (
            <div className="rounded-xl border border-hairline p-3">
              <div className="text-sm font-medium">This month's targets</div>
              <div className="text-[11px] text-ink-faint">{monthLabel(m)}</div>
              {targets.length ? (
                <div className="mt-3 grid gap-3">
                  {targets.map((t) => {
                    const actual = actuals[t.metric] ?? 0;
                    const pct = t.target_value ? Math.min(100, Math.round((actual / Number(t.target_value)) * 100)) : 0;
                    return (
                      <div key={t.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2">{TARGET_LABEL[t.metric] ?? t.metric} {tag(t.id, t.review_state)}</span>
                          <span className="tabular-nums text-ink-soft">{fmt(actual)} of {fmt(t.target_value)}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-hairline">
                          <div className={`h-2 rounded-full ${pct >= 100 ? "bg-acc-lime" : "bg-signal"}`} style={{ width: `${pct}%` }} />
                        </div>
                        {t.notes && <div className="mt-1 text-xs text-ink-faint">{t.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-ink-faint">Targets for this month appear here once your team agrees them.</p>
              )}
            </div>
          )}

          {goals && (
            <div className="rounded-xl border border-hairline p-3">
              <div className="text-sm font-medium">Goals</div>
              {goals.length ? (
                <ul className="mt-3 space-y-2">
                  {goals.map((g) => {
                    const actual = g.metric === "custom" ? null : (actuals[g.metric] ?? 0);
                    const p = goalProgress(g, actual);
                    return (
                      <li key={g.id} className="rounded-xl border border-hairline px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2">{g.title} {tag(g.id, g.review_state)}</span>
                          {actual != null && g.target_value != null && (
                            <span className="tabular-nums text-ink-soft">{fmt(actual)} of {fmt(g.target_value)}</span>
                          )}
                        </div>
                        {p != null && (
                          <div className="mt-1 h-2 w-full rounded-full bg-hairline">
                            <div className={`h-2 rounded-full ${p >= 1 ? "bg-acc-lime" : "bg-signal"}`} style={{ width: `${Math.round(p * 100)}%` }} />
                          </div>
                        )}
                        <div className="mt-1 text-xs text-ink-faint">
                          {metricLabel(g.metric)}
                          {g.due_on ? ` · by ${new Date(g.due_on).toLocaleDateString("en-GB")}` : ""}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-ink-faint">Your goals appear here once your team agrees them.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {onConfirm ? "Go back and change" : "Close"}
          </Button>
          {onConfirm && (
            <Button onClick={onConfirm} disabled={busy}>
              {confirmLabel ?? "Looks right, send for sign-off"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
