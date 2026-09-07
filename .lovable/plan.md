# Shoot days: brief, wrap-up and where the content went

## What changes

1. **Wrapped days are visible.** The shoot day list gets Planned / Wrapped / All filter chips. Wrapped days show the date they happened and stay openable. Today the list also loses track of a wrapped day's ideas, because it only loads ideas still at the shooting stages — it will load every idea attached to a day instead.

2. **A readable shoot day brief.** Opening a day shows a clean brief panel: client or project, date, call time, location, notes, the ideas to shoot (reference number, title, type), the crew per idea with their role, and the gear booked. It reads as a briefing sheet, not a form — the editing fields stay below it for the people allowed to edit.

3. **Send the brief to the crew.** A "Send the brief" button on a day that has a date emails everyone who is crewed on that day's ideas, plus the client's contact person. Sending is recorded so the day shows "Brief sent — Sat 6 Sep, 14:20" and re-sending is possible after changes.

4. **Tap a wrapped day to see where its content is.** Each idea on the day lists its current stage (Editing, Waiting on approval, Posted, Archived…), who it's waiting on, and a link that opens it in Content. Posted items show the post links.

## Note on email

Emails cannot go out yet: the sending domain for site99ug.com never finished DNS verification. Everything else works regardless — the brief opens in the portal and can be copied. Once the domain records are corrected and verified, the send button starts delivering with no further work.

## Technical notes

- Migration: `shoot_days` gains `brief_sent_at timestamptz`, `brief_sent_by uuid`.
- `Shoots.tsx`: drop the `.in("stage", [...])` filter on `content_items`; load `content_crew` for the day's ideas and `team_members` for names/emails; add status filter state; add a `ShootBrief` render block; wrapped days render a "Where it is now" row per idea linking to `/app/content?ref=<ref_no>`.
- Email: an app-email template `shoot-day-brief` in `_shared/transactional-email-templates/` (client/project, date, call time, location, ideas, crew, gear), registered and sent one recipient at a time via `send-transactional-email` with idempotency key `shoot-brief-<day_id>-<sent_at>`. Requires `setup_email_infra` + `scaffold_transactional_email` if not already scaffolded.
- Stage labels reuse `src/lib/contentFlow.ts` so the wording matches Content.
