import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ *
 * Client strategy: goals, monthly targets and the workflow map.
 * ------------------------------------------------------------------ */

/** Things we can set a number against. Keys match the dashboard KPI figures. */
export const METRICS = [
  { key: "posted", label: "Posted content", unit: "pieces" },
  { key: "shoots", label: "Shoots landed", unit: "shoot days" },
  { key: "numbers", label: "Client numbers filled", unit: "entries" },
  { key: "followers", label: "Followers", unit: "followers" },
  { key: "reach", label: "Reach", unit: "people" },
  { key: "custom", label: "Something else", unit: "" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export const metricLabel = (k: string) => METRICS.find((m) => m.key === k)?.label ?? k;
export const metricUnit = (k: string) => METRICS.find((m) => m.key === k)?.unit ?? "";

export const GOAL_STATUSES = ["active", "hit", "missed", "paused"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export type Goal = {
  id: string;
  resident_id: string;
  title: string;
  metric: string;
  start_value: number | null;
  target_value: number | null;
  unit: string | null;
  due_on: string | null;
  owner_user_id: string | null;
  status: string;
  notes: string | null;
  sort: number;
  created_at: string;
};

export type Target = {
  id: string;
  resident_id: string | null;
  user_id: string | null;
  month: string;
  metric: string;
  target_value: number;
  notes: string | null;
};

export type MapNode = {
  id: string;
  label: string;
  detail?: string;
  kind: NodeKind;
  x: number;
  y: number;
};
export type MapEdge = { id: string; source: string; target: string; label?: string };

export const NODE_KINDS = [
  { key: "pillar", label: "Content pillar", tone: "violet" },
  { key: "format", label: "Format", tone: "blue" },
  { key: "rhythm", label: "Posting rhythm", tone: "teal" },
  { key: "owner", label: "Who does it", tone: "amber" },
  { key: "outcome", label: "Outcome", tone: "lime" },
] as const;

export type NodeKind = (typeof NODE_KINDS)[number]["key"];

/** Border colour per node kind, using the internal accent palette. */
export const NODE_TONE: Record<NodeKind, string> = {
  pillar: "hsl(var(--acc-violet))",
  format: "hsl(var(--acc-blue))",
  rhythm: "hsl(var(--acc-teal))",
  owner: "hsl(var(--acc-amber))",
  outcome: "hsl(var(--acc-lime))",
};

export const nodeKindLabel = (k: string) => NODE_KINDS.find((n) => n.key === k)?.label ?? k;

/** First day of the month an ISO date falls in. */
export const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;

export const monthLabel = (iso: string) =>
  new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** How a goal is tracking: 0–1, or null when there's nothing to measure against. */
export function goalProgress(g: Goal, actual: number | null): number | null {
  if (g.target_value == null || actual == null) return null;
  const start = g.start_value ?? 0;
  const span = g.target_value - start;
  if (span === 0) return actual >= g.target_value ? 1 : 0;
  return Math.max(0, Math.min(1, (actual - start) / span));
}

export type GoalHealth = "ahead" | "on track" | "behind" | "no date";

/** Compares progress made against time elapsed towards the due date. */
export function goalHealth(g: Goal, progress: number | null, today: string): GoalHealth {
  if (progress === null || !g.due_on) return "no date";
  const start = new Date(`${g.created_at.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${g.due_on}T00:00:00Z`).getTime();
  const now = new Date(`${today}T00:00:00Z`).getTime();
  if (end <= start) return progress >= 1 ? "ahead" : "behind";
  const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
  if (progress >= elapsed + 0.1) return "ahead";
  if (progress >= elapsed - 0.1) return "on track";
  return "behind";
}

export const HEALTH_TONE: Record<GoalHealth, "lime" | "teal" | "stop" | "neutral"> = {
  ahead: "lime",
  "on track": "teal",
  behind: "stop",
  "no date": "neutral",
};

export type StrategyMap = {
  id: string;
  resident_id: string;
  title: string;
  nodes: MapNode[];
  edges: MapEdge[];
  notes: string | null;
  version: number;
  updated_at: string;
};

/** Everything the strategy page needs for one client. */
export async function loadStrategy(residentId: string) {
  const [goals, targets, map] = await Promise.all([
    supabase.from("client_goals").select("*").eq("resident_id", residentId).order("sort").order("created_at"),
    supabase.from("client_targets").select("*").eq("resident_id", residentId).order("month", { ascending: false }),
    supabase.from("strategy_maps").select("*").eq("resident_id", residentId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const raw = map.data as unknown as (Omit<StrategyMap, "nodes" | "edges"> & { nodes: unknown; edges: unknown }) | null;

  return {
    goals: ((goals.data ?? []) as unknown as Goal[]),
    targets: ((targets.data ?? []) as unknown as Target[]),
    map: raw
      ? ({
          ...raw,
          nodes: (Array.isArray(raw.nodes) ? raw.nodes : []) as MapNode[],
          edges: (Array.isArray(raw.edges) ? raw.edges : []) as MapEdge[],
        } as StrategyMap)
      : null,
  };
}

/** Actual figures for a client this month, used to score goals and targets. */
export async function loadClientActuals(residentId: string, monthStart: string) {
  const monthEnd = new Date(`${monthStart}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const to = monthEnd.toISOString().slice(0, 10);

  const [content, shoots, accounts] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, posted_at, metrics_filled_at")
      .eq("resident_id", residentId)
      .gte("posted_at", `${monthStart}T00:00:00Z`)
      .lt("posted_at", `${to}T00:00:00Z`),
    supabase
      .from("shoot_days")
      .select("id, status, shoot_date")
      .eq("resident_id", residentId)
      .gte("shoot_date", monthStart)
      .lt("shoot_date", to),
    supabase.from("client_accounts").select("id").eq("resident_id", residentId),
  ]);

  const accountIds = ((accounts.data ?? []) as { id: string }[]).map((a) => a.id);
  let followers = 0;
  let reach = 0;
  let filled = 0;
  if (accountIds.length) {
    const { data: metrics } = await supabase
      .from("account_metrics")
      .select("account_id, week_start, followers, reach, filled_by")
      .in("account_id", accountIds)
      .gte("week_start", monthStart)
      .lt("week_start", to);
    const latest = new Map<string, { week_start: string; followers: number | null }>();
    ((metrics ?? []) as { account_id: string; week_start: string; followers: number | null; reach: number | null; filled_by: string | null }[]).forEach(
      (m) => {
        reach += m.reach ?? 0;
        if (m.filled_by) filled += 1;
        const cur = latest.get(m.account_id);
        if (!cur || m.week_start > cur.week_start) latest.set(m.account_id, m);
      }
    );
    latest.forEach((m) => (followers += m.followers ?? 0));
  }

  const posted = ((content.data ?? []) as { posted_at: string | null }[]).length;
  const shot = ((shoots.data ?? []) as { status: string }[]).filter((s) => s.status === "done").length;

  const actuals: Record<string, number> = { posted, shoots: shot, numbers: filled, followers, reach };
  return actuals;
}
