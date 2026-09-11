# Complete Sales workspace

## Goal
Replace the current Sales placeholder with a complete commercial workspace covering new leads, existing-client growth, and partnerships—from first contact through an approved offer, signed contract, invoicing, and client onboarding. Make **Residents** the one authoritative client database everywhere in the system.

## One Residents database
The system currently has 12 Residents and a separate Clients database containing one active record, Rated. As requested:

- Delete Rated rather than migrating it.
- Remove the old Clients database after safely removing or repointing every dependency.
- Move client login, contact, commercial, onboarding, contract, invoice, communication, strategy, content, shoot, account, and finance relationships onto Residents.
- Replace remaining `client` selectors, links, labels, and lookups throughout the app with the shared Resident record.
- Preserve the existing 12 Residents and all records already connected to them.
- Add the missing client fields to Residents: organisation and billing details, primary and additional contacts, phone/email, source, category, lifecycle status, assigned Sales owner, tax/TIN details where supplied, and onboarding state.
- Keep sensitive contact and billing information staff-only, while client portal users continue to see only their own organisation.

### Resident onboarding
- Add an **Onboard resident** action on the Residents page and Resident record.
- Sales forwards a won opportunity into onboarding with one action; prospect details, contacts, scope, value, offer, approval, and activity history carry forward automatically.
- Detect possible duplicates by normalised organisation name, email, and phone before creating a Resident.
- Use an onboarding checklist for contact confirmation, owner/handler assignment, approved offer, Legal contract, Finance invoice/deposit, brand guidelines/assets, strategy kickoff, portal invitation, and first production brief.
- Show onboarding progress and blockers on the Resident card and full record.
- Each specialist completes their own step in Legal, Finance, Strategy, or Content; Sales tracks progress without re-entering the data.

## Sales workspace
Create dedicated Sales tabs:

- **Overview** — live pipeline value, weighted forecast, expected revenue, conversion rate, overdue follow-ups, wins, losses, and team performance.
- **Pipeline** — drag-and-drop board and list view using: New lead → Contacted → Qualified → Discovery → Proposal → Negotiation → Won/Lost.
- **Opportunities** — full opportunity record linked directly to a prospect or existing Resident, with owner, assigned collaborators, source, service, probability, value, expected close, next action, activity history, files, notes, and loss reason.
- **Offers** — reusable rate cards/packages, proposals, and quotes/estimates with line items, discounts, Uganda tax treatment, validity dates, terms, and client-ready PDF export.
- **Partnerships** — sponsor/collaboration opportunities, proposed terms, commissions/splits, contacts, value, dates, and conversion into the existing Legal partnership register.
- **Forecast & reports** — monthly forecast, pipeline by stage/owner/source/service, win rate, sales cycle, target progress, and CSV/PDF export.

## Connected workflow

```text
Lead / existing client / partner
  → opportunity and follow-up plan
  → discovery and proposal
  → quote / estimate
  → Founder approval
  → contract handled in Legal
  → won opportunity
  → Resident record + invoice + onboarding tasks
```

- Link prospects to an existing Resident when applicable, without duplicating records.
- Let Sales assign an opportunity, offer, or follow-up to a team member; assigned work appears in To-Do and on the dashboard.
- Put meetings and follow-ups into the existing Calendar with reminders.
- Open direct Chat from the opportunity and keep messages distinct from internal activity notes.
- Submit proposals and quotes to the existing approval engine, with Founder approval before external issue.
- Send accepted commercial terms to Legal for contract creation and approval; Sales can track status but Legal remains the contract owner.
- On a won deal, Sales forwards the approved opportunity into the Resident onboarding flow; no information is retyped.
- Support renewals, upsells, retainers, and repeat projects against existing Residents.

## Daily working experience
- Fast lead capture with duplicate detection and required next action.
- Board cards show value, probability, owner, next step, due date, and warning state.
- Opportunity timeline records stage changes, calls, meetings, notes, sent documents, approvals, contract events, and win/loss.
- Clear “Waiting on you” and “At risk” sections for stale opportunities, expired quotes, missed follow-ups, and approvals.
- Global search, filters, saved card/list preference, mobile-friendly screens, and permission-aware actions.

## Access and control
- Sales Head and leadership can create, assign, edit, and manage opportunities and commercial values.
- Assigned collaborators can access only the work necessary for their assignment.
- Founder approval controls proposals, quotes, and exceptional discounts before they are marked ready to send.
- Sensitive commercial records use row-level access rules and audited server-side transitions.
- Every stage, value, assignment, approval, and conversion change is written to an immutable sales activity trail.

## Technical implementation
- Consolidate the legacy Clients structure into Residents first, delete Rated, migrate client-login and downstream foreign keys, update secure helper functions, and only drop the old table after dependency checks pass.
- Add normalized tables for Resident contacts/onboarding, leads, opportunities, assignments, activities, follow-ups, rate cards, offers, offer versions, line items, and sales targets.
- Add explicit grants, row-level policies, indexes, timestamp handling, and secure functions for stage changes, assignment, approval submission, win/loss, and conversion.
- Extend the existing approval engine with proposal and quote workflow types and seed published Founder-review workflows.
- Reuse the unified Resident, Legal contract/partnership, Finance invoice, Calendar, Chat, To-Do, and dashboard infrastructure rather than creating parallel records.
- Keep issued offer versions immutable so the approved PDF always matches the reviewed data.

## Verification
- Verify Rated is deleted, all old Clients references are removed, all existing Residents remain intact, and every Resident-linked area resolves the same record.
- Test new lead, existing-Resident upsell, and partnership journeys end to end.
- Verify assignment visibility, follow-up reminders, Founder approval, one-click Resident onboarding, Legal handoff, invoice preparation, portal access, and onboarding completion.
- Confirm access for Sales Head, leadership, assigned collaborators, and unrelated staff.
- Check board/list/mobile layouts, PDFs/CSV files, empty states, duplicate handling, and dashboard/To-Do counts.
- Run type, build, browser, database-policy, and security checks before completion.
