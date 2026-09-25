/** Posting-date helpers for the client portal (Kampala time). */
export type Schedulable = { planned_at: string | null; scheduled_post_at?: string | null };

export function postWhen(i: Schedulable): Date | null {
  if (i.scheduled_post_at) return new Date(i.scheduled_post_at);
  if (i.planned_at) return new Date(`${i.planned_at}T18:00:00+03:00`);
  return null;
}

export function postLabel(i: Schedulable): string {
  const d = postWhen(i);
  if (!d) return "Date to confirm";
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Kampala" }).format(d);
  const time = i.scheduled_post_at ? ` · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(d)}` : "";
  return `${date}${time}`;
}

export function postCountdown(i: Schedulable): string | null {
  const d = postWhen(i);
  if (!d) return null;
  const k = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(x);
  const days = Math.round((Date.parse(k(d)) - Date.parse(k(new Date()))) / 86400000);
  if (days < 0) return "Was due";
  if (days === 0) return "Posts today";
  if (days === 1) return "Posts tomorrow";
  return `Posts in ${days} days`;
}

export const kampalaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(d);
