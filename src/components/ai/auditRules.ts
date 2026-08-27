export const CATEGORIES = [
  "Retail / E-commerce",
  "Services",
  "Events",
  "Education",
  "Hospitality",
  "Other",
] as const;

export const PAINS = [
  "Customer replies / support",
  "Scheduling / bookings",
  "Data entry",
  "Invoicing / payments",
  "Social media / content",
  "Reporting",
] as const;

export const HOURS_BANDS = ["Under 5", "5–15", "15–40", "40+"] as const;

export const TOOLS = [
  "WhatsApp",
  "Spreadsheets",
  "Paper / notebooks",
  "Email",
  "Existing software",
  "Nothing yet",
] as const;

export const TEAM_SIZES = ["Just me", "2–10", "11–50", "50+"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Pain = (typeof PAINS)[number];
export type HoursBand = (typeof HOURS_BANDS)[number];
export type Tool = (typeof TOOLS)[number];
export type TeamSize = (typeof TEAM_SIZES)[number];

export type Effort = "Quick win" | "Core build" | "Deeper system";

export type Suggestion = {
  tag: string;
  title: string;
  body: string;
  effort: Effort;
  phase: 1 | 2 | 3;
  flow: { manual: string[]; automated: string[] };
};

const PAIN_MAP: Record<Pain, Suggestion> = {
  "Customer replies / support": {
    tag: "AI Support Desk",
    title: "An AI responder on WhatsApp, Instagram and email",
    body: "Trained on your own answers, it handles the repeat questions instantly and hands the rest to a human with full context.",
    effort: "Quick win",
    phase: 1,
    flow: {
      manual: ["Enquiry lands", "You read it", "You type a reply", "You log it somewhere"],
      automated: ["Enquiry lands", "AI replies instantly", "Logged + escalated if complex"],
    },
  },
  "Scheduling / bookings": {
    tag: "Booking Engine",
    title: "Self-serve booking with automatic confirmations",
    body: "Customers pick a slot, pay or hold it, and get reminders. No back-and-forth, no double bookings.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Request comes in", "Check the calendar", "Agree a time", "Send a reminder"],
      automated: ["Customer picks a slot", "Auto-confirmed + paid", "Reminders fire on their own"],
    },
  },
  "Data entry": {
    tag: "Document Intelligence",
    title: "Documents that file themselves",
    body: "Receipts, forms and orders are read, structured and pushed into your sheet or database the moment they arrive.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Document arrives", "Someone reads it", "Types it into a sheet", "Fixes the typos"],
      automated: ["Document arrives", "Read + structured automatically", "Straight into your database"],
    },
  },
  "Invoicing / payments": {
    tag: "Billing Automation",
    title: "Invoices, reminders and reconciliation on autopilot",
    body: "Generate, send and chase invoices automatically — with mobile money and card payments matched to each record.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Job finishes", "Write the invoice", "Send and wait", "Chase, then reconcile"],
      automated: ["Job finishes", "Invoice sent automatically", "Payment matched + reconciled"],
    },
  },
  "Social media / content": {
    tag: "Content Engine",
    title: "A content pipeline that never runs dry",
    body: "Draft, schedule and repurpose posts from one brief, with performance fed back in to sharpen the next batch.",
    effort: "Quick win",
    phase: 1,
    flow: {
      manual: ["Think of an idea", "Write it", "Design it", "Post it manually"],
      automated: ["One brief in", "Drafts + variants generated", "Scheduled, results fed back"],
    },
  },
  Reporting: {
    tag: "Live Dashboards",
    title: "One dashboard instead of five spreadsheets",
    body: "Your numbers pulled together automatically, with a written summary of what changed and why, sent weekly.",
    effort: "Deeper system",
    phase: 3,
    flow: {
      manual: ["Export from each tool", "Paste into a sheet", "Build the chart", "Email the team"],
      automated: ["Data syncs continuously", "Dashboard always current", "Written summary sent weekly"],
    },
  },
};

const CATEGORY_MAP: Partial<Record<Category, Suggestion>> = {
  "Retail / E-commerce": {
    tag: "Inventory Signals",
    title: "Stock and reorder alerts before you run out",
    body: "Sales velocity watched continuously so restock happens on data, not on memory.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Notice a gap on the shelf", "Count stock", "Guess the reorder", "Call the supplier"],
      automated: ["Velocity tracked live", "Reorder point triggers", "Supplier order drafted"],
    },
  },
  Services: {
    tag: "Lead Routing",
    title: "Every enquiry qualified and routed in seconds",
    body: "Incoming leads scored, tagged and assigned so nothing sits unanswered overnight.",
    effort: "Quick win",
    phase: 1,
    flow: {
      manual: ["Lead arrives", "Sits in an inbox", "Someone spots it", "Maybe follows up"],
      automated: ["Lead arrives", "Scored + tagged", "Assigned with a follow-up clock"],
    },
  },
  Events: {
    tag: "Event Ops",
    title: "Ticketing, check-in and post-event follow-up joined up",
    body: "One system from sale to gate scan to the thank-you sequence — the same stack Site 99 already runs.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Sell tickets by hand", "Track names in a sheet", "Check lists at the gate", "Follow up later"],
      automated: ["Online sale + QR ticket", "Scan at the gate", "Follow-up sequence auto-sent"],
    },
  },
  Education: {
    tag: "Admin Relief",
    title: "Enrolment and parent comms handled automatically",
    body: "Applications, fee reminders and updates sent on schedule, tracked per student.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Collect forms", "Enter student details", "Write fee reminders", "Chase parents"],
      automated: ["Online enrolment", "Records created instantly", "Reminders sent on schedule"],
    },
  },
  Hospitality: {
    tag: "Guest Flow",
    title: "Reservations and guest messaging in one thread",
    body: "Bookings, confirmations and review requests triggered by the guest's own timeline.",
    effort: "Quick win",
    phase: 1,
    flow: {
      manual: ["Call or DM to book", "Write it in the book", "Remember to confirm", "Hope for a review"],
      automated: ["Booking confirmed instantly", "Pre-arrival message sent", "Review request after checkout"],
    },
  },
};

const TEAM_MAP: Record<TeamSize, Suggestion> = {
  "Just me": {
    tag: "Solo Leverage",
    title: "A single assistant layer across everything",
    body: "One lightweight system that covers the whole day rather than tools you have to maintain.",
    effort: "Quick win",
    phase: 1,
    flow: {
      manual: ["You do it all", "Switch between apps", "Things slip at night"],
      automated: ["One assistant layer", "Runs while you sleep", "You only handle exceptions"],
    },
  },
  "2–10": {
    tag: "Handoffs",
    title: "Shared inbox and task handoffs that don't drop",
    body: "Work assigned automatically with visibility on who owns what.",
    effort: "Core build",
    phase: 2,
    flow: {
      manual: ["Work arrives", "Someone shouts about it", "Unclear owner", "Dropped tasks"],
      automated: ["Work arrives", "Auto-assigned by rule", "Owner + deadline visible"],
    },
  },
  "11–50": {
    tag: "Process Layer",
    title: "Approvals and workflows encoded once",
    body: "Repeatable processes run the same way every time, with an audit trail.",
    effort: "Deeper system",
    phase: 3,
    flow: {
      manual: ["Ask around for approval", "Chase signatures", "No record of who decided"],
      automated: ["Request triggers workflow", "Approvals routed in order", "Full audit trail kept"],
    },
  },
  "50+": {
    tag: "Systems Integration",
    title: "Your existing tools connected end to end",
    body: "We plug into the stack you already run rather than replacing it.",
    effort: "Deeper system",
    phase: 3,
    flow: {
      manual: ["Tools don't talk", "Manual re-entry between them", "Numbers disagree"],
      automated: ["Integration layer in place", "One source of truth", "Data flows both ways"],
    },
  },
};

export function buildAudit(
  category: Category | null,
  pains: Pain[],
  team: TeamSize | null,
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const p of pains) out.push(PAIN_MAP[p]);
  if (category && CATEGORY_MAP[category]) out.push(CATEGORY_MAP[category]!);
  if (team) out.push(TEAM_MAP[team]);
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.tag) ? false : (seen.add(s.tag), true))).slice(0, 4);
}

const BAND_HOURS: Record<HoursBand, number> = {
  "Under 5": 4,
  "5–15": 10,
  "15–40": 26,
  "40+": 50,
};

const TEAM_MULT: Record<TeamSize, number> = {
  "Just me": 1,
  "2–10": 1.15,
  "11–50": 1.3,
  "50+": 1.45,
};

/** Rough weekly hours reclaimed — an estimate, not a promise. */
export function estimateHours(
  band: HoursBand | null,
  pains: Pain[],
  team: TeamSize | null,
  tools: Tool[],
): number {
  if (!band) return 0;
  const base = BAND_HOURS[band];
  const coverage = Math.min(0.75, 0.3 + pains.length * 0.08);
  const manualBoost = tools.some((t) => t === "Paper / notebooks" || t === "Spreadsheets") ? 1.1 : 1;
  const mult = team ? TEAM_MULT[team] : 1;
  return Math.max(1, Math.round(base * coverage * manualBoost * mult));
}

export type RoadmapPhase = { phase: 1 | 2 | 3; label: string; items: string[] };

export function buildRoadmap(suggestions: Suggestion[]): RoadmapPhase[] {
  const labels: Record<1 | 2 | 3, string> = {
    1: "Quick wins",
    2: "Core system",
    3: "Intelligence layer",
  };
  return ([1, 2, 3] as const).map((phase) => ({
    phase,
    label: labels[phase],
    items: suggestions.filter((s) => s.phase === phase).map((s) => s.tag),
  }));
}

export function auditToText(
  category: Category | null,
  pains: Pain[],
  band: HoursBand | null,
  tools: Tool[],
  team: TeamSize | null,
  suggestions: Suggestion[],
  hours: number,
): string {
  const lines = [
    "SITE 99 — AUTOMATION AUDIT",
    "",
    `Business: ${category ?? "—"}`,
    `Time sinks: ${pains.join(", ") || "—"}`,
    `Manual hours/week: ${band ?? "—"}`,
    `Running on: ${tools.join(", ") || "—"}`,
    `Team: ${team ?? "—"}`,
    "",
    `Estimated reclaim: ~${hours} hours/week (~${hours * 4} hours/month)`,
    "",
    "OPPORTUNITIES",
    ...suggestions.map((s) => `- [${s.effort}] ${s.tag}: ${s.title}`),
    "",
    "WORK MAP",
    ...suggestions.flatMap((s) => [
      `${s.tag}`,
      `  today: ${s.flow.manual.join(" -> ")}`,
      `  automated: ${s.flow.automated.join(" -> ")}`,
    ]),
    "",
    "ROADMAP",
    ...buildRoadmap(suggestions)
      .filter((p) => p.items.length)
      .map((p) => `- Phase 0${p.phase} ${p.label}: ${p.items.join(", ")}`),
    "",
    "Built by Site 99 — info@site99ug.com",
  ];
  return lines.join("\n");
}
