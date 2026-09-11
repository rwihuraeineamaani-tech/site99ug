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
  night: ["Working late", "Still here", "Good evening", "Late night"],
  morning: ["Good morning", "Morning", "Hello", "Good morning to you"],
  afternoon: ["Good afternoon", "Afternoon", "Hello", "Good afternoon to you"],
  evening: ["Good evening", "Evening", "Hello", "Good evening to you"],
  late: ["Good evening", "Working late", "Still here", "Evening"],
};

const DAY_NOTES: Record<number, string[]> = {
  0: ["Sunday. Only do what really needs you today.", "Sunday. A good day to rest and plan lightly."],
  1: ["Monday. Set the week up early.", "Monday. A new week to plan."],
  2: ["Tuesday. A good day for steady work.", "Tuesday. Keep the week moving."],
  3: ["Wednesday. Halfway through the week.", "Wednesday. A good day to check progress."],
  4: ["Thursday. Close things before Friday.", "Thursday. Tie up loose ends."],
  5: ["Friday. Finish things cleanly.", "Friday. Wrap up the week well."],
  6: ["Saturday. Shoot days often fall today.", "Saturday. The calendar is usually busy today."],
};

function seasonNote(month: number, day: number): string | null {
  if (month === 11 && day >= 15) return "Festive season — approvals take longer, so plan ahead.";
  if (month === 0 && day <= 10) return "New year. A good time to set this year's targets.";
  if (month === 5 && day >= 25) return "Half the year is nearly gone. A good time to review the numbers.";
  return null;
}

function monthNote(day: number): string | null {
  if (day <= 3) return "Start of the month — check targets and retainers.";
  if (day >= 26) return "Month end — invoices, filing and client numbers need closing.";
  if (day >= 13 && day <= 16) return "Mid-month. Halfway to this month's targets.";
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
      ctx.waiting === 1 ? "1 thing needs you today." : `${ctx.waiting} things need you today.`
    );
  }
  if (ctx.shootsToday > 0) {
    urgent.push(
      ctx.shootsToday === 1
        ? "1 shoot today — check the call time and gear."
        : `${ctx.shootsToday} shoots today — check the call times and gear.`
    );
  }
  if (!ctx.waiting && ctx.onMyPlate > 0) {
    urgent.push(
      ctx.onMyPlate === 1
        ? "Nothing is waiting on you. 1 item is still with you."
        : `Nothing is waiting on you. ${ctx.onMyPlate} items are still with you.`
    );
  }

  const calm: string[] = [];
  const season = seasonNote(ctx.month, ctx.dayOfMonth);
  if (season) calm.push(season);
  const mNote = monthNote(ctx.dayOfMonth);
  if (mNote) calm.push(mNote);
  calm.push(...(DAY_NOTES[ctx.weekday] ?? []));
  if (ctx.eventsThisWeek > 0) {
    calm.push(
      ctx.eventsThisWeek === 1
        ? "1 thing on your calendar for the rest of this week."
        : `${ctx.eventsThisWeek} things on your calendar for the rest of this week.`
    );
  }
  if (ctx.roleLabel) calm.push(`You are seeing this as ${ctx.roleLabel}.`);
  if (band === "night") calm.push("It is past midnight in Kampala — most of this can wait until morning.");
  if (!ctx.waiting && !ctx.onMyPlate) calm.push("Your list is clear — a good time to get ahead.");

  const note = urgent.length ? urgent.join(" ") : pick(calm.length ? calm : ["Here is where everything stands."], 7);
  return { headline, note };
}

export default buildGreeting;
