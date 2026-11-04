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

export function windowLabel(i: ReviewFields): string {
  const w = postWindow(i);
  if (!w) return "Date to confirm";
  return `${day(w.start)}, ${time(w.start)} to ${time(w.end)}`;
}

export const REVIEW_LABEL: Record<string, string> = {
  pending: "Waiting on client",
  approved: "Client approved",
  changes: "Client asked for changes",
};
