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
  Posted: "Live — numbers due in 10 days",
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
];

export const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook", "X", "LinkedIn", "WhatsApp"];

export const METRIC_FIELDS: { key: string; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "avg_watch_time", label: "Avg. watch time" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "follows", label: "Follows gained" },
  { key: "link_clicks", label: "Link clicks" },
];

export const refCode = (n: number) => `IDEA-${String(n).padStart(4, "0")}`;
