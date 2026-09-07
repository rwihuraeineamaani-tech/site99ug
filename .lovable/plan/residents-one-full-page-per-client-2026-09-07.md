# Residents: one full page per client

"Client relations" becomes **Residents**, and each resident gets a proper record page holding everything we know about them.

## What changes

**The section is renamed.** Sidebar, page title and address all read Residents (the old address keeps working so saved links don't break).

**The list.** Every resident, not only the ones with social accounts: name, territory, status, who the contact person and handler are, how many accounts we run, how much content is live, and whether a contract is active. Filter by status, search by name.

**The resident page.** Opening a resident shows one page with these blocks:

- **Overview** — status, territory, with us since, contact person, handler, portal email and whether they've accepted, plus a quick summary (accounts managed, content posted, contract state).
- **Accounts and numbers** — the social accounts we manage, latest followers and change, the weekly fill-in prompt and full week/month history with export. Same behaviour as today, just scoped to this resident.
- **Content** — everything ever done for them, split into "In motion" (idea through to handover) and "Archive" (posted, with where it went and its numbers). Each row links through to the item.
- **Shoot days** — planned and wrapped days for this resident, with dates and what was shot.
- **Contracts** — upload the signed document with start date, end date, value and status. The current one sits at the top; ended or replaced ones fall into an archive list below. Anyone on the team can see a contract exists; only leadership, finance and legal can open, upload or archive one.
- **Money** — retainer and the split between the people assigned to them, visible only to finance and leadership.
- **Notes** — the free-text notes already on the record, editable by leadership.

## Who can do what

- Every staff account can open Residents and read the overview, accounts, content and shoot days.
- The contact person and handler for a resident can fill in weekly numbers, as they do now.
- Leadership, finance and legal can edit the record, upload and archive contracts.
- Money is finance and leadership only.
- Clients signing in to their own portal are unaffected — this is the internal page.

## Technical notes

- New table `public.resident_contracts`: `resident_id`, `title`, `file_path`, `starts_on`, `ends_on`, `value_ugx`, `status` (`active` / `archived`), `notes`, `created_by`, timestamps. GRANTs to `authenticated` and `service_role`; RLS — read for `is_staff(auth.uid())`, write for `is_leadership(auth.uid()) OR can_see_finance(auth.uid()) OR has_role(auth.uid(),'legal')`.
- New private storage bucket `resident-contracts` with `storage.objects` policies matching the same read/write roles; files stored under `<resident_id>/<uuid>-<filename>` and served via signed URLs.
- Routes: `/app/residents` (list) and `/app/residents/:id` (record). `/app/clients` redirects to `/app/residents`. Sidebar entry in `src/components/system/AppShell.tsx` relabelled and pointed at the new path.
- `src/pages/app/Clients.tsx` becomes `src/pages/app/Residents.tsx` (list) plus `src/pages/app/ResidentRecord.tsx` (record). The existing weekly-metrics entry dialog, history dialog and CSV export move into a shared `src/components/system/AccountMetrics.tsx` so both the list prompt and the record page use one implementation. `ClientPayPanel` is reused inside the money block, filtered to the one resident.
- Content, shoot day and contract reads are scoped by `resident_id`; stage labels come from `STAGES` / `STAGE_NOTE` in `src/lib/contentFlow.ts`; posted numbers come from `content_items.metrics` and `posted_slots`.
- Existing styling conventions kept: `px-8 md:px-16`, hairline rules, `.press` / `.field` / `ctl` controls, `StatusChip` for states.
