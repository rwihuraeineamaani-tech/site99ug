/**
 * Hand-written greetings for the command deck.
 * One greeting is picked per visit (seeded in sessionStorage) so the page does
 * not shuffle on every render, but every new session feels different.
 */

export type GreetContext = {
  name: string;
  /** 0-23, Kampala time */
  hour: number;
  /** 0 = Sunday */
  weekday: number;
  dayOfMonth: number;
  /** 0 = January */
  month: number;
  roleLabel?: string;
  waiting: number;
  onMyPlate: number;
  shootsToday: number;
  eventsThisWeek: number;
};

const SEED_KEY = "site99:greet-seed";

function seed(): number {
  if (typeof window === "undefined") return 1;
  try {
    const existing = window.sessionStorage.getItem(SEED_KEY);
    if (existing) return Number(existing) || 1;
    const next = Math.floor(Math.random() * 100000) + 1;
    window.sessionStorage.setItem(SEED_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

function pick<T>(list: T[], offset = 0): T {
  if (!list.length) return undefined as unknown as T;
  return list[(seed() + offset) % list.length];
}

function firstName(name: string) {
  return (name || "there").split(/[\s@]/)[0];
}

function timeBand(hour: number) {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "late";
}

const OPENERS: Record<string, string[]> = {
  night: ["Still up", "Burning the reel", "Late shift", "The quiet hours", "Night mode"],
  morning: ["Good morning", "Morning", "Rise and roll", "First light", "Fresh call sheet"],
  afternoon: ["Good afternoon", "Afternoon", "Midday check", "Second half", "Back on set"],
  evening: ["Good evening", "Evening", "Golden hour", "Wrap window", "Last light"],
  late: ["Good evening", "Winding down", "After hours", "One more look", "Late edit"],
};

const DAY_NOTES: Record<number, string[]> = {
  0: ["Sunday. Only touch what actually needs you.", "Sunday reset — plan light, rest heavy."],
  1: ["Monday. Set the week before it sets you.", "Fresh week on the board."],
  2: ["Tuesday. The real work day.", "Tuesday — heads down, output up."],
  3: ["Midweek. Halfway to the wrap.", "Wednesday. Push the middle of the funnel."],
  4: ["Thursday. Close things before Friday closes them for you.", "Thursday — tie off loose ends."],
  5: ["Friday. Land it clean.", "Friday. Ship, then breathe."],
  6: ["Saturday. Shoot day energy.", "Saturday — the calendar is usually loud today."],
};

function seasonNote(month: number, day: number): string | null {
  if (month === 11 && day >= 15) return "Festive run — approvals move slower out there, plan ahead.";
  if (month === 0 && day <= 10) return "New year, clean board. Set the targets early.";
  if (month === 5 && day >= 25) return "Half-year mark is close. Good time to look at the numbers.";
  return null;
}

function monthNote(day: number): string | null {
  if (day <= 3) return "Start of the month — targets and retainers are due a look.";
  if (day >= 26) return "Month end. Filing, invoices and client numbers want closing.";
  if (day >= 13 && day <= 16) return "Mid-month. Halfway to the monthly targets.";
  return null;
}

/** Build the headline and the supporting line under it. */
export function buildGreeting(ctx: GreetContext): { headline: string; note: string } {
  const band = timeBand(ctx.hour);
  const opener = pick(OPENERS[band], 0);
  const headline = `${opener}, ${firstName(ctx.name)}.`;

  const urgent: string[] = [];
  if (ctx.waiting > 0) {
    urgent.push(
      `${ctx.waiting} thing${ctx.waiting === 1 ? "" : "s"} need${ctx.waiting === 1 ? "s" : ""} you before anything else.`
    );
  }
  if (ctx.shootsToday > 0) {
    urgent.push(`${ctx.shootsToday} shoot${ctx.shootsToday === 1 ? "" : "s"} on today — check call time and gear.`);
  }
  if (!ctx.waiting && ctx.onMyPlate > 0) {
    urgent.push(`Nothing is blocked on you. ${ctx.onMyPlate} piece${ctx.onMyPlate === 1 ? "" : "s"} still sit with you.`);
  }

  const calm: string[] = [];
  const season = seasonNote(ctx.month, ctx.dayOfMonth);
  if (season) calm.push(season);
  const mNote = monthNote(ctx.dayOfMonth);
  if (mNote) calm.push(mNote);
  calm.push(...(DAY_NOTES[ctx.weekday] ?? []));
  if (ctx.eventsThisWeek > 0) {
    calm.push(`${ctx.eventsThisWeek} thing${ctx.eventsThisWeek === 1 ? "" : "s"} on the calendar for the rest of this week.`);
  }
  if (ctx.roleLabel) calm.push(`Everything here is filtered for you as ${ctx.roleLabel.toLowerCase()}.`);
  if (band === "night") calm.push("It is past midnight in Kampala — whatever it is, it can probably wait.");
  if (!ctx.waiting && !ctx.onMyPlate) calm.push("Your board is clear. Good time to get ahead of next week.");

  const note = urgent.length ? urgent.join(" ") : pick(calm.length ? calm : ["Here is where everything stands."], 7);
  return { headline, note };
}

export default buildGreeting;
