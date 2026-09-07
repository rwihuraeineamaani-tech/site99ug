# Departments in the team portal

Reshape the signed-in area around the departments of the business, with each person seeing only their own department (leadership sees everything). The whole menu appears now, so the shape of the system is visible from day one; departments that aren't built yet open a short placeholder page.

## Sidebar structure (in this order)

```text
Overview
  Dashboard

Departments
  Content & strategy
  Client relations
  Sales
  Legal, partnerships & contracts
  Management & operations
  Finance
  Site editing

Winding down
  Events
  Gate scanner
```

Events sits last, under its own heading, so it stays fully usable while being phased out.

## Who sees what

- Each department section is visible to the people who belong to it. A creative sees Content & strategy; sales sees Clients and Sales; legal sees Contracts; Finance/Ops sees Finance.
- Founder, Creative Director and Managing Director see every section.
- Money (finance, payroll, contract splits) stays limited to Finance/Ops and leadership regardless of anything else.
- Anyone opening a section they don't belong to is sent back to their own dashboard, and the records behind it stay unreadable to them at the data level too — not just hidden in the menu.
- The dashboard greets each person with their own department's work rather than a generic overview.

## First department built in full: Content & strategy

A pipeline of content items moving through: Idea → Approved → Scheduled → Editing → Posted → Archived (plus Rejected).

Each item holds: a title, the client it belongs to, content type, current stage, a lead, a shooter and an editor, planned date, links to the finished post, and notes.

Screens:
- Board view — columns per stage, drag an item forward.
- List view — sortable table with filters by client, content type, stage and assigned person.
- Item detail — edit everything, change stage, see who's on it.
- A small strip on the dashboard: what's due this week and what's stuck.

Clients are picked from the existing client records, so a client is never typed twice.

## Placeholder departments

Client relations, Sales, Legal, Management & operations, Finance and Site editing each get a page now with the department name, a one-line description of what will live there, and a note that it's next. Site editing and Events point at the working pages that already exist.

## Technical notes

- New table `content_items` (client link, title, type, stage, lead/shooter/editor as team member references, planned_at, links, notes, timestamps + update trigger), with GRANTs, RLS enabled, and policies driven by security-definer role checks: creatives and leadership read/write; sales and legal read-only; clients see only their own client's items (portal use later).
- Add a `can_see_content` style helper alongside the existing `is_staff` / `is_leadership` / `can_see_finance` functions, and a generic `department` capability map in `useMyRoles` so each nav group and route guard reads one flag.
- Extend `RequireRole` gates from the current four to per-department gates.
- New routes under `/app`: `/app/content` (board + list), `/app/content/:id`, plus placeholder routes `/app/clients`, `/app/sales`, `/app/legal`, `/app/ops`, `/app/finance`. Existing `/app/site`, `/app/events`, `/app/scan` are re-grouped in the sidebar only.
- Sidebar groups in `AppShell.tsx` rebuilt from a single declarative department list filtered by capability flags.
