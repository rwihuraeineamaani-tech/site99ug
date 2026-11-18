import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import {
  CLIENT_VISIBILITY,
  METRICS,
  REVIEW_LABEL,
  REVIEW_TONE,
  loadClientActuals,
  metricHint,
  metricLabel,
  monthLabel,
  reviewState,
  setReview,
  visibleToClient,
  type Target,
} from "@/lib/strategy";
import { prevMonth } from "@/lib/clientMonth";
import { Check, Copy, Eye, EyeOff, Plus, Send, Trash2, Undo2 } from "lucide-react";

const field = "field text-sm";
const fmt = (n: number | null | undefined) => (n == null ? "–" : Number(n).toLocaleString("en-GB"));
const SETTABLE = METRICS.filter((m) => m.key !== "custom");

type Props = {
  residentId: string;
  month: string;
  canManage: boolean;
  canApprove: boolean;
};

/**
 * One place to set a client's monthly targets. Progress comes from the same
 * counter the client portal reads, and only approved targets reach the client.
 */
export default function MonthTargets({ residentId, month, canManage, canApprove }: Props) {
  const [rows, setRows] = useState<Target[]>([]);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [lastMonth, setLastMonth] = useState<Target[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ metric: "posted_videos", value: "", notes: "" });
  const [editing, setEditing] = useState<{ id: string; value: string; notes: string } | null>(null);

  const load = async () => {
    const [t, p, a] = await Promise.all([
      supabase.from("client_targets").select("*").eq("resident_id", residentId).eq("month", month),
      supabase.from("client_targets").select("*").eq("resident_id", residentId).eq("month", prevMonth(month)),
      loadClientActuals(residentId, month).catch(() => ({} as Record<string, number>)),
    ]);
    const order = (x: Target) => SETTABLE.findIndex((m) => m.key === x.metric);
    setRows(((t.data as unknown as Target[]) ?? []).sort((x, y) => order(x) - order(y)));
    setLastMonth((p.data as unknown as Target[]) ?? []);
    setActuals(a);
  };

  useEffect(() => {
    if (residentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId, month]);

  const unused = useMemo(() => SETTABLE.filter((m) => !rows.some((r) => r.metric === m.key)), [rows]);
  useEffect(() => {
    if (unused.length && !unused.some((m) => m.key === form.metric)) setForm((f) => ({ ...f, metric: unused[0].key }));
  }, [unused, form.metric]);

  const drafts = rows.filter((r) => ["draft", "changes_requested"].includes(reviewState(r.review_state)));
  const live = rows.filter((r) => visibleToClient(r.review_state)).length;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const add = () => {
    const value = Number(form.value);
    if (!value || value < 0) return toast.error("Put in a number to aim for.");
    return run(async () => {
      const { error } = await supabase
        .from("client_targets")
        .insert({ resident_id: residentId, month, metric: form.metric, target_value: value, notes: form.notes.trim() || null });
      if (error) throw error;
      setForm({ metric: form.metric, value: "", notes: "" });
    }, "Target saved as a draft");
  };

  const saveEdit = (t: Target) => {
    if (!editing) return;
    const value = Number(editing.value);
    if (!value || value < 0) return toast.error("Put in a number to aim for.");
    const wasApproved = visibleToClient(t.review_state);
    return run(async () => {
      const { error } = await supabase
        .from("client_targets")
        .update({ target_value: value, notes: editing.notes.trim() || null })
        .eq("id", t.id);
      if (error) throw error;
      setEditing(null);
    }, wasApproved && value !== Number(t.target_value) ? "Changed. It goes back to the founders before the client sees it." : "Target updated");
  };

  const copyLast = () =>
    run(async () => {
      const { error } = await supabase.from("client_targets").insert(
        lastMonth
          .filter((t) => !rows.some((r) => r.metric === t.metric))
          .map((t) => ({ resident_id: residentId, month, metric: t.metric, target_value: t.target_value, notes: t.notes }))
      );
      if (error) throw error;
    }, `Copied ${monthLabel(prevMonth(month))} as drafts`);

  const sendAll = () =>
    run(async () => {
      for (const t of drafts) await setReview("client_targets", t.id, "submitted");
    }, drafts.length === 1 ? "Sent to the founders" : `${drafts.length} targets sent to the founders`);

  const sendBack = (t: Target) => {
    const note = window.prompt("What should change?");
    if (!note) return;
    return run(() => setReview("client_targets", t.id, "changes_requested", note), "Sent back");
  };

  const remove = (t: Target) => {
    if (!window.confirm(`Remove the ${metricLabel(t.metric)} target?`)) return;
    return run(async () => {
      const { error } = await supabase.from("client_targets").delete().eq("id", t.id);
      if (error) throw error;
    }, "Target removed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
        <span className="num">{rows.length} set</span>
        <span>·</span>
        <span className="num">{live} the client can see</span>
        {drafts.length > 0 && (
          <>
            <span>·</span>
            <span className="num">{drafts.length} still to send</span>
          </>
        )}
        <span className="ml-auto flex flex-wrap gap-2 no-print">
          {canManage && rows.length === 0 && lastMonth.length > 0 && (
            <Button size="sm" variant="soft" className="gap-1.5" onClick={copyLast} disabled={busy}>
              <Copy className="h-3.5 w-3.5" /> Copy {monthLabel(prevMonth(month))}
            </Button>
          )}
          {canManage && drafts.length > 0 && (
            <Button size="sm" className="gap-1.5" onClick={sendAll} disabled={busy}>
              <Send className="h-3.5 w-3.5" /> Send {drafts.length === 1 ? "it" : `all ${drafts.length}`} for sign-off
            </Button>
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="surface rounded-2xl px-5 py-6 text-sm text-ink-soft">
          No targets for {monthLabel(month)} yet. Add one below, then send it to the founders. The client sees it on their dashboard and reports once it is approved.
        </p>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {rows.map((t) => {
            const rs = reviewState(t.review_state);
            const actual = actuals[t.metric] ?? 0;
            const pct = t.target_value ? Math.min(100, Math.round((actual / Number(t.target_value)) * 100)) : 0;
            const isEditing = editing?.id === t.id;
            return (
              <li key={t.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{metricLabel(t.metric)}</span>
                  <StatusChip value={REVIEW_LABEL[rs]} tone={REVIEW_TONE[rs]} />
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                    {visibleToClient(rs) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {CLIENT_VISIBILITY(rs)}
                  </span>
                  <span className="num text-sm ml-auto">
                    {fmt(actual)} of {fmt(t.target_value)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-full rounded-full bg-paper-sunken overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-acc-lime" : "bg-signal"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="num text-[11px] text-ink-faint w-10 text-right">{pct}%</span>
                </div>
                <p className="text-[11px] text-ink-faint">{metricHint(t.metric)}</p>
                {t.notes && !isEditing && <p className="text-xs text-ink-soft">Note for the client: {t.notes}</p>}
                {rs === "changes_requested" && t.review_note && (
                  <p className="text-xs text-ink-soft">Founder said: “{t.review_note}”</p>
                )}

                {isEditing ? (
                  <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto_auto] no-print">
                    <input
                      className={field}
                      inputMode="numeric"
                      aria-label="Target number"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    />
                    <input
                      className={field}
                      placeholder="Note the client will see (optional)"
                      value={editing.notes}
                      onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    />
                    <Button size="sm" onClick={() => saveEdit(t)} disabled={busy}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    {canManage && (
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => setEditing({ id: t.id, value: String(t.target_value), notes: t.notes ?? "" })}
                      >
                        Change
                      </Button>
                    )}
                    {canManage && (rs === "draft" || rs === "changes_requested") && (
                      <Button
                        size="sm"
                        variant="soft"
                        className="gap-1.5"
                        onClick={() => run(() => setReview("client_targets", t.id, "submitted"), "Sent to the founders")}
                        disabled={busy}
                      >
                        <Send className="h-3.5 w-3.5" /> Send for sign-off
                      </Button>
                    )}
                    {canApprove && rs === "submitted" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => run(() => setReview("client_targets", t.id, "approved"), "Approved. The client can see it now.")}
                          disabled={busy}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendBack(t)} disabled={busy}>
                          <Undo2 className="h-3.5 w-3.5" /> Send back
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <button
                        onClick={() => remove(t)}
                        className="press focus-ring ml-auto text-ink-faint hover:text-signal"
                        aria-label={`Remove ${metricLabel(t.metric)} target`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && unused.length > 0 && (
        <div className="surface rounded-2xl p-5 space-y-3 no-print">
          <div className="text-sm font-semibold">Add a target for {monthLabel(month)}</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <select
              className={field}
              aria-label="What to count"
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            >
              {unused.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              className={field}
              inputMode="numeric"
              aria-label="Number to aim for"
              placeholder="Aim for"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <p className="text-[11px] text-ink-faint">What counts: {metricHint(form.metric)}</p>
          <input
            className={`${field} w-full`}
            placeholder="Note the client will see (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button onClick={add} disabled={busy} className="gap-2">
            <Plus className="h-4 w-4" /> Save as draft
          </Button>
        </div>
      )}
    </div>
  );
}

/** The four steps a target goes through, shown above the setup. */
export function TargetSteps() {
  const steps = [
    ["Pick the client and month", "Targets belong to one client for one month."],
    ["Set the numbers", "Videos and photo posts are counted separately. Each one says what counts."],
    ["Send for sign-off", "A Founder, the MD or a System Admin approves or sends it back."],
    ["Client sees it", "Approved targets show on the client's dashboard, Reports and monthly PDF with live progress."],
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {steps.map(([t, d], i) => (
        <li key={t} className="surface rounded-2xl p-4">
          <div className="num text-[11px] text-ink-faint">Step {i + 1}</div>
          <div className="mt-1 text-sm font-semibold">{t}</div>
          <div className="mt-1 text-[11px] text-ink-soft">{d}</div>
        </li>
      ))}
    </ol>
  );
}
