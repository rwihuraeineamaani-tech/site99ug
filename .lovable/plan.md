# Lock every Finance action behind the PIN

## Goal
On every Finance page, nothing can be clicked or typed until the person types their six-digit PIN. Anyone who has not set a PIN yet sees a clear button that takes them straight to where they set it.

## How it will work
- Opening any Finance page shows the figures and lists as normal (reading stays free), but every button, field and menu on the page is switched off.
- A bar at the top of the page says finance actions are locked, with an "Unlock with PIN" button.
- Typing the correct PIN unlocks the whole page for five minutes. The countdown and a "Lock now" button stay in the header, exactly as today. When the five minutes run out, the page locks itself again.
- If the person has never set a PIN, the bar instead says so and shows a "Set up your PIN" button that opens My settings on the Security section, with the PIN form ready.
- If the PIN has been locked after three wrong tries, the bar says when they can try again.

## What is affected
All Finance pages: Overview, Cashbook, Payments, Invoices, Requests, Budgets, Loans, Monthly run, Filing, Reports, Lookup.

## One thing that must be fixed at the same time
The database function that checks the PIN is currently not callable by signed-in staff, so unlocking would fail with a permission error. The fix grants staff permission to run only the PIN check (it still returns nothing but true/false and keeps the three-try lockout), so the unlock actually works.

## Technical notes
- `FinanceLock.tsx`: track whether the person has a PIN row (`payment_pins` select) and any `locked_until`; expose `hasPin`, `lockedUntil` and a `Gate` state through the existing context.
- `FinancePage.tsx`: wrap `children` in a `fieldset disabled` (with `pointer-events` off for links that act as actions) whenever the lock window is closed, and render the new lock bar above the content.
- Lock bar states: no PIN → "Set up your PIN" linking to `/app/settings?tab=security`; PIN locked out → countdown message; otherwise → "Unlock with PIN" opening the existing dialog.
- `Settings.tsx`: read `?tab=` on load so the link lands on the Security section.
- Migration: `GRANT EXECUTE ON FUNCTION public.check_payment_pin(uuid, text) TO authenticated;`.
- Keep the existing per-action `require()` calls as a second layer.
- Verify with a typecheck, the preview build, and a signed-in look at a Finance page in both states.
