/** Shared shapes for the command deck: personal work, today's schedule, pulse. */

export type DeckTask = {
  id: string;
  /** Small leading code, e.g. a content ref. */
  code?: string;
  title: string;
  /** What this person has to do about it. */
  why: string;
  to: string;
  /** Optional one-press move. */
  action?: { label: string; next: string; itemId: string };
  stage?: string;
  /** Sort weight: lower is more urgent. */
  weight: number;
  department: "content" | "shoots" | "clients" | "finance" | "legal" | "ops";
};

export type DeckEvent = {
  id: string;
  when: string;
  title: string;
  note: string;
  to: string;
  overdue?: boolean;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthStartISO = () => `${new Date().toISOString().slice(0, 7)}-01`;

/** "Today", "Tomorrow", "Overdue · 3 days" or a short date. */
export function whenLabel(date: string | null | undefined): string {
  if (!date) return "No date";
  const d = date.slice(0, 10);
  const t = todayISO();
  if (d === t) return "Today";
  const diff = Math.round((new Date(d).getTime() - new Date(t).getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `Overdue · ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`;
  if (diff <= 7) return `In ${diff} days`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function isOverdue(date: string | null | undefined): boolean {
  return !!date && date.slice(0, 10) < todayISO();
}

/** Sort tasks by urgency then title. */
export function byUrgency(a: DeckTask, b: DeckTask) {
  return a.weight - b.weight || a.title.localeCompare(b.title);
}
