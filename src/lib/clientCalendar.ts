/** How a video shows on the client calendar. Shared by the client portal and the staff "Client view". */
export type CalStatus = "posted" | "numbers_due" | "rejected" | "changes" | "awaiting_client" | "not_edited" | "other";

export type CalItem = {
  stage: string;
  posted_at?: string | null;
  metrics_due_at?: string | null;
  metrics_filled_at?: string | null;
  client_review_state?: string | null;
};

const NOT_EDITED = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing"];

export function calStatus(i: CalItem, clientApproves: boolean, today: string): CalStatus {
  if (i.stage === "Rejected") return "rejected";
  if (i.stage === "Posted" || i.stage === "Archived" || i.posted_at) {
    const due = i.metrics_due_at ?? (i.posted_at ? addDays(i.posted_at.slice(0, 10), 10) : null);
    return !i.metrics_filled_at && due && due < today ? "numbers_due" : "posted";
  }
  if (i.client_review_state === "changes") return "changes";
  if (clientApproves && i.stage === "Review" && i.client_review_state !== "approved") return "awaiting_client";
  if (NOT_EDITED.includes(i.stage)) return "not_edited";
  return "other";
}

function addDays(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const CAL_STYLE: Record<CalStatus, { label: string; cls: string }> = {
  posted: { label: "Posted", cls: "border-acc-lime/70 bg-acc-lime-soft" },
  numbers_due: { label: "Numbers overdue", cls: "border-state-stop/70 bg-state-stop/20" },
  rejected: { label: "Rejected", cls: "border-state-stop border-dashed bg-transparent line-through opacity-80" },
  changes: { label: "Changes asked", cls: "border-state-stop border-dashed bg-transparent" },
  awaiting_client: { label: "Your turn", cls: "border-acc-blue bg-acc-blue-soft font-semibold" },
  not_edited: { label: "Not edited yet", cls: "border-acc-amber/70 bg-acc-amber-soft" },
  other: { label: "In progress", cls: "border-hairline bg-paper-raised text-ink-soft" },
};
