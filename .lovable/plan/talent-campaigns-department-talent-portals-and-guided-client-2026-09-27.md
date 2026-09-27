# Talent & Campaigns department, talent portals, and guided client onboarding

## 1. Talent & Campaigns (new sidebar section)
For the **Director of Talent & Commercial Initiatives** (new position that System Admin can assign), plus leadership.

- **Overview**: who is booked this week, contracts and releases ending soon, what talent is owed, and live campaigns.
- **Roster**: one card per person, with a filter for "signed roster" or "freelance". Each card holds contact details, their social handles and follower numbers, day rate, category and a portal status.
- **Bookings**: a booking links talent to a client, a campaign or a shoot day. It has a date, a fee and a status (requested, confirmed, done, cancelled). Booked talent shows up on the matching shoot day.
- **Contracts & releases**: agreements and usage rights for each person (where the content can be used and until when), with warnings when an end date is getting close.
- **Campaigns**: a client, a budget, dates, the talent involved and the platforms. Each campaign has a results screen showing reach, engagement, clicks and sales, entered by the team.
- **Forecasts**: estimation tools built on formulas. Every number shows the working behind it.
  - *Campaign impact estimator*: pick the talent and the platforms, then set a budget and number of posts. You get expected reach, engagement, cost per 1,000 views and cost per engagement. It uses each person's follower numbers and the typical engagement rates from our past campaign results, and falls back to standard defaults when we don't have history yet.
  - *Return estimator*: set the budget, the expected conversion rate and the order value. You get the expected sales and return, shown as low, likely and high.
  - *Talent comparison*: set talent side by side to compare cost against expected reach and past results.
  - *Forecast vs actual*: after a campaign ends, compare what we predicted with what really happened. This makes the estimates more accurate over time.
- Talent fees go through the existing payment path: a confirmed booking raises an approved bill, and paying the bill marks the booking paid.

## 2. Talent portal
- Every talent person gets their own login, created from the Roster the same way client portal logins work today (create or reset password).
- Their portal shows their bookings and shoot days with the brief, their contracts and release deadlines, earnings (owed and paid) and results for campaigns they appeared in. They see only their own work.

## 3. Client onboarding, run by Communications and supervised by the MD
Fix how the Onboarding tab on each client record works, and use one standard checklist for every client:

1. Create the portal account (done from the checklist, using the existing portal-access tool)
2. Legal: draft and sign the contract. **The MD approves this step.**
3. Brand guidelines and logo collected
4. Social accounts linked
5. Handler assigned
6. Strategy kick-off
7. First content plan
8. Invoice raised for the first payment
9. Handover. **The MD approves this, and then the client counts as fully onboarded.**

- Steps are owned by the Communications manager by default. Each step can be reassigned and has a due date.
- The Client Relations → Onboarding tab becomes the Communications manager's working board: each client's progress, overdue steps, and steps waiting for the MD.
- The MD sees "Waiting for your sign-off" on their dashboard and in Approvals.
- Existing clients such as Amaani Media: Communications gets a "start onboarding" button. Clients that are already established can also be marked "already onboarded" in one step, and that needs MD approval.
- On the Residents page, add an **onboarding** filter chip so clients who are being set up are never hidden.

## Technical details
- Enum: add `talent_director` to `app_role`. Add `departments.talent` in useMyRoles, a sidebar group, and routes `/app/talent/:tab` (overview, roster, bookings, contracts, campaigns, forecasts). Add talent portal routes at `/talent-portal/*`, inside the shared AppLayout.
- New tables, each with GRANTs and RLS. Talent-director, leadership and finance get full access; talent can read only their own rows through `talent_users`:
  - `talent` (kind roster/freelance, handles, followers, rate)
  - `talent_users` (login link)
  - `talent_bookings`
  - `talent_contracts` (usage terms, ends_on)
  - `campaigns`
  - `campaign_talent`
  - `campaign_results`
  - `campaign_forecasts` (saved inputs and outputs)
- `invoices.talent_booking_id` (unique): extend raise_bill_for_source and bill_paid_sync.
- New role `talent` for portal accounts (it exists already). Add `talent_login_create` and `talent_login_reset` actions to the admin-users function, with the same safeguards as client logins.
- Onboarding:
  - Add `requires_md_approval`, `approved_by` and `approved_at` to `resident_onboarding_steps`, plus a standard step template.
  - RPC `start_resident_onboarding(_id)` creates the 9 steps, owned by the Communications holder.
  - RPC `approve_onboarding_step`: MD or Founder only. It is enforced by a trigger, so an MD-approval step can't be marked complete without that approval.
  - The portal step completes automatically once a `resident_users` link exists.
  - Handover approval feeds `recompute_resident_lifecycle`.
- Forecast maths lives in `src/lib/forecast.ts`, as pure functions with unit tests.
- Verify at desktop and 428px. Fix any build errors.
