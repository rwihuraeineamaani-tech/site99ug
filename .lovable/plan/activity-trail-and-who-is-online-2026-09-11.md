# Activity trail and who is online

Add a new "Activity trail" area in System administration that shows what people are doing, who is online right now, and how long they have been on, with the internal team and clients/residents kept clearly apart.

## What you will see

**Online now** — two separate boards:
- *Internal team* — each person, their role, what page they are on, and how long they have been on today (plus "on since 10:42").
- *Clients / residents* — the same, showing which client they belong to.
Anyone active in the last 5 minutes counts as online; 5–30 minutes shows as "just stepped away"; after that they drop off the board.

**Activity trail** — a running list of what people did: signed in, opened a page, created or changed something, approved or returned work, recorded a payment, sent a message. Each line shows the person, whether they are team or a client, what happened, where, and when.

Filters: team only / clients only / one person, by area (Finance, Content, Sales, Legal, Strategy, Shoots, Admin), by day range, and a search box. Export the visible list to CSV.

**Summary strip** — team online, clients online, actions today, and the busiest area today.

**Sessions** — per person, today's total time on the system and their last sign-in, so "how long they have been online" is answerable for the day, not just the moment.

## Privacy and honesty

- Clients see nothing of this; the whole area is system-admin only.
- We record page visits and actions inside the system only — never keystrokes, never anything outside Site 99.
- Old trail lines are cleared automatically after 90 days.

## Technical notes

New tables:
- `user_presence` — one row per person: `user_id`, `last_seen_at`, `current_path`, `session_started_at`, `user_agent`. Updated by a heartbeat.
- `activity_log` — `actor_id`, `actor_kind` ('staff' | 'client'), `area`, `action`, `summary`, `path`, `entity_type`, `entity_id`, `detail` jsonb, `created_at`. Indexed on `created_at desc` and `actor_id`.

Both get GRANTs, RLS on, insert-own policies (`auth.uid() = user_id/actor_id`), and read restricted to `is_system_admin(auth.uid())`. No updates or deletes from the client, so the trail cannot be doctored. A `touch_presence(_path text)` security-definer RPC upserts presence and rolls a new session when the last beat is over 30 minutes old.

Client side:
- `src/hooks/useActivityTracker.ts` — heartbeat every 60s (paused when the tab is hidden), fires `touch_presence` and logs one page-view row per route change, debounced.
- `src/lib/activity.ts` — `logActivity({ area, action, summary, ... })` helper plus loaders for the admin screens; area is derived from the route.
- Mounted once in `AppShell` (staff) and the client portal shell, so both sides are covered, with `actor_kind` resolved from roles.
- Meaningful actions get explicit `logActivity` calls at the existing write points: approvals decided, cash requests, payments recorded, invoices issued, contracts changed, content stage moves, sales stage moves, leadership tasks assigned or signed off.
- `src/components/admin/ActivityTrail.tsx` — the new tab UI, plus a `dashboards`-style entry added to the tab list in `src/pages/app/SystemAdmin.tsx`.
- Live updates via a Realtime subscription on `activity_log` and `user_presence`, created and torn down inside `useEffect`.
- Retention handled by a daily pg_cron job deleting `activity_log` rows older than 90 days.

## Verification

Typecheck and preview build, then a signed-in browser pass: the new tab renders, presence shows the current admin as online with a session length, a page move adds a trail line, and the team/client split is correct.
