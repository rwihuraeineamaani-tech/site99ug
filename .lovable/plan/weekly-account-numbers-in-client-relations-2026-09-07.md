# Weekly account numbers in Client relations

Client relations stops being a placeholder. It becomes the place where every social account we manage for a client is listed, and where the contact person and handler put in that account's numbers once a week — so the month-end report is just a read-out, not a scramble.

## The accounts

Founders and management add the accounts on the client record (same place as contact person and handler): platform, the @handle, and whether it's still active. An account can be switched off when we stop managing it — its history stays.

## The weekly entry

Every Monday a fresh entry opens for the week that just ended (Monday to Sunday). Both the contact person and the handler of that client can fill it; either one filling it clears it for both.

Asked per account, per week:
- Followers (total at the end of the week)
- Profile visits
- Reach
- Impressions
- Posts published
- Link clicks / website taps

Numbers can be left blank if a platform doesn't report one, and a week can be edited after saving in case a figure was mistyped.

## Being prompted

- The "Waiting on you" strip on the dashboard lists every account still missing last week's numbers, with the client name and the platform. It stays there until filled.
- The Client relations page shows the same as a to-do list at the top, then each client with their accounts underneath.
- Each account row shows the latest week's followers with the change from the week before, so a drop is visible without opening anything.

## Seeing the history

Open an account and see every week recorded as a table: week ending, each number, and the week-on-week change in followers. A month view groups the weeks of a chosen month with totals for visits, reach, impressions, posts and clicks, and the net follower gain — the numbers a monthly report needs. The table exports to a spreadsheet file.

Leadership (founders, MD, admin) sees every client. Everyone else sees only the clients they are contact person or handler for.

## Technical notes

- New table `client_accounts`: `resident_id` (references `residents`), `platform` text, `handle` text, `active` boolean default true, `sort`, timestamps + update trigger. GRANT to `authenticated` and `service_role`; RLS: read/write for leadership and for the resident's `contact_user_id` / `handler_user_id`; insert/delete restricted to leadership.
- New table `account_metrics`: `account_id` (references `client_accounts` on delete cascade), `week_start date` (always a Monday), `followers`, `profile_visits`, `reach`, `impressions`, `posts`, `link_clicks` — all nullable integers — `filled_by uuid`, `filled_at`, timestamps + update trigger, `unique (account_id, week_start)`. RLS mirrors `client_accounts` via a security-definer helper `public.can_touch_account(_account_id uuid)` that checks leadership or the parent resident's contact/handler.
- Helper `public.my_pending_account_weeks()` (SECURITY DEFINER, STABLE, `authenticated` only): returns active accounts I'm contact or handler for that have no `account_metrics` row for the most recent completed week, with client name, platform and handle — one call powers both the dashboard strip and the clients page.
- Week is computed with `date_trunc('week', now())::date - 7` in Postgres; the client mirrors it with a small `lastCompletedWeek()` in `src/lib/weeks.ts` so the UI and the database agree.
- `src/pages/app/Clients.tsx` replaces the `ClientRelations` placeholder in `Departments.tsx`: pending-entry list, client sections with account rows, an entry dialog (six number fields), and an account history dialog with week table, month grouping and CSV export.
- `src/pages/Admin.tsx` residents form gains a repeatable accounts editor (platform select, handle, active toggle) under the contact/handler pickers, visible to leadership only.
- `Dashboard.tsx` `waiting` memo gains the pending-weeks rows alongside the content-pipeline ones.
