import { POST_WINDOWS } from "@/lib/contentFlow";

/** Shared helpers for the client post review (caption, collab, tags, posting window). */
export type PostTag = { handle: string; url?: string | null; status?: "proposed" | "accepted" | "rejected" };

export type ReviewFields = {
  caption_suggestions: string | null;
  client_caption?: string | null;
  caption_edited_by_client_at?: string | null;
  collab_handle?: string | null;
  collab_url?: string | null;
  collab_status?: string | null;
  tags?: unknown;
  post_window_start?: string | null;
  post_window_end?: string | null;
  scheduled_post_at?: string | null;
  planned_at?: string | null;
  client_review_state?: string | null;
  client_review_note?: string | null;
  edit_file_url?: string | null;
};

export const tagsOf = (i: ReviewFields): PostTag[] =>
  Array.isArray(i.tags) ? (i.tags as PostTag[]).filter((t) => t && typeof t.handle === "string") : [];

export const finalCaption = (i: ReviewFields) => i.client_caption ?? i.caption_suggestions ?? "";

/** Turn "@name" or a full link into a profile link (Instagram by default). */
export function profileUrl(handle: string, url?: string | null): string {
  if (url) return url;
  const h = handle.trim();
  if (/^https?:\/\//i.test(h)) return h;
  return `https://instagram.com/${h.replace(/^@/, "")}`;
}

const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: true, timeZone: "Africa/Kampala" }).format(d).replace(" ", "").toLowerCase();
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Kampala" }).format(d);

/** The window the client sees. Never the exact minute: a set window, or two hours around the planned time. */
export function postWindow(i: ReviewFields): { start: Date; end: Date } | null {
  if (i.post_window_start && i.post_window_end) return { start: new Date(i.post_window_start), end: new Date(i.post_window_end) };
  const at = i.scheduled_post_at ? new Date(i.scheduled_post_at) : i.planned_at ? new Date(`${i.planned_at.slice(0, 10)}T18:00:00+03:00`) : null;
  if (!at) return null;
  const start = new Date(at);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(start.getUTCHours() - 1);
  return { start, end: new Date(start.getTime() + 2 * 3600_000) };
}

const kampalaHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }).format(d)) % 24;
const kampalaDate = (i: ReviewFields) => {
  const src = i.scheduled_post_at ?? i.post_window_start ?? (i.planned_at ? `${i.planned_at.slice(0, 10)}T12:00:00+03:00` : null);
  return src ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Kampala" }).format(new Date(src)) : null;
};

/** Which named traffic window the item sits in (set window first, else the planned time). */
export function windowKeyOf(i: ReviewFields): string | null {
  const ref = i.post_window_start ?? i.scheduled_post_at;
  if (!ref) return null;
  const h = kampalaHour(new Date(ref));
  return POST_WINDOWS.find((w) => (h >= w.from && h < w.to) || (w.to > 24 && h < w.to - 24))?.key ?? null;
}

/** Start/end of a named window on the post's day. */
export function windowRange(i: ReviewFields, key: string): { start: string; end: string } | null {
  const w = POST_WINDOWS.find((x) => x.key === key);
  const d = kampalaDate(i);
  if (!w || !d) return null;
  const start = new Date(`${d}T${String(w.from).padStart(2, "0")}:00:00+03:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + (w.to - w.from) * 3600_000).toISOString() };
}

export function windowLabel(i: ReviewFields): string {
  const w = postWindow(i);
  if (!w) return "Date to confirm";
  const named = POST_WINDOWS.find((x) => x.key === windowKeyOf(i));
  if (named) return `${day(w.start)}, ${named.label.replace(" traffic", "")} (${named.range.replace("–", " to ")})`;
  return `${day(w.start)}, ${time(w.start)} to ${time(w.end)}`;
}

export const REVIEW_LABEL: Record<string, string> = {
  pending: "Waiting on client",
  approved: "Client approved",
  changes: "Client asked for changes",
};
