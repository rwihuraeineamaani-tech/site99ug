# Site 99: public site + internal operating system

Turn the project into two layers that share one identity: a sharpened public site, and a logged-in operating system that replaces the dozen Google Sheets with one connected set of records.

Delivered phase by phase — you approve each phase before the next starts.

## Visual direction

Editorial red on off-white: off-white paper (#F7F7F7), near-black ink (#0F0F0F), Site 99 red (#B80000) used only as a signal, grey for secondary text. Big Montserrat headlines, hairline rules instead of boxes, generous whitespace on the public side; the same type and rules compressed into dense, calm tables inside the system, so both halves read as one product.

## Phase 1 — Design system + public site

- One shared set of colours, type scales, rules, buttons, tables and status markers.
- Restyled public pages: home, services, sector showcase, portfolio/case studies, about, contact. Existing copy, projects and images are migrated, not discarded.
- AI & Automations sector (nav item, home teaser, Kazi Intelligent Systems showcase, its own themed sub-site) is kept intact and restyled to sit inside the new layout.
- Public shell and app shell share the same header logic so signing in feels like going deeper, not into another product.

## Phase 2 — Access and roles

- One sign-in for everyone; where you land depends on your role.
- Team roles: Founder/Creative Director, Managing Director, Head of Sales & Partnerships, Finance/Ops, Creative/Production, Legal. All see the system; payroll, contract splits and finance are limited to Finance/Ops and leadership.
- Client role: invited by email by your team and tied to one client record. Sees only their own engagement.
- The existing events/ticketing console folds in as a module of the new system; current admin, event manager, scanner, viewer and site editor logins keep working and map onto the new structure.

## Phase 3 — Core records (the spine)

Linked records, entered once:

- Clients — name, contact person, status, category
- Contracts — contract ID, client, period, value, status (Draft/Signed/Active/Complete/Terminated/Cancelled), handler, contact person, handler %, contact %, Site 99 revenue calculated from the split
- Content items — idea ID, client, content type, status (Idea/Approved/Rejected/Scheduled/Editing/Posted/Archived), links, team assigned (lead, shooter, editor)
- Finance transactions — date, description, type (income/expense/payroll), amount, category (OPEX/CAPEX/payroll/client payment), linked client or contract
- Team & payroll — member, role, agreed allowance, status (Paid/Redirected/Pending), notes
- Legal documents — attached to a contract, with stage tracking and uploads

Every module reads and writes these same records, so a client or contract is never typed twice.

## Phase 4 — Operations dashboard

Live view of clients and contracts by status, with revenue and days remaining, plus the team roster and who is on what.

## Phase 5 — Content

Pipeline board: Idea → Approved → Scheduled → Editing → Posted → Archived. Filter by client, content type or assigned person. Replaces the standalone content ledger.

## Phase 6 — Finance

Totals for revenue, expenses, payroll, net cash flow and ROI; a client ledger showing the handler/contact split and Site 99's net per contract; an operating expenses log (OPEX/CAPEX); and the payroll/allowance tracker.

## Phase 7 — Client portal

For invited clients only: their contract status and timeline, deliverables and content calendar, and invoices with payment status.

## Technical notes

- Design tokens in `index.css` + Tailwind config; new `PublicShell` and `AppShell` layouts; shared primitives (DataTable, StatusChip, Money, PageHeader, FilterBar).
- Roles stay in `user_roles` with the `app_role` enum extended (`founder`, `managing_director`, `sales_head`, `finance_ops`, `creative`, `legal`, `client`); access enforced by row-level policies using security-definer role checks, never client-side.
- `client_users` join table maps an invited client login to one client record; client policies scope every read through it.
- New tables: `clients`, `contracts`, `content_items`, `finance_transactions`, `payroll_entries`, `legal_documents` — each with grants, RLS, timestamps and update triggers. Site 99 revenue is a generated/derived column from contract value and the split percentages.
- Existing events tables and routes are untouched; the events console is re-parented under the new app shell.
- Document uploads go to a private storage bucket with contract-scoped policies.

## What this does not include yet

Data import from your current spreadsheets — we can do a CSV import pass once the tables are live, as a follow-up phase.
