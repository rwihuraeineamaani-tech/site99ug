import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/deck";

/* ------------------------------------------------------------------ *
 * KPI performance — last 30 days against the 30 before that.
 * All maths lives here so the dashboard panel stays declarative.
 * ------------------------------------------------------------------ */

export type KpiScope = "mine" | "studio";

export type KpiFigure = {
  key: "output" | "ontime" | "numbers" | "results";
  label: string;
  value: string;
  /** Percentage change against the previous window; null when there is no base. */
  delta: number | null;
  note: string;
  to: string;
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
type MetricRow = {
  account_id: string;
  week_start: string;
  followers: number | null;
  reach: number | null;
  filled_by: string | null;
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
  /** Account ids the person is responsible for; empty in studio scope means all. */
  myAccountIds: Set<string>;
  pendingWeeks: number;
  windows: KpiWindows;
};

export function buildKpi(input: KpiInput): KpiData {
  const { scope, userId, content, crew, metrics, myAccountIds, pendingWeeks, windows } = input;
  const prevA = windows.from;
  const prevB = shiftDays(windows.mid, -1);
  const nowA = windows.mid;
  const nowB = windows.to;

  const mineIds = new Set(crew.filter((c) => c.user_id && c.user_id === userId).map((c) => c.content_id));
  const rows = scope === "studio" ? content : content.filter((c) => mineIds.has(c.id));

  /* 1. Output — pieces posted in the window. */
  const postedNow = rows.filter((c) => inRange(c.posted_at, nowA, nowB));
  const postedPrev = rows.filter((c) => inRange(c.posted_at, prevA, prevB));

  /* 2. On time — of the dated pieces posted, how many landed by their date. */
  const dated = postedNow.filter((c) => c.planned_at);
  const onTime = dated.filter((c) => (c.posted_at ?? "").slice(0, 10) <= (c.planned_at ?? "").slice(0, 10));
  const datedPrev = postedPrev.filter((c) => c.planned_at);
  const onTimePrev = datedPrev.filter((c) => (c.posted_at ?? "").slice(0, 10) <= (c.planned_at ?? "").slice(0, 10));
  const rate = dated.length ? Math.round((onTime.length / dated.length) * 100) : null;
  const ratePrev = datedPrev.length ? Math.round((onTimePrev.length / datedPrev.length) * 100) : null;
  const slipped = dated.length - onTime.length;

  /* 3. Numbers filled — weekly client numbers this person entered. */
  const filled = metrics.filter(
    (m) => inRange(m.week_start, nowA, nowB) && (scope === "studio" ? !!m.filled_by : m.filled_by === userId)
  );
  const filledPrev = metrics.filter(
    (m) => inRange(m.week_start, prevA, prevB) && (scope === "studio" ? !!m.filled_by : m.filled_by === userId)
  );

  /* 4. Client results — reach and follower movement on the accounts in view. */
  const scoped = metrics.filter((m) => scope === "studio" || myAccountIds.has(m.account_id));
  const reachNow = scoped
    .filter((m) => inRange(m.week_start, nowA, nowB))
    .reduce((s, m) => s + (m.reach ?? 0), 0);
  const reachPrev = scoped
    .filter((m) => inRange(m.week_start, prevA, prevB))
    .reduce((s, m) => s + (m.reach ?? 0), 0);

  const byAccount = new Map<string, MetricRow[]>();
  scoped
    .filter((m) => inRange(m.week_start, nowA, nowB) && m.followers != null)
    .forEach((m) => byAccount.set(m.account_id, [...(byAccount.get(m.account_id) ?? []), m]));
  let followerMove = 0;
  byAccount.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.week_start.localeCompare(b.week_start));
    followerMove += (sorted[sorted.length - 1].followers ?? 0) - (sorted[0].followers ?? 0);
  });

  const nf = (n: number) => n.toLocaleString();

  const figures: KpiFigure[] = [
    {
      key: "output",
      label: "My output",
      value: nf(postedNow.length),
      delta: pct(postedNow.length, postedPrev.length),
      note: postedNow.length === 1 ? "piece posted in 30 days" : "pieces posted in 30 days",
      to: "/app/content",
      score: postedNow.length ? Math.min(1, postedNow.length / 12) : 0,
    },
    {
      key: "ontime",
      label: "On time",
      value: rate === null ? "—" : `${rate}%`,
      delta: rate === null || ratePrev === null ? null : rate - ratePrev,
      note: rate === null ? "nothing dated yet" : slipped ? `${slipped} slipped past its date` : "all landed on the day",
      to: "/app/calendar",
      score: rate === null ? null : rate / 100,
    },
    {
      key: "numbers",
      label: "Numbers filled",
      value: nf(filled.length),
      delta: pct(filled.length, filledPrev.length),
      note: pendingWeeks ? `${pendingWeeks} still waiting on you` : "nothing outstanding",
      to: "/app/content",
      score: filled.length + pendingWeeks ? filled.length / (filled.length + pendingWeeks) : null,
    },
    {
      key: "results",
      label: "Client results",
      value: reachNow ? nf(reachNow) : "—",
      delta: pct(reachNow, reachPrev),
      note: reachNow
        ? `reach · ${followerMove >= 0 ? "+" : ""}${nf(followerMove)} followers`
        : "no numbers logged yet",
      to: "/app/residents",
      score: reachNow ? (reachPrev ? Math.min(1, reachNow / Math.max(reachPrev, 1) / 2) : 0.6) : null,
    },
  ];

  const scored = figures.filter((f) => f.score !== null) as (KpiFigure & { score: number })[];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const empty = postedNow.length === 0 && postedPrev.length === 0 && filled.length === 0 && reachNow === 0;

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
  myAccountIds: Set<string>;
};

/** One trip for everything the panel needs; all tables are staff-readable. */
export async function loadKpiRaw(userId: string, windows: KpiWindows): Promise<KpiRaw> {
  const [content, crew, metrics, assigns, accounts] = await Promise.all([
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
    myAccountIds,
  };
}
