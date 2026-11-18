/** The production flow for a content idea. Stages only move through these steps. */
export const STAGES = [
  "Idea",
  "Approved",
  "Crewed",
  "Scheduled",
  "Shooting",
  "Editing",
  "Review",
  "Handover",
  "Posted",
  "Archived",
  "Rejected",
] as const;

export type Stage = (typeof STAGES)[number];

/** Short human note shown under each stage. */
export const STAGE_NOTE: Record<Stage, string> = {
  Idea: "Waiting on founders to approve",
  Approved: "Crew needed",
  Crewed: "Ready to schedule",
  Scheduled: "Shoot date set",
  Shooting: "On the shoot",
  Editing: "With the editor",
  Review: "Waiting on founder sign-off",
  Handover: "With the handler to post",
  Posted: "Live, numbers due in 10 days",
  Archived: "Done and recorded",
  Rejected: "Not going ahead",
};

export const CREW_ROLES = [
  "Lead",
  "Shooter",
  "Second camera",
  "Editor",
  "Designer",
  "Strategist",
  "Talent",
  "Sound",
  "Other",
];

export const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook", "X", "LinkedIn", "WhatsApp"];

/** Named traffic windows a post can go out in. `from`/`to` are local hours (to may wrap past midnight). */
export const POST_WINDOWS: { key: string; label: string; range: string; from: number; to: number }[] = [
  { key: "early_morning", label: "Early morning traffic", range: "05:00–08:00", from: 5, to: 8 },
  { key: "lunch", label: "Lunch traffic", range: "12:00–14:00", from: 12, to: 14 },
  { key: "work", label: "Work traffic", range: "14:00–16:00", from: 14, to: 16 },
  { key: "commuter", label: "Commuter traffic", range: "17:00–19:00", from: 17, to: 19 },
  { key: "evening", label: "Evening traffic", range: "19:00–22:00", from: 19, to: 22 },
  { key: "late_night", label: "Late night traffic", range: "22:00–01:00", from: 22, to: 25 },
];

export const postWindowLabel = (key: string) => POST_WINDOWS.find((w) => w.key === key)?.label ?? key;

export type MetricField = { key: string; label: string };

/** Numbers recorded for a video post. */
export const VIDEO_METRICS: MetricField[] = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "avg_watch_time", label: "Avg. watch time" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "reposts", label: "Reposts" },
  { key: "saves", label: "Saves" },
  { key: "follows", label: "Follows gained" },
  { key: "link_clicks", label: "Link clicks" },
];

/** Numbers recorded for a photo post (photo set, poster, carousel). */
export const PHOTO_METRICS: MetricField[] = [
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "reposts", label: "Reposts" },
  { key: "saves", label: "Saves" },
  { key: "profile_visits", label: "Profile visits" },
  { key: "follows", label: "Follows gained" },
  { key: "link_clicks", label: "Link clicks" },
];

/** Every number we know, used to read older saved numbers. */
export const METRIC_FIELDS: MetricField[] = [...VIDEO_METRICS, ...PHOTO_METRICS.filter((p) => !VIDEO_METRICS.some((v) => v.key === p.key))];

export type ContentKind = "video" | "photo";
/** The one place that decides whether a content type is a video or a photo post. */
export const contentKind = (type: string | null | undefined): ContentKind => (/video|reel|vlog/i.test(type ?? "") ? "video" : /photo|poster|carousel|still|graphic|image|slide/i.test(type ?? "") ? "photo" : "video");
export const KIND_LABEL: Record<ContentKind, string> = { video: "Videos", photo: "Photo posts" };
export const metricFieldsFor = (type: string | null | undefined) => (contentKind(type) === "photo" ? PHOTO_METRICS : VIDEO_METRICS);

export const refCode = (n: number) => `IDEA-${String(n).padStart(4, "0")}`;
