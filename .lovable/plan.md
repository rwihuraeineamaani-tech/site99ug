# Hide "Getting started" once onboarding is finished

## What is wrong
On the client dashboard the "Getting started" card always shows. It also does not count steps marked "Not needed" as finished, so a fully onboarded client (for example Kweeza Establishments, 13 complete + 1 not needed) still sees steps "to finish".

## Fix
- Count both "Complete" and "Not needed" steps as finished.
- When every step is finished, remove the "Getting started" card from the client dashboard entirely.
- In its place show a "Your plan" card with the current contract months left (or "Content this month" count if no contract), so the row stays full.
- Clients still mid onboarding (Tameem Effect, Hemba Africa Foundation, Afredim) keep seeing the progress bar, with correct numbers.

## Technical details
- `src/pages/app/portal/PortalOverview.tsx`: `done` filter accepts `complete`, `done`, `not_needed`; render card only when `steps.length && done < steps.length`; otherwise render replacement card using already loaded `items` count for this month.
