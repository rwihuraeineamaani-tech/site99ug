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
  GOAL_STATUSES,
  METRICS,
  REVIEW_LABEL,
  REVIEW_TONE,
  metricLabel,
  metricUnit,
  monthLabel,
  monthOf,
  reviewState,
  setReview,
  type Goal,
  type Target,
} from "@/lib/strategy";
import { Plus, Send, Trash2 } from "lucide-react";

const field = "field text-sm";
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

export default function StrategyGoals() {
  const today = todayISO();
  const { isStrategyTeam } = useMyRoles();
  const [params, setParams] = useSearchParams();
  const client = params.get("client") ?? "";
  const [month, setMonth] = useState(() => monthOf(today));
  const [state, setState] = useState("all");

  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [busy, setBusy] = useState(false);
  const [gForm, setGForm] = useState({ title: "", metric: "posted", start_value: "", target_value: "", due_on: "" });
  const [tForm, setTForm] = useState({ metric: "posted", target_value: "" });

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
      start_value: gForm.start_value ? Number(gForm.start_value) : null,
      target_value: gForm.target_value ? Number(gForm.target_value) : null,
      unit: metricUnit(gForm.metric) || null,
      due_on: gForm.due_on || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setGForm({ title: "", metric: "posted", start_value: "", target_value: "", due_on: "" });
    toast.success("Goal added as a draft");
    load();
  };

  const addTarget = async () => {
    if (!client) return toast.error("Pick a client first.");
    const value = Number(tForm.target_value);
    if (!value) return toast.error("Put in a number to aim for.");
    setBusy(true);
    const existing = targets.find((t) => t.resident_id === client && t.metric === tForm.metric);
    const { error } = existing
      ? await supabase.from("client_targets").update({ target_value: value }).eq("id", existing.id)
      : await supabase.from("client_targets").insert({ resident_id: client, month, metric: tForm.metric, target_value: value });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTForm({ metric: "posted", target_value: "" });
    toast.success("Target saved as a draft");
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
      lede="What we are going for per client, and the numbers we commit to each month. Founders sign them off before they count."
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
                <StatusChip value={g.status} tone={g.status === "hit" ? "lime" : g.status === "active" ? "teal" : "neutral"} />
                <span className="text-[11px] text-ink-faint">{metricLabel(g.metric)}</span>
                {g.due_on && <span className="num text-[11px] text-ink-faint">due {g.due_on}</span>}
                <span className="num text-sm ml-auto">
                  {num(g.start_value)} → {num(g.target_value)}
                </span>
                {isStrategyTeam && (
                  <span className="flex items-center gap-2">
                    {rs !== "submitted" && rs !== "approved" && (
                      <Button size="sm" variant="soft" className="gap-1.5" onClick={() => submit("client_goals", g.id)}>
                        <Send className="h-3.5 w-3.5" /> Send
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
            className={`${field} sm:col-span-2`}
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
          <input
            className={field}
            inputMode="numeric"
            placeholder="Starting at"
            value={gForm.start_value}
            onChange={(e) => setGForm({ ...gForm, start_value: e.target.value })}
          />
          <input
            className={field}
            inputMode="numeric"
            placeholder="Target"
            value={gForm.target_value}
            onChange={(e) => setGForm({ ...gForm, target_value: e.target.value })}
          />
          <input className={field} type="date" value={gForm.due_on} onChange={(e) => setGForm({ ...gForm, due_on: e.target.value })} />
          <Button onClick={addGoal} disabled={busy} className="gap-2 sm:col-span-2">
            <Plus className="h-4 w-4" /> Add goal for {client ? nameOf(client) : "a client"}
          </Button>
        </div>
      )}

      <div className="mt-14">
        <SectionHeading index="02" title="Monthly targets" hint={monthLabel(month)} />
        {shownTargets.length === 0 ? (
          <p className="text-sm text-ink-soft">No targets for {monthLabel(month)}.</p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {shownTargets.map((t) => {
              const rs = reviewState(t.review_state);
              return (
                <li key={t.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] text-ink-faint w-32 truncate">{nameOf(t.resident_id)}</span>
                  <span className="text-sm font-semibold">{metricLabel(t.metric)}</span>
                  <StatusChip value={REVIEW_LABEL[rs]} tone={REVIEW_TONE[rs]} />
                  <span className="num text-sm ml-auto">{num(t.target_value)}</span>
                  {isStrategyTeam && (
                    <span className="flex items-center gap-2">
                      {rs !== "submitted" && rs !== "approved" && (
                        <Button size="sm" variant="soft" className="gap-1.5" onClick={() => submit("client_targets", t.id)}>
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      )}
                      <button
                        onClick={() => remove("client_targets", t.id)}
                        className="press focus-ring text-ink-faint hover:text-signal"
                        aria-label="Remove target"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isStrategyTeam && (
          <div className="surface rounded-2xl p-5 mt-4 grid gap-3 sm:grid-cols-4 no-print">
            <select className={field} value={tForm.metric} onChange={(e) => setTForm({ ...tForm, metric: e.target.value })}>
              {METRICS.filter((m) => m.key !== "custom").map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              className={field}
              inputMode="numeric"
              placeholder={`Target for ${monthLabel(month)}`}
              value={tForm.target_value}
              onChange={(e) => setTForm({ ...tForm, target_value: e.target.value })}
            />
            <Button onClick={addTarget} disabled={busy} className="gap-2">
              <Plus className="h-4 w-4" /> Set target
            </Button>
          </div>
        )}
      </div>
    </StrategyPage>
  );
}
