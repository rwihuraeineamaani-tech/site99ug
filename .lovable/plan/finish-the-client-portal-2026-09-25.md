# Finish the client portal

Clients and residents stay the same person: every new page reads only from the client's own Residents record.

## What the client gets

1. **Strategy tab** — their latest approved strategy map shown as a read-only diagram (steps, connections, notes), plus their goals and targets. No edit, drag, save or send buttons. If nothing is approved yet: "Your strategy is being prepared."
2. **Calendar tab** — month and agenda views showing only their own work: shoot days (call time, location), content going out, and deadlines tied to them. Nothing from other clients or staff private items. Tapping an item opens its detail in the portal.
3. **Posting dates** — every content piece shows its scheduled posting date and time (Kampala time), both in "Your work" (sorted by next to go out, with "Posts in 3 days" style labels) and on the calendar. Items without a date show "Date to confirm".
4. **Staff side** — the content editor gets a clear "Scheduled to post" date and time field so the team sets what the client sees.

## Finishing touches
- Add Strategy and Calendar to the portal tabs and menu.
- Check all portal pages build cleanly, then sign in as a test client and walk every tab to confirm they only see their own data.

## Technical details
- New `PortalStrategy.tsx` rendering `strategy_maps` (status approved) with the existing map canvas in a `readOnly` mode (no handlers, `nodesDraggable=false`).
- New `PortalCalendar.tsx` built from `shoot_days`, `content_items` and `leadership_tasks` filtered by `resident_id = clientId`.
- Posting date: reuse `content_items.planned_at` if it holds date+time; otherwise add `scheduled_post_at timestamptz` via migration. Label in the Content editor as "Scheduled to post".
- RLS: add read-only portal policies (via `my_resident_id(auth.uid())`) for `strategy_maps`, `strategy_map_versions` and `content_items` where missing; no write policies for clients.
- Routes `/portal/strategy` and `/portal/calendar` under `RequireRole gate="client"`; AppShell client menu and PortalPage tabs updated.
