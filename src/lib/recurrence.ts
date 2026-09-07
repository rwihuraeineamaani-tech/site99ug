/** Busy blocks: a person or a client saying "I'm not available then". */

export type Strictness = "warn" | "hard";
export type Freq = "none" | "daily" | "weekly" | "monthly";

export type AvailabilityBlock = {
  id: string;
  owner_kind: "staff" | "resident";
  owner_user_id: string | null;
  resident_id: string | null;
  title: string;
  all_day: boolean;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  freq: Freq;
  interval_n: number;
  byweekday: number[];
  until: string | null;
  occurrences: number | null;
  strictness: Strictness;
  note: string | null;
  created_by?: string | null;
};

const MS_DAY = 86_400_000;

function utc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((utc(a) - utc(b)) / MS_DAY);
}

export function dowOf(iso: string): number {
  return new Date(utc(iso)).getUTCDay();
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * MS_DAY).toISOString().slice(0, 10);
}

export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.slice(0, 10).split("-").map(Number);
  const [yb, mb] = b.slice(0, 10).split("-").map(Number);
  return (ya - yb) * 12 + (ma - mb);
}

/** Does this block land on the given day? Mirrors the same rule in the database. */
export function occursOn(b: AvailabilityBlock, iso: string): boolean {
  const d = iso.slice(0, 10);
  if (d < b.start_date) return false;
  if (b.until && d > b.until) return false;
  const step = Math.max(1, b.interval_n || 1);

  switch (b.freq) {
    case "none":
      return d <= (b.end_date || b.start_date);
    case "daily": {
      const n = dayDiff(d, b.start_date);
      if (n % step !== 0) return false;
      return b.occurrences == null || n / step < b.occurrences;
    }
    case "weekly": {
      const days = b.byweekday?.length ? b.byweekday : [dowOf(b.start_date)];
      if (!days.includes(dowOf(d))) return false;
      const weeks = Math.floor(
        (dayDiff(d, b.start_date) + (dowOf(b.start_date) - dowOf(d))) / 7
      );
      if (weeks % step !== 0) return false;
      return b.occurrences == null || weeks / step < b.occurrences;
    }
    case "monthly": {
      if (Number(d.slice(8, 10)) !== Number(b.start_date.slice(8, 10))) return false;
      const m = monthsBetween(d, b.start_date);
      if (m % step !== 0) return false;
      return b.occurrences == null || m / step < b.occurrences;
    }
    default:
      return false;
  }
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Plain-English "every 2 weeks on Mon, Wed until 3 Mar". */
export function describeRepeat(b: AvailabilityBlock): string {
  const every = b.interval_n > 1 ? `every ${b.interval_n} ` : "every ";
  let base: string;
  switch (b.freq) {
    case "none":
      base = b.end_date && b.end_date !== b.start_date ? `${b.start_date} to ${b.end_date}` : b.start_date;
      return base;
    case "daily":
      base = `${every}${b.interval_n > 1 ? "days" : "day"}`;
      break;
    case "weekly": {
      const days = (b.byweekday?.length ? b.byweekday : [dowOf(b.start_date)]).map((n) => DOW[n]).join(", ");
      base = `${every}${b.interval_n > 1 ? "weeks" : "week"} on ${days}`;
      break;
    }
    case "monthly":
      base = `${every}${b.interval_n > 1 ? "months" : "month"} on day ${Number(b.start_date.slice(8, 10))}`;
      break;
    default:
      base = "";
  }
  if (b.until) base += ` until ${b.until}`;
  else if (b.occurrences) base += `, ${b.occurrences} times`;
  return base;
}

export function timeLabel(b: AvailabilityBlock): string {
  if (b.all_day) return "All day";
  return `${(b.start_time ?? "").slice(0, 5)}–${(b.end_time ?? "").slice(0, 5)}`;
}

/** Every day in [from, to] this block covers. */
export function occurrencesInRange(b: AvailabilityBlock, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (occursOn(b, d)) out.push(d);
  return out;
}
