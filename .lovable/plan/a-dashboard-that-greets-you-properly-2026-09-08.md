# A dashboard that greets you properly

Right now the dashboard says one of four things: "Good morning / afternoon / evening / Still up, {name}." This replaces that with a greeting engine that knows who you are, what your day looks like, what day of the year it is, and what you have just pulled off — with a mixed tone that swings between studio-cool and warm, and a new line every visit.

## What changes on screen

The header keeps its shape (greeting line, role chips, tagline) but the greeting line and the tagline both become alive:

- **Greeting line** — the personalised hello, e.g. "Back on deck, Rwihura." / "Shoot day, Rwihura." / "Friday, and you're clear."
- **Tagline** — a second, situational line that says what today actually holds, e.g. "One shoot, two approvals, and a target you're 80% to." It keeps the current "waiting on you" logic as one of its options.
- **A small sign-off chip** appears when there is something worth marking: a target hit, a work anniversary, month-end, a festive day.

## What the greeting knows about

1. **Time of day (Kampala)** — dawn, morning, midday, afternoon, evening, late night, each with several phrasings.
2. **Their role** — founder/MD, creative director, creative, finance, legal, sales, admin, client. Each role gets its own pool of lines that speak to what that person actually does.
3. **Their day ahead** — a shoot today or tomorrow, content due to post, approvals waiting on them, numbers to fill, a payment to release, a clear day.
4. **Day of week and season** — Monday openers, midweek, Friday push, weekend, first of the month, month-end, end of quarter, Ugandan public holidays and the festive stretch in December.
5. **Milestones and wins** — content posted in the last day or two, a monthly target reached, a client goal marked done, a shoot wrapped, a work anniversary based on when they joined.

## Tone and rotation

Lines are written in two voices — studio-cool (short, confident) and warm (friendly, a little Kampala colour) — and the engine mixes them so it never settles into one register. One greeting is picked per visit: it stays steady while you work and a new one appears next time you open the dashboard.

Nothing is ever generic when the engine has something better: milestones outrank the day ahead, the day ahead outranks the calendar occasion, and plain time-of-day is the fallback.

## Technical notes

- New file `src/lib/greeting.ts`: greeting context type, line pools tagged by voice/role/situation, Ugandan holiday list, a deterministic picker seeded per session, and `buildGreeting(ctx)` returning `{ greeting, tagline, badge? }`.
- `src/components/deck/index.tsx`: `useKampalaClock` gains a finer time-band value; `DeckHeader` accepts an optional `badge` next to the role chips and takes the greeting string as a prop instead of computing it.
- `src/pages/app/Dashboard.tsx`: assembles the context from data already loaded there (roles, `waiting`, `onMyPlate`, shoots, KPI figures with targets, pending metrics) plus a light lookup of the signed-in person's start date, then passes the result into `DeckHeader`.
- Session rotation via a `sessionStorage` seed (`site99:greet-seed`), so the same tab keeps one greeting.
- No database changes; work anniversaries use the existing team member record date.

## Out of scope

- No AI-generated greeting text — the pools are hand-written so the voice stays ours and it costs nothing to render.
- No greeting settings page; if you want to mute it later, that is a separate ask.
