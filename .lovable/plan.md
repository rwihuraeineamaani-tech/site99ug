# Clearer greeting and plain wording on the dashboard

## Goal
Rewrite the dashboard greeting, fix the grammar of the line under it, and replace insider phrasing across the dashboard with words anyone on the team understands instantly.

## 1. The greeting itself
- Keep one greeting per visit (it should not reshuffle while you work), but rewrite the wording.
- Replace studio-slang openers such as "Rise and roll", "Burning the reel", "Fresh call sheet", "Golden hour" and "Late edit" with warm, plain openers: "Good morning", "Morning", "Good afternoon", "Good evening", "Working late", "Still here".
- Keep the person's first name and a full stop.
- Late-night greeting stays kind and simple: "Working late, Eineamaani."

## 2. The line under the greeting
Rewrite it as one clean sentence, with correct singular and plural in every case.

- Work waiting: "3 things need you today." / "1 thing needs you today."
- Shoot today: "1 shoot today — check the call time and gear."
- Both: joined into one readable sentence rather than two clipped ones.
- Nothing urgent but work in hand: "Nothing is waiting on you. 4 items are still with you." / "1 item is still with you."
- Fully clear: "Your list is clear — a good time to get ahead."
- Calendar line: "4 things on your calendar for the rest of this week."
- Role line rewritten from "Everything here is filtered for you as founder." to "You are seeing this as Founder."
- Month and season notes rewritten in plain English, for example: "Month end — invoices, filing and client numbers need closing." and "Start of the month — check targets and retainers."
- Day notes shortened and made natural, for example: "Monday. Set the week up early." and "Friday. Finish things cleanly."

## 3. Plain words across the dashboard
Rename labels that assume studio jargon:

| Now | Becomes |
| --- | --- |
| Command deck | Your day |
| On your plate | Work with you |
| In the pipeline | Content in progress |
| Your month so far | Your earnings this month |
| Today & overdue | Today and late |
| Your KPI performance | How you are doing |
| Studio performance | How the studio is doing |
| Nothing on the clock. | Nothing due today. |
| A clear week. | Nothing else this week. |
| Nothing to measure yet. | No figures yet. |
| Working out your numbers… | Adding up your numbers… |
| Client numbers filled | Client numbers recorded |
| Shoots landed | Shoots completed |

Also reword the small notes under each figure so they read as sentences, for example "3 posted in the last 30 days, 1 before that" instead of "pieces live in 30 days · 1 before".

## Scope
Wording only. No change to what is counted, who sees what, or how anything works.

## Technical notes
- `src/lib/greeting.ts`: rewrite openers, day/month/season notes and the note builder, keeping the session-seeded pick and the same `GreetContext` shape.
- `src/components/deck/index.tsx`: change the "Command deck" eyebrow text.
- `src/pages/app/Dashboard.tsx`: update figure labels, column titles and empty-state text.
- `src/lib/kpi.ts`: update figure labels and note strings.
- Verify with a typecheck, the preview build, and a look at the dashboard signed in.
