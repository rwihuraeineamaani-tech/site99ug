/** Week helpers. A week runs Monday → Sunday and is identified by its Monday (ISO date). */

export function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

/** The most recent completed week — the one people are asked about every Monday. */
export function lastCompletedWeek(now: Date = new Date()): string {
  const thisMonday = new Date(`${mondayOf(now)}T00:00:00Z`);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  return thisMonday.toISOString().slice(0, 10);
}

export function weekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function weekLabel(weekStart: string): string {
  const s = new Date(`${weekStart}T00:00:00Z`);
  const e = new Date(`${weekEnd(weekStart)}T00:00:00Z`);
  const fmt = (d: Date, withYear = false) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${fmt(s)} – ${fmt(e, true)}`;
}

/** Month key (YYYY-MM) a week belongs to, decided by the week's Sunday. */
export function monthOfWeek(weekStart: string): string {
  return weekEnd(weekStart).slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const ACCOUNT_PLATFORMS = [
  "Instagram",
  "TikTok",
  "Facebook",
  "X (Twitter)",
  "YouTube",
  "LinkedIn",
  "Threads",
  "Snapchat",
  "WhatsApp Channel",
];

export const METRIC_COLUMNS = [
  { key: "followers", label: "Followers", hint: "Total at the end of the week" },
  { key: "profile_visits", label: "Profile visits", hint: "" },
  { key: "reach", label: "Reach", hint: "" },
  { key: "impressions", label: "Impressions", hint: "" },
  { key: "posts", label: "Posts published", hint: "" },
  { key: "link_clicks", label: "Link clicks", hint: "Website taps" },
] as const;

export type MetricKey = (typeof METRIC_COLUMNS)[number]["key"];
