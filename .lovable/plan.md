# Legal and Management — real sections with their own tabs

Today both "Legal & contracts" and "Management & ops" are single placeholder pages listing what is coming. This turns them into two real, multi-tab areas in the sidebar, the same way Finance already works.

## Legal (sidebar group "Legal")

- **Overview** — what needs attention: contracts expiring in the next 60 days, unsigned ones, obligations due, and counts by status.
- **Contracts** — one register for every agreement, not just residents: client, supplier, partner, freelancer or staff. Each record has the other party, type, start and end dates, value, status (draft, out for signature, active, expiring, ended, cancelled), owner, notes and the signed file. Resident contracts already stored keep working and appear here too, and the resident page keeps its own contracts block.
- **Partnerships** — partner records with the terms, the split (percentage or fixed), the period, who owns the relationship and what each side owes.
- **Documents** — a private library for templates, NDAs and policies, with a name, category, version and file.
- **Compliance** — licences, registrations and any recurring obligation: name, authority, reference number, renewal date, owner, status.

Alerts are in-app only: expiring contracts and due obligations show on the Legal overview and in "Waiting on you" on the dashboard for the record's owner. Contract and partnership amounts are hidden unless you are finance, leadership or legal — everyone with Legal access still sees that the record exists, its party, dates and status.

## Management & ops (sidebar group "Management")

- **Overview** — the business at a glance: active residents, contracts running, content live by stage, shoots this month, money in and out this month (finance/leadership only), and what is late.
- **People** — the team roster with title, access, what they are on right now, and how many jobs each person carries this week.
- **Workload** — the week ahead: shoot days, items in editing, items awaiting approval, per person.
- **Deadlines** — everything with a date attached (content due, shoots, contract ends, metric fill-ins), sorted by days remaining with late items flagged red.
- **Weekly report** — a report per week that pulls the numbers automatically, with a space for the written note, saved and readable by all staff.
- **Announcements** — post a studio announcement (the existing announcements store), shown on everyone's dashboard.
- **Equipment** — the existing equipment page moves under this group instead of sitting loose.

## Who sees what

- Legal group: founders, managing director, admin and anyone with the legal role.
- Management group: leadership (founder, MD, creative director, admin).
- Everyone else keeps their existing tabs; nothing is removed.

## Technical notes

New tables, all with GRANTs to `authenticated` and `service_role`, RLS on, `updated_at` triggers:

- `contracts` — `party_kind` (resident/client/supplier/partner/freelancer/staff/other), `party_name`, `resident_id`, `client_id`, `title`, `contract_type`, `starts_on`, `ends_on`, `value_ugx`, `status`, `owner_user_id`, `file_path`, `notes`. Read `is_staff()`; write `is_leadership() OR has_role(auth.uid(),'legal') OR can_see_finance()`.
- `partnerships` — `name`, `partner_contact`, `terms`, `split_kind` (percent/fixed), `split_value`, `starts_on`, `ends_on`, `status`, `owner_user_id`, `notes`. Same rules.
- `legal_documents` — `title`, `category`, `version`, `file_path`, `notes`. Same rules.
- `compliance_items` — `name`, `authority`, `reference_no`, `renews_on`, `owner_user_id`, `status`, `notes`. Same rules.
- `weekly_reports` — `week_start` (unique), `body`, `metrics jsonb`, `published`, `created_by`. Read `is_staff()`; write `is_leadership()`.

Private storage bucket `legal-files` (25MB) for contract, partnership and document files, with `storage.objects` policies matching the table write rule; short-lived signed URLs on open. Value columns are only selected client-side when `canSeeFinance || isLeadership || has("legal")`.

Helper `public.ops_overview()` (SECURITY DEFINER, `REVOKE` from PUBLIC/`anon`, `GRANT` to `authenticated`, internal `is_staff()` gate) returning the counts the Management overview needs in one call, so the page does not fire ten queries.

Frontend: new folders `src/pages/app/legal/` (`Overview.tsx`, `Contracts.tsx`, `Partnerships.tsx`, `Documents.tsx`, `Compliance.tsx`) and `src/pages/app/ops/` (`Overview.tsx`, `People.tsx`, `Workload.tsx`, `Deadlines.tsx`, `WeeklyReport.tsx`, `Announcements.tsx`). Routes `/app/legal` plus `/app/legal/contracts|partnerships|documents|compliance` behind `RequireRole gate="legal"`, and `/app/ops` plus `/app/ops/people|workload|deadlines|report|announcements` behind `gate="ops"`; `/app/equipment` stays where it is but is listed inside the Management group. `AppShell.tsx` gets two nested groups built the same way as the Finance group. Existing `LegalContracts` and `ManagementOps` placeholders in `Departments.tsx` are removed. Styling follows the current system: `PageHeader`, `SectionHeading`, `StatusChip`, `DataTable`, `FilterBar`, `.press`/`.card-lift`, `.field`, `ctl ctl-solid eyebrow px-4 py-2.5 focus-ring`.
