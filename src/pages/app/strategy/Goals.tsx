import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StrategyPage from "@/components/strategy/StrategyPage";
import { FilterBar, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { todayISO } from "@/lib/deck";
import {
  METRICS,
  REVIEW_LABEL,
  REVIEW_TONE,
  CLIENT_VISIBILITY,
  goalAim,
  metricHint,
  metricLabel,
  needsStart,
  metricUnit,
  visibleToClient,
  monthLabel,
  monthOf,
  reviewState,
  setReview,
  type Goal,
  type Target,
} from "@/lib/strategy";
import { Eye, EyeOff, Plus, Send, Trash2 } from "lucide-react";
import MonthTargets, { TargetSteps } from "@/components/strategy/MonthTargets";
import ClientPreview from "@/components/strategy/ClientPreview";

const field = "field text-sm";
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

export default function StrategyGoals() {
  const today = todayISO();
  // Everyone on the team can add and manage goals & targets.
  const { isStaff: isStrategyTeam, canApproveStrategy } = useMyRoles();
  const [params, setParams] = useSearchParams();
  const client = params.get("client") ?? "";
  const [month, setMonth] = useState(() => monthOf(today));
  const [state, setState] = useState("all");

  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewGoal, setPreviewGoal] = useState<Goal | null>(null);
  const [gForm, setGForm] = useState({ title: "", metric: "followers", start_value: "", target_value: "", due_on: "" });

  const load = async () => {
    const [r, g, t] = await Promise.all([
      supabase.from("residents").select("id, name").order("name"),
      supabase.from("client_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("client_targets").select("*").eq("month", month),
    ]);
    setResidents((r.data as { id: string; name: string }[]) ?? []);
    setGoals((g.data as unknown as Goal[]) ?? []);
    setTargets((t.data as unknown as Target[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const nameOf = (rid: string | null) => residents.find((r) => r.id === rid)?.name ?? "—";

  const shownGoals = useMemo(
    () =>
      goals.filter(
        (g) => (!client || g.resident_id === client) && (state === "all" || reviewState(g.review_state) === state)
      ),
    [goals, client, state]
  );
  const shownTargets = useMemo(
    () =>
      targets.filter(
        (t) => (!client || t.resident_id === client) && (state === "all" || reviewState(t.review_state) === state)
      ),
    [targets, client, state]
  );

  const addGoal = async () => {
    if (!client) return toast.error("Pick a client first.");
    if (!gForm.title.trim()) return toast.error("Give the goal a name.");
    setBusy(true);
    const { error } = await supabase.from("client_goals").insert({
      resident_id: client,
      title: gForm.title.trim(),
      metric: gForm.metric,
      start_value: needsStart(gForm.metric) && gForm.start_value ? Number(gForm.start_value) : null,
      target_value: gForm.target_value ? Number(gForm.target_value) : null,
      unit: metricUnit(gForm.metric) || null,
      due_on: gForm.due_on || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setGForm({ title: "", metric: "followers", start_value: "", target_value: "", due_on: "" });
    toast.success("Goal added as a draft");
    load();
  };

  const submit = async (table: "client_goals" | "client_targets", id: string) => {
    try {
      await setReview(table, id, "submitted");
      toast.success("Sent to the founders");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (table: "client_goals" | "client_targets", id: string) => {
    if (!window.confirm("Remove this?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <StrategyPage
      title="Goals & targets."
      lede="Goals are the big things we are going for with a client. Monthly targets are the numbers we commit to each month. Clients only see them once a founder approves."
      path="/app/strategy/goals"
    >
      <FilterBar>
        <select
          className={`${field} w-56`}
          value={client}
          onChange={(e) => setParams(e.target.value ? { client: e.target.value } : {})}
        >
          <option value="">All clients</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input className={`${field} w-44`} type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
        <select className={`${field} w-52`} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="all">Any state</option>
          <option value="draft">Draft</option>
          <option value="submitted">Waiting on founder</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes asked for</option>
        </select>
      </FilterBar>

      <TargetSteps />

      <SectionHeading index="01" title="Goals" hint={`${shownGoals.length} shown`} />
      {shownGoals.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing here yet.</p>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {shownGoals.map((g) => {
            const rs = reviewState(g.review_state);
            return (
              <li key={g.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                <Link to={`/app/residents/${g.resident_id}/strategy`} className="press focus-ring text-[11px] text-ink-faint w-32 truncate">
                  {nameOf(g.resident_id)}
                </Link>
                <span className="text-sm font-semibold">{g.title}</span>
                <StatusChip value={REVIEW_LABEL[rs]} tone={REVIEW_TONE[rs]} />
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                  {visibleToClient(rs) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {CLIENT_VISIBILITY(rs)}
                </span>
                <StatusChip value={g.status} tone={g.status === "hit" ? "lime" : g.status === "active" ? "teal" : "neutral"} />
                <span className="text-[11px] text-ink-faint">{metricLabel(g.metric)}</span>
                {g.due_on && <span className="num text-[11px] text-ink-faint">due {g.due_on}</span>}
                <span className="num text-sm ml-auto">
                  {goalAim(g)}
                </span>
                {isStrategyTeam && (
                  <span className="flex items-center gap-2">
                    {rs !== "submitted" && rs !== "approved" && (
                      <Button size="sm" variant="soft" className="gap-1.5" onClick={() => setPreviewGoal(g)}>
                        <Send className="h-3.5 w-3.5" /> Preview and send
                      </Button>
                    )}
                    <button
                      onClick={() => remove("client_goals", g.id)}
                      className="press focus-ring text-ink-faint hover:text-signal"
                      aria-label="Remove goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {rs === "changes_requested" && g.review_note && (
                  <span className="w-full text-[11px] text-ink-soft">Founder said: “{g.review_note}”</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isStrategyTeam && (
        <div className="surface rounded-2xl p-5 mt-4 grid gap-3 sm:grid-cols-6 no-print">
          <input
            className={`${field} ${needsStart(gForm.metric) ? "sm:col-span-2" : "sm:col-span-3"}`}
            placeholder="What are we going for?"
            value={gForm.title}
            onChange={(e) => setGForm({ ...gForm, title: e.target.value })}
          />
          <select className={field} value={gForm.metric} onChange={(e) => setGForm({ ...gForm, metric: e.target.value })}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {needsStart(gForm.metric) && (
            <input
              className={field}
              inputMode="numeric"
              placeholder="Starting at"
              value={gForm.start_value}
              onChange={(e) => setGForm({ ...gForm, start_value: e.target.value })}
            />
          )}
          <input
            className={field}
            inputMode="numeric"
            placeholder={needsStart(gForm.metric) ? "Target" : "How many"}
            value={gForm.target_value}
            onChange={(e) => setGForm({ ...gForm, target_value: e.target.value })}
          />
          <input className={field} type="date" aria-label="Due by" value={gForm.due_on} onChange={(e) => setGForm({ ...gForm, due_on: e.target.value })} />
          <p className="sm:col-span-4 text-[11px] text-ink-faint self-center">What counts: {metricHint(gForm.metric)}</p>
          <Button onClick={addGoal} disabled={busy} className="gap-2 sm:col-span-2">
            <Plus className="h-4 w-4" /> Add goal for {client ? nameOf(client) : "a client"}
          </Button>
        </div>
      )}

      {previewGoal && (
        <ClientPreview
          open
          onOpenChange={(v) => !v && setPreviewGoal(null)}
          residentId={previewGoal.resident_id}
          clientName={nameOf(previewGoal.resident_id)}
          goals={goals.filter((g) => g.resident_id === previewGoal.resident_id && (visibleToClient(g.review_state) || g.id === previewGoal.id))}
          sending={[previewGoal.id]}
          busy={busy}
          onConfirm={async () => {
            await submit("client_goals", previewGoal.id);
            setPreviewGoal(null);
          }}
        />
      )}

      <div className="mt-14">
        <SectionHeading index="02" title="Monthly targets" hint={monthLabel(month)} />
        {client ? (
          <MonthTargets residentId={client} clientName={nameOf(client)} month={month} canManage={isStrategyTeam} canApprove={canApproveStrategy} />
        ) : shownTargets.length === 0 ? (
          <p className="text-sm text-ink-soft">No targets for {monthLabel(month)}. Pick a client above to set them.</p>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-ink-faint">Pick a client above to set, change or send targets.</p>
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {shownTargets.map((t) => {
                const rs = reviewState(t.review_state);
                return (
                  <li key={t.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => t.resident_id && setParams({ client: t.resident_id })}
                      className="press focus-ring text-left text-[11px] text-ink-faint w-32 truncate"
                    >
                      {nameOf(t.resident_id)}
                    </button>
                    <span className="text-sm font-semibold">{metricLabel(t.metric)}</span>
                    <StatusChip value={REVIEW_LABEL[rs]} tone={REVIEW_TONE[rs]} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                      {visibleToClient(rs) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {CLIENT_VISIBILITY(rs)}
                    </span>
                    <span className="num text-sm ml-auto">{num(t.target_value)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </StrategyPage>
  );
}
