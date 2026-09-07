/** Shared vocabulary for the Legal section. */

export const PARTY_KINDS = [
  "resident",
  "client",
  "supplier",
  "partner",
  "freelancer",
  "staff",
  "other",
] as const;

export const CONTRACT_TYPES = [
  "service",
  "retainer",
  "one-off",
  "supply",
  "partnership",
  "employment",
  "nda",
  "other",
] as const;

export const CONTRACT_STATUSES = [
  "draft",
  "out for signature",
  "active",
  "expiring",
  "ended",
  "cancelled",
] as const;

export const DOC_CATEGORIES = ["template", "nda", "policy", "letter", "other"] as const;

export const COMPLIANCE_STATUSES = ["active", "due", "lapsed", "retired"] as const;

export const PARTNERSHIP_STATUSES = ["talking", "active", "paused", "ended"] as const;

export function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const then = new Date(`${date}T00:00:00`).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  return Math.round((then - now) / 86_400_000);
}

export function dueLabel(date?: string | null): string {
  const d = daysUntil(date);
  if (d === null) return "No date";
  if (d < 0) return `${Math.abs(d)} days late`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export function dueTone(date?: string | null): "stop" | "amber" | "teal" | "neutral" {
  const d = daysUntil(date);
  if (d === null) return "neutral";
  if (d < 0) return "stop";
  if (d <= 30) return "amber";
  return "teal";
}

export function niceDate(date?: string | null): string {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStartISO(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

export const solidBtn =
  "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";

export const ghostBtn =
  "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
