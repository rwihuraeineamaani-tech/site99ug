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

export const TEAM_SIZES = ["Just me", "2–10", "11–50", "50+"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Pain = (typeof PAINS)[number];
export type TeamSize = (typeof TEAM_SIZES)[number];

export type Suggestion = { tag: string; title: string; body: string };

const PAIN_MAP: Record<Pain, Suggestion> = {
  "Customer replies / support": {
    tag: "AI Support Desk",
    title: "An AI responder on WhatsApp, Instagram and email",
    body: "Trained on your own answers, it handles the repeat questions instantly and hands the rest to a human with full context.",
  },
  "Scheduling / bookings": {
    tag: "Booking Engine",
    title: "Self-serve booking with automatic confirmations",
    body: "Customers pick a slot, pay or hold it, and get reminders. No back-and-forth, no double bookings.",
  },
  "Data entry": {
    tag: "Document Intelligence",
    title: "Documents that file themselves",
    body: "Receipts, forms and orders are read, structured and pushed into your sheet or database the moment they arrive.",
  },
  "Invoicing / payments": {
    tag: "Billing Automation",
    title: "Invoices, reminders and reconciliation on autopilot",
    body: "Generate, send and chase invoices automatically — with mobile money and card payments matched to each record.",
  },
  "Social media / content": {
    tag: "Content Engine",
    title: "A content pipeline that never runs dry",
    body: "Draft, schedule and repurpose posts from one brief, with performance fed back in to sharpen the next batch.",
  },
  Reporting: {
    tag: "Live Dashboards",
    title: "One dashboard instead of five spreadsheets",
    body: "Your numbers pulled together automatically, with a written summary of what changed and why, sent weekly.",
  },
};

const CATEGORY_MAP: Partial<Record<Category, Suggestion>> = {
  "Retail / E-commerce": {
    tag: "Inventory Signals",
    title: "Stock and reorder alerts before you run out",
    body: "Sales velocity watched continuously so restock happens on data, not on memory.",
  },
  Services: {
    tag: "Lead Routing",
    title: "Every enquiry qualified and routed in seconds",
    body: "Incoming leads scored, tagged and assigned so nothing sits unanswered overnight.",
  },
  Events: {
    tag: "Event Ops",
    title: "Ticketing, check-in and post-event follow-up joined up",
    body: "One system from sale to gate scan to the thank-you sequence — the same stack Site 99 already runs.",
  },
  Education: {
    tag: "Admin Relief",
    title: "Enrolment and parent comms handled automatically",
    body: "Applications, fee reminders and updates sent on schedule, tracked per student.",
  },
  Hospitality: {
    tag: "Guest Flow",
    title: "Reservations and guest messaging in one thread",
    body: "Bookings, confirmations and review requests triggered by the guest's own timeline.",
  },
};

const TEAM_MAP: Record<TeamSize, Suggestion> = {
  "Just me": {
    tag: "Solo Leverage",
    title: "A single assistant layer across everything",
    body: "One lightweight system that covers the whole day rather than tools you have to maintain.",
  },
  "2–10": {
    tag: "Handoffs",
    title: "Shared inbox and task handoffs that don't drop",
    body: "Work assigned automatically with visibility on who owns what.",
  },
  "11–50": {
    tag: "Process Layer",
    title: "Approvals and workflows encoded once",
    body: "Repeatable processes run the same way every time, with an audit trail.",
  },
  "50+": {
    tag: "Systems Integration",
    title: "Your existing tools connected end to end",
    body: "We plug into the stack you already run rather than replacing it.",
  },
};

export function buildAudit(category: Category | null, pains: Pain[], team: TeamSize | null): Suggestion[] {
  const out: Suggestion[] = [];
  for (const p of pains) out.push(PAIN_MAP[p]);
  if (category && CATEGORY_MAP[category]) out.push(CATEGORY_MAP[category]!);
  if (team) out.push(TEAM_MAP[team]);
  return out.slice(0, 3);
}
