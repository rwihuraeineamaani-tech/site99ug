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
  review_state?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  review_note?: string | null;
};

export type Target = {
  id: string;
  resident_id: string | null;
  user_id: string | null;
  month: string;
  metric: string;
  target_value: number;
  notes: string | null;
  review_state?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  review_note?: string | null;
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
  review_state?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  review_note?: string | null;
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

/* ------------------------------------------------------------------ *
 * Sign-off: draft -> submitted -> approved (or changes requested).
 * ------------------------------------------------------------------ */

export const REVIEW_STATES = ["draft", "submitted", "approved", "changes_requested"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_LABEL: Record<ReviewState, string> = {
  draft: "Draft",
  submitted: "Waiting on founder",
  approved: "Approved",
  changes_requested: "Changes asked for",
};

export const REVIEW_TONE: Record<ReviewState, "neutral" | "amber" | "lime" | "stop"> = {
  draft: "neutral",
  submitted: "amber",
  approved: "lime",
  changes_requested: "stop",
};

export const reviewState = (v: unknown): ReviewState =>
  (REVIEW_STATES as readonly string[]).includes(String(v)) ? (v as ReviewState) : "draft";

/** Tables that carry a sign-off state. */
export type ReviewTable = "client_goals" | "client_targets" | "strategy_maps" | "client_plans" | "strategy_map_versions";

export const REVIEW_KIND_LABEL: Record<ReviewTable, string> = {
  client_goals: "Goal",
  client_targets: "Monthly target",
  strategy_maps: "Strategy map",
  client_plans: "Client plan",
  strategy_map_versions: "Map version",
};

/** Move one row through the sign-off flow. The database stamps who and when. */
export async function setReview(
  table: ReviewTable,
  id: string,
  state: ReviewState,
  note?: string | null
) {
  const patch: Record<string, unknown> = { review_state: state };
  if (note !== undefined) patch.review_note = note;
  if (state === "draft") {
    patch.submitted_at = null;
    patch.submitted_by = null;
  }
  if (state !== "approved") {
    patch.approved_at = null;
    patch.approved_by = null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any).update(patch).eq("id", id);
  if (error) throw error;
}

export type ClientPlan = {
  id: string;
  resident_id: string;
  owner_user_id: string | null;
  summary: string | null;
  review_state: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  review_note: string | null;
  updated_at: string;
};

export type MapVersion = {
  id: string;
  resident_id: string;
  map_id: string | null;
  version: number;
  title: string;
  nodes: MapNode[];
  edges: MapEdge[];
  notes: string | null;
  review_state: string;
  review_note: string | null;
  created_at: string;
  created_by: string | null;
};

/** The plan row for a client, created on first use. */
export async function loadPlan(residentId: string): Promise<ClientPlan | null> {
  const { data } = await supabase.from("client_plans").select("*").eq("resident_id", residentId).maybeSingle();
  return (data as unknown as ClientPlan) ?? null;
}

export async function ensurePlan(residentId: string): Promise<ClientPlan> {
  const existing = await loadPlan(residentId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("client_plans")
    .insert({ resident_id: residentId })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ClientPlan;
}

export async function loadPlans(): Promise<ClientPlan[]> {
  const { data } = await supabase.from("client_plans").select("*");
  return (data ?? []) as unknown as ClientPlan[];
}

export async function listMapVersions(residentId: string): Promise<MapVersion[]> {
  const { data } = await supabase
    .from("strategy_map_versions")
    .select("*")
    .eq("resident_id", residentId)
    .order("version", { ascending: false });
  return ((data ?? []) as unknown as (Omit<MapVersion, "nodes" | "edges"> & { nodes: unknown; edges: unknown })[]).map((v) => ({
    ...v,
    nodes: (Array.isArray(v.nodes) ? v.nodes : []) as MapNode[],
    edges: (Array.isArray(v.edges) ? v.edges : []) as MapEdge[],
  }));
}

/** Freeze the current map as a numbered version. */
export async function saveMapVersion(
  residentId: string,
  map: { id?: string | null; title: string; nodes: MapNode[]; edges: MapEdge[]; notes?: string | null },
  submit: boolean
) {
  const existing = await listMapVersions(residentId);
  const version = (existing[0]?.version ?? 0) + 1;
  const { error } = await supabase.from("strategy_map_versions").insert({
    resident_id: residentId,
    map_id: map.id ?? null,
    version,
    title: map.title,
    nodes: map.nodes as unknown as never,
    edges: map.edges as unknown as never,
    notes: map.notes ?? null,
    review_state: submit ? "submitted" : "draft",
  });
  if (error) throw error;
  return version;
}

/* ------------------------------------------------------------------ *
 * Starter maps.
 * ------------------------------------------------------------------ */

type Template = { key: string; label: string; blurb: string; nodes: MapNode[]; edges: MapEdge[] };

const n = (id: string, label: string, kind: NodeKind, x: number, y: number, detail?: string): MapNode => ({
  id,
  label,
  kind,
  x,
  y,
  detail,
});
const e = (a: string, b: string, label?: string): MapEdge => ({ id: `${a}-${b}`, source: a, target: b, label });

export const TEMPLATES: Template[] = [
  {
    key: "retainer",
    label: "Retainer client",
    blurb: "Monthly rhythm: pillars, formats, a shoot day and reporting.",
    nodes: [
      n("p1", "Brand story", "pillar", 40, 40),
      n("p2", "Product & proof", "pillar", 40, 180),
      n("p3", "Culture & people", "pillar", 40, 320),
      n("f1", "Short-form video", "format", 300, 60),
      n("f2", "Carousels", "format", 300, 200),
      n("f3", "Photo sets", "format", 300, 340),
      n("r1", "3 posts a week", "rhythm", 560, 120),
      n("o1", "Monthly shoot day", "owner", 560, 260),
      n("x1", "Follower growth & reach", "outcome", 820, 190),
    ],
    edges: [e("p1", "f1"), e("p2", "f2"), e("p3", "f3"), e("f1", "r1"), e("f2", "r1"), e("f3", "o1"), e("r1", "x1"), e("o1", "x1")],
  },
  {
    key: "launch",
    label: "Launch campaign",
    blurb: "Tease, launch, sustain — built around one date.",
    nodes: [
      n("t1", "Tease", "pillar", 40, 120, "2 weeks out"),
      n("t2", "Launch week", "pillar", 300, 120),
      n("t3", "Sustain", "pillar", 560, 120, "4 weeks after"),
      n("f1", "Hero film", "format", 300, 280),
      n("f2", "Cutdowns & stories", "format", 560, 280),
      n("x1", "Sales & sign-ups", "outcome", 820, 200),
    ],
    edges: [e("t1", "t2"), e("t2", "t3"), e("t2", "f1"), e("t3", "f2"), e("f1", "x1"), e("f2", "x1")],
  },
  {
    key: "always-on",
    label: "Always-on content",
    blurb: "A steady engine with no campaign spikes.",
    nodes: [
      n("p1", "Weekly theme", "pillar", 40, 140),
      n("f1", "Reels", "format", 300, 60),
      n("f2", "Stories", "format", 300, 220),
      n("r1", "Daily stories, 2 reels a week", "rhythm", 560, 140),
      n("x1", "Steady reach", "outcome", 820, 140),
    ],
    edges: [e("p1", "f1"), e("p1", "f2"), e("f1", "r1"), e("f2", "r1"), e("r1", "x1")],
  },
];
