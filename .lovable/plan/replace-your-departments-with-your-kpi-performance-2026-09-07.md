# Replace "Your departments" with "Your KPI performance"

The fourth column of the dashboard board currently lists department shortcuts. Those links already sit in the left menu, so they come off the dashboard entirely. In their place goes a personal performance panel covering the last 30 days, with the previous 30 days as the comparison.

## What each person sees

Four figures, each with the number, a plain label, and an up/down against the previous 30 days:

- **My output** — pieces I led, shot, edited or was crewed on that reached posted in the window.
- **On time** — share of my dated work that landed on or before its date; the slipped count sits beside it.
- **Numbers filled** — weekly client numbers I was meant to fill: filled vs still missing.
- **Client results** — reach and follower change across the client accounts I'm assigned to.

Under the figures, one line naming the strongest and weakest of the four, so someone knows where to push.

Each figure is clickable and lands on the page where that work lives (pipeline, calendar, the client's numbers).

## Leadership

Managing directors and founders get the same panel with a toggle between **Mine** and **Studio**. The studio view runs the same four figures across everyone, plus the weakest department for the window.

## When there's nothing yet

If a person has no work in the window, the panel says so plainly rather than showing zeros with fake trends.

## Technical notes

- Edit `src/pages/app/Dashboard.tsx`: drop the `modules` array and the `Your departments` `DeckColumn`; add a `Your KPI performance` column built from the deck primitives (`DeckColumn`, `DeckCard`, count-up figures).
- New `src/lib/kpi.ts` holding the window maths (last 30 days / previous 30) and the metric shapes, so the panel stays declarative.
- Sources, all existing tables — no schema change:
  - `content_items` (`posted_at`, `planned_at`, `metrics_due_at`, `metrics_filled_at`, `lead`/`shooter`/`editor`, `resident_id`) joined with `content_crew` (`content_id`, `user_id`) for "my" involvement.
  - `account_metrics` (`week_start`, `followers`, `reach`, `filled_by`, `account_id`) joined to `client_accounts` → `residents`, scoped by `client_assignments` for the accounts a person is on.
  - Existing `my_pending_account_weeks` RPC for what is still unfilled.
- Fetch in the existing dashboard effect (parallel with the current queries) and compute the two windows client-side; leadership "Studio" mode reuses the same rows without the user filter, since `content_items` and `account_metrics` are already readable by all staff.
- Role gating via `useMyRoles` (`isLeadership`) for the Mine/Studio toggle.
