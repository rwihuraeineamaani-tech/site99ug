import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/deck";

/* ------------------------------------------------------------------ *
 * KPI performance — last 30 days against the 30 before that.
 * Four real studio numbers: posted content, shoots landed,
 * client numbers filled, follower counts.
 * ------------------------------------------------------------------ */

export type KpiScope = "mine" | "studio";

export type KpiFigure = {
  key: "posted" | "shoots" | "numbers" | "followers";
  label: string;
  value: string;
  /** Percentage change against the previous window; null when there is no base. */
  delta: number | null;
  /** Suffix shown after the delta figure. */
  deltaUnit: "%" | "";
  note: string;
  to: string;
  /** Monthly target for this figure, when one is set. */
  target: number | null;
  /** 0–1 progress towards that target. */
  progress: number | null;
  /** 0–1 health used to name the strongest and weakest area. */
  score: number | null;
};

export type KpiData = {
  figures: KpiFigure[];
  /** True when this person has nothing at all in the window. */
  empty: boolean;
  best: string | null;
  worst: string | null;
};

type ContentRow = {
  id: string;
  posted_at: string | null;
  planned_at: string | null;
  metrics_due_at: string | null;
  metrics_filled_at: string | null;
  resident_id: string | null;
};

type CrewRow = { content_id: string; user_id: string | null };
type TargetRow = { resident_id: string | null; user_id: string | null; metric: string; target_value: number };
type MetricRow = {
  account_id: string;
  week_start: string;
  followers: number | null;
  reach: number | null;
  filled_by: string | null;
};
type ShootRow = {
  id: string;
  shoot_date: string | null;
  status: string;
  created_by: string | null;
  confirmed_by: string | null;
};

export function shiftDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type KpiWindows = { from: string; mid: string; to: string };

/** [from .. mid) is the previous 30 days, [mid .. to] is the last 30. */
export function kpiWindows(today = todayISO()): KpiWindows {
  return { from: shiftDays(today, -59), mid: shiftDays(today, -29), to: today };
}

const pct = (now: number, before: number): number | null => {
  if (before <= 0) return now > 0 ? 100 : null;
  return Math.round(((now - before) / before) * 100);
};

const inRange = (iso: string | null | undefined, a: string, b: string) => {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= a && d <= b;
};

export type KpiInput = {
  userId: string | null;
  scope: KpiScope;
  content: ContentRow[];
  crew: CrewRow[];
  metrics: MetricRow[];
  shoots: ShootRow[];
  /** shoot day id -> content ids on that day, for "was I on it". */
  shootItems: { shoot_day_id: string; content_id: string }[];
  /** Account ids the person is responsible for; empty in studio scope means all. */
  myAccountIds: Set<string>;
  /** Clients this person is on, used to pick which targets count as theirs. */
  myResidentIds: Set<string>;
  /** Monthly targets for the month in view. */
  targets: TargetRow[];
  pendingWeeks: number;
  windows: KpiWindows;
};

/** Latest followers per account within a window, summed. */
function followerTotal(rows: MetricRow[], a: string, b: string) {
  const latest = new Map<string, MetricRow>();
  rows
    .filter((m) => m.followers != null && inRange(m.week_start, a, b))
    .forEach((m) => {
      const cur = latest.get(m.account_id);
      if (!cur || m.week_start > cur.week_start) latest.set(m.account_id, m);
    });
  let total = 0;
  latest.forEach((m) => (total += m.followers ?? 0));
  return { total, accounts: latest.size };
}

export function buildKpi(input: KpiInput): KpiData {
  const {
    scope,
    userId,
    content,
    crew,
    metrics,
    shoots,
    shootItems,
    myAccountIds,
    myResidentIds,
    targets,
    pendingWeeks,
    windows,
  } = input;
  const prevA = windows.from;
  const prevB = shiftDays(windows.mid, -1);
  const nowA = windows.mid;
  const nowB = windows.to;
  const studio = scope === "studio";

  const mineIds = new Set(crew.filter((c) => c.user_id && c.user_id === userId).map((c) => c.content_id));
  const rows = studio ? content : content.filter((c) => mineIds.has(c.id));

  /* 1. Posted content — pieces that went live in the window. */
  const postedNow = rows.filter((c) => inRange(c.posted_at, nowA, nowB));
  const postedPrev = rows.filter((c) => inRange(c.posted_at, prevA, prevB));

  /* 2. Shoots landed — shoot days wrapped in the window. */
  const myShootIds = new Set(
    shootItems.filter((s) => mineIds.has(s.content_id)).map((s) => s.shoot_day_id)
  );
  const myShoot = (s: ShootRow) =>
    studio || myShootIds.has(s.id) || s.created_by === userId || s.confirmed_by === userId;
  const done = shoots.filter((s) => s.status === "done" && myShoot(s));
  const shotNow = done.filter((s) => inRange(s.shoot_date, nowA, nowB));
  const shotPrev = done.filter((s) => inRange(s.shoot_date, prevA, prevB));

  /* 3. Client numbers filled — weekly account entries logged. */
  const filled = metrics.filter(
    (m) => inRange(m.week_start, nowA, nowB) && (studio ? !!m.filled_by : m.filled_by === userId)
  );
  const filledPrev = metrics.filter(
    (m) => inRange(m.week_start, prevA, prevB) && (studio ? !!m.filled_by : m.filled_by === userId)
  );

  /* 4. Followers — latest count per account, across the accounts in view. */
  const scoped = metrics.filter((m) => studio || myAccountIds.has(m.account_id));
  const nowFollowers = followerTotal(scoped, nowA, nowB);
  const prevFollowers = followerTotal(scoped, prevA, prevB);
  const followerMove = nowFollowers.total - prevFollowers.total;

  const nf = (n: number) => n.toLocaleString();

  /* Targets for the month: everything in studio scope, only mine otherwise. */
  const targetFor = (metric: string): number | null => {
    const rows = targets.filter(
      (t) =>
        t.metric === metric &&
        (studio ||
          (t.resident_id && myResidentIds.has(t.resident_id)) ||
          (!t.resident_id && t.user_id === userId))
    );
    if (!rows.length) return null;
    return rows.reduce((a, t) => a + Number(t.target_value || 0), 0);
  };
  const progressOf = (actual: number, target: number | null) =>
    target && target > 0 ? Math.min(1, actual / target) : null;

  const figures: KpiFigure[] = [
    {
      key: "posted",
      label: "Posted content",
      value: nf(postedNow.length),
      delta: pct(postedNow.length, postedPrev.length),
      deltaUnit: "%",
      note: `${postedNow.length === 1 ? "piece" : "pieces"} live in 30 days · ${postedPrev.length} before`,
      to: "/app/content",
      target: targetFor("posted"),
      progress: progressOf(postedNow.length, targetFor("posted")),
      score: progressOf(postedNow.length, targetFor("posted")) ?? (postedNow.length ? Math.min(1, postedNow.length / 12) : 0),
    },
    {
      key: "shoots",
      label: "Shoots landed",
      value: nf(shotNow.length),
      delta: pct(shotNow.length, shotPrev.length),
      deltaUnit: "%",
      note: shotNow.length
        ? `${shotNow.length === 1 ? "shoot day" : "shoot days"} wrapped · ${shotPrev.length} before`
        : "no shoot days wrapped yet",
      to: "/app/shoots",
      target: targetFor("shoots"),
      progress: progressOf(shotNow.length, targetFor("shoots")),
      score: progressOf(shotNow.length, targetFor("shoots")) ?? (shotNow.length ? Math.min(1, shotNow.length / 8) : 0),
    },
    {
      key: "numbers",
      label: "Client numbers filled",
      value: nf(filled.length),
      delta: pct(filled.length, filledPrev.length),
      deltaUnit: "%",
      note: pendingWeeks ? `${pendingWeeks} still waiting on you` : "nothing outstanding",
      to: "/app/residents",
      target: targetFor("numbers"),
      progress: progressOf(filled.length, targetFor("numbers")),
      score: filled.length + pendingWeeks ? filled.length / (filled.length + pendingWeeks) : null,
    },
    {
      key: "followers",
      label: "Followers",
      value: nowFollowers.accounts ? nf(nowFollowers.total) : "—",
      delta: nowFollowers.accounts && prevFollowers.accounts ? followerMove : null,
      deltaUnit: "",
      note: nowFollowers.accounts
        ? `across ${nowFollowers.accounts} account${nowFollowers.accounts === 1 ? "" : "s"}${
            prevFollowers.accounts ? ` · ${followerMove >= 0 ? "+" : ""}${nf(followerMove)} in 30 days` : ""
          }`
        : "no follower counts logged yet",
      to: "/app/residents",
      target: targetFor("followers"),
      progress: progressOf(nowFollowers.total, targetFor("followers")),
      score: nowFollowers.accounts ? (followerMove > 0 ? 1 : followerMove === 0 ? 0.5 : 0.2) : null,
    },
  ];

  const scored = figures.filter((f) => f.score !== null) as (KpiFigure & { score: number })[];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const empty =
    postedNow.length === 0 &&
    postedPrev.length === 0 &&
    shotNow.length === 0 &&
    filled.length === 0 &&
    nowFollowers.accounts === 0;

  return {
    figures,
    empty,
    best: sorted.length ? sorted[0].label : null,
    worst: sorted.length > 1 ? sorted[sorted.length - 1].label : null,
  };
}

export type KpiRaw = {
  content: ContentRow[];
  crew: CrewRow[];
  metrics: MetricRow[];
  shoots: ShootRow[];
  shootItems: { shoot_day_id: string; content_id: string }[];
  myAccountIds: Set<string>;
  myResidentIds: Set<string>;
  targets: TargetRow[];
};

/** One trip for everything the panel needs; all tables are staff-readable. */
export async function loadKpiRaw(userId: string, windows: KpiWindows): Promise<KpiRaw> {
  const monthStart = `${windows.to.slice(0, 7)}-01`;
  const [content, crew, metrics, assigns, accounts, shoots, shootItems, targets] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, posted_at, planned_at, metrics_due_at, metrics_filled_at, resident_id")
      .gte("posted_at", `${windows.from}T00:00:00Z`),
    supabase.from("content_crew").select("content_id, user_id"),
    supabase
      .from("account_metrics")
      .select("account_id, week_start, followers, reach, filled_by")
      .gte("week_start", windows.from),
    supabase.from("client_assignments").select("resident_id").eq("user_id", userId),
    supabase.from("client_accounts").select("id, resident_id"),
    supabase
      .from("shoot_days")
      .select("id, shoot_date, status, created_by, confirmed_by")
      .gte("shoot_date", windows.from),
    supabase.from("shoot_day_items").select("shoot_day_id, content_id"),
    supabase.from("client_targets").select("resident_id, user_id, metric, target_value").eq("month", monthStart),
  ]);

  const myResidents = new Set(((assigns.data as { resident_id: string }[]) ?? []).map((a) => a.resident_id));
  const myAccountIds = new Set(
    ((accounts.data as { id: string; resident_id: string }[]) ?? [])
      .filter((a) => myResidents.has(a.resident_id))
      .map((a) => a.id)
  );

  return {
    content: (content.data as ContentRow[]) ?? [],
    crew: (crew.data as CrewRow[]) ?? [],
    metrics: (metrics.data as MetricRow[]) ?? [],
    shoots: (shoots.data as ShootRow[]) ?? [],
    shootItems: (shootItems.data as { shoot_day_id: string; content_id: string }[]) ?? [],
    myAccountIds,
    myResidentIds: myResidents,
    targets: (targets.data as TargetRow[]) ?? [],
  };
}
