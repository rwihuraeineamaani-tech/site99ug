/**
 * Hand-written greetings for the command deck.
 * One greeting is picked per visit (seeded in sessionStorage) so the page does
 * not shuffle on every render, but every new session feels different.
 *
 * The engine mixes three layers so a visit never feels copy-pasted:
 *   headline — who you are, what time it is, what kind of day it is
 *   note     — what actually needs you, else what today is about
 *   tail     — an occasional one-liner for energy
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

function chance(invertedMod: number): boolean {
  // Roughly 1-in-N sessions get the special treatment.
  return seed() % invertedMod === 0;
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

/* ------------------------------------------------------------------ *
 * Headlines
 * ------------------------------------------------------------------ */

const OPENERS: Record<string, string[]> = {
  night: [
    "Working late",
    "Still here",
    "The city is asleep, you are not",
    "Past midnight",
    "Late shift",
    "Burning the midnight",
    "While Kampala sleeps",
  ],
  morning: [
    "Good morning",
    "Morning",
    "Up with the sun",
    "Fresh start",
    "New day",
    "Early bird",
    "The day is young",
    "Coffee first, then this",
  ],
  afternoon: [
    "Good afternoon",
    "Afternoon",
    "Mid-day check-in",
    "Half the day gone",
    "Deep in the day",
    "Still pushing",
  ],
  evening: [
    "Good evening",
    "Evening",
    "Winding down",
    "Last stretch",
    "End of the day",
    "Sunset shift",
  ],
  late: [
    "Good evening",
    "Working late",
    "Still here",
    "One more thing before bed",
    "The day is almost done",
  ],
};

/** Big-day headline swaps — only some sessions get them, and only on the day. */
function dayHeadline(ctx: GreetContext): string | null {
  const first = firstName(ctx.name);
  if (ctx.weekday === 1)
    return pick([`New week, ${first}.`, `Monday. Fresh page, ${first}.`, `${first}, week one starts now.`], 3);
  if (ctx.weekday === 5)
    return pick([`Friday, ${first}. Finish strong.`, `${first}, it is Friday.`, `Friday energy, ${first}.`], 3);
  if (ctx.weekday === 0 || ctx.weekday === 6)
    return pick([`Weekend, ${first}.`, `${first}, it is the weekend.`], 3);
  if (ctx.dayOfMonth === 1)
    return pick([`New month, ${first}.`, `${first}, a fresh month begins.`], 3);
  if (ctx.month === 11 && ctx.dayOfMonth >= 15)
    return pick([`Festive season, ${first}.`, `${first}, December stretch.`], 3);
  if (ctx.month === 0 && ctx.dayOfMonth <= 10)
    return pick([`New year, ${first}.`, `${first}, a new year opens.`], 3);
  return null;
}

/* ------------------------------------------------------------------ *
 * Notes — what today actually holds
 * ------------------------------------------------------------------ */

const DAY_NOTES: Record<number, string[]> = {
  0: [
    "Sunday. Only do what really needs you today.",
    "Sunday. A good day to rest and plan lightly.",
    "Sunday — recharge. The week will ask a lot of you.",
    "Quiet Sunday. Let the inbox breathe.",
  ],
  1: [
    "Monday. Set the week up early.",
    "Monday. Whatever you start today sets the tone.",
    "Monday — win the first hour and the week follows.",
    "Monday. Line up the week before it lines you up.",
  ],
  2: [
    "Tuesday. A good day for steady work.",
    "Tuesday. Keep the week moving.",
    "Tuesday — the week has settled, now push it.",
  ],
  3: [
    "Wednesday. Halfway through the week.",
    "Wednesday. A good day to check progress.",
    "Wednesday — halfway there. Keep the pace.",
    "Midweek. Look at what is slipping and catch it now.",
  ],
  4: [
    "Thursday. Close things before Friday.",
    "Thursday. Tie up loose ends.",
    "Thursday — clear the small stuff so Friday is free.",
  ],
  5: [
    "Friday. Finish things cleanly.",
    "Friday. Wrap up the week well.",
    "Friday — close what you can, so Monday starts light.",
    "Friday. Ship it, then rest easy.",
  ],
  6: [
    "Saturday. Shoot days often fall today.",
    "Saturday. The calendar is usually busy today.",
    "Saturday — if there is a shoot, it is a good one.",
  ],
};

const FLAIR = [
  "Kampala traffic will not post content for you — but you can.",
  "Small consistent numbers beat big one-off pushes.",
  "One good idea today is worth ten planned for next month.",
  "The clients who pay the most notice the small things.",
  "Post, measure, adjust. That is the whole game.",
  "Done is better than perfect. Posted is better than done.",
  "Nobody remembers the draft that was never posted.",
  "A clear list tonight is a gift to tomorrow's you.",
  "Check the numbers before they check you.",
  "The studio runs on people who show up like today matters.",
  "Momentum is the cheapest advantage we have.",
  "Talent books the first job. Reliability books the next ten.",
];

function seasonNote(month: number, day: number): string | null {
  if (month === 11 && day >= 15)
    return "Festive season — approvals take longer, so plan ahead.";
  if (month === 0 && day <= 10)
    return "New year. A good time to set this year's targets.";
  if (month === 5 && day >= 25)
    return "Half the year is nearly gone. A good time to review the numbers.";
  return null;
}

function monthNote(day: number): string | null {
  if (day <= 3) return "Start of the month — check targets and retainers.";
  if (day >= 26) return "Month end — invoices, filing and client numbers need closing.";
  if (day >= 13 && day <= 16) return "Mid-month. Halfway to this month's targets.";
  return null;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

/** Build the headline and the supporting line under it. */
export function buildGreeting(ctx: GreetContext): { headline: string; note: string } {
  const band = timeBand(ctx.hour);
  const first = firstName(ctx.name);

  /* Headline: big-day swap for some sessions, else time-of-day opener. */
  const special = dayHeadline(ctx);
  let headline: string;
  if (special && chance(2)) {
    headline = special;
  } else {
    const opener = pick(OPENERS[band], 0);
    const styles = [
      `${opener}, ${first}.`,
      `${opener}, ${first}.`,
      `${opener}, ${first}.`,
      `${first} — ${opener.toLowerCase()}.`,
    ];
    headline = pick(styles, 11);
  }

  /* Note: urgent first, then calendar/season, else day notes plus a tail. */
  const urgent: string[] = [];
  if (ctx.waiting > 0) {
    urgent.push(
      pick(
        [
          ctx.waiting === 1 ? "1 thing needs you today." : `${ctx.waiting} things need you today.`,
          ctx.waiting === 1 ? "One item is yours to handle today." : `${ctx.waiting} items are yours to handle today.`,
          ctx.waiting === 1 ? "Your name is on 1 thing today." : `Your name is on ${ctx.waiting} things today.`,
        ],
        5
      )
    );
  }
  if (ctx.shootsToday > 0) {
    urgent.push(
      pick(
        [
          ctx.shootsToday === 1
            ? "1 shoot today — check the call time and gear."
            : `${ctx.shootsToday} shoots today — check the call times and gear.`,
          ctx.shootsToday === 1
            ? "Shoot day. Confirm the call time and pack early."
            : `Shoot day — ${ctx.shootsToday} of them. Confirm the call times.`,
        ],
        6
      )
    );
  }
  if (!ctx.waiting && ctx.onMyPlate > 0) {
    urgent.push(
      ctx.onMyPlate === 1
        ? "Nothing is waiting on you. 1 item is still with you."
        : `Nothing is waiting on you. ${ctx.onMyPlate} items are still with you.`
    );
  }

  const tail: string[] = [];
  const season = seasonNote(ctx.month, ctx.dayOfMonth);
  if (season) tail.push(season);
  const mNote = monthNote(ctx.dayOfMonth);
  if (mNote) tail.push(mNote);
  if (ctx.eventsThisWeek > 0) {
    tail.push(
      ctx.eventsThisWeek === 1
        ? "1 thing on your calendar for the rest of this week."
        : `${ctx.eventsThisWeek} things on your calendar for the rest of this week.`
    );
  }
  if (band === "night") tail.push("It is past midnight in Kampala — most of this can wait until morning.");
  if (!ctx.waiting && !ctx.onMyPlate) tail.push("Your list is clear — a good time to get ahead.");
  if (ctx.roleLabel && chance(4)) tail.push(`You are seeing this as ${ctx.roleLabel}.`);

  let note: string;
  if (urgent.length) {
    /* Urgent line, plus an occasional kicker so it does not read like a system message. */
    note = chance(3) ? `${urgent.join(" ")} ${pick(FLAIR, 9)}` : urgent.join(" ");
  } else {
    const day = pick(DAY_NOTES[ctx.weekday] ?? [], 7);
    const calm = [...tail, day].filter(Boolean) as string[];
    const flair = pick(FLAIR, 13);
    note = chance(2) && calm.length ? `${pick(calm, 8)} ${flair}` : calm.length ? pick(calm, 8) : flair;
  }

  return { headline, note };
}

export default buildGreeting;
