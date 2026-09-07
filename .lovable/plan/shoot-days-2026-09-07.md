# Shoot days

Right now a crewed idea is scheduled one by one, and a date is typed on the idea itself. This adds a real shoot day: a block of work for one client, with a date, a call time, a location and the gear signed out for it.

## How it will work

1. As soon as an idea is crewed, it drops into that client's open shoot day (undated). If the client has no open shoot day yet, one is created automatically.
2. Management sees the shoot day sitting in "Waiting on you" with no date. They can remove an idea from the day (it goes back to the waiting pile) or add a waiting idea back in.
3. They pick the date, call time and location, and tick the gear from the kit list. If a piece of gear is already booked on another confirmed shoot that same date, it is flagged in red and can't be ticked twice.
4. Confirming the day dates every idea on it — all of them move to Scheduled with the shoot date filled in. Management or founders can confirm.
5. On the day, one button starts the shoot and every idea on it moves to Shooting; the existing flow (editing, review, handover, posting) is untouched.
6. Finished shoot days keep their gear list and item list as a record.

## Kit list

A new Equipment page inside Management & ops: name, category (camera, lens, lighting, audio, grip, other), quantity owned, and an active/retired flag. Founders and management maintain it. Ticking gear on a shoot day books it for that date; the list shows what's free and what's out.

## Who sees what

- Founders, management and content leads: create, edit and confirm shoot days, and manage the kit list.
- Everyone on the crew of an idea: sees the shoot days they're on, read only.
- Clients: nothing changes on their side.

## Technical notes

New tables, all with grants, RLS and updated_at triggers:

- `equipment` — name, category, quantity, active. Write access for founders/management, read for staff.
- `shoot_days` — resident_id, status (`draft` | `confirmed` | `shooting` | `done` | `cancelled`), shoot_date (nullable), call_time, location, notes, confirmed_by/at, created_by.
- `shoot_day_items` — shoot_day_id, content_id (unique on content_id so an idea sits on one day only).
- `shoot_day_equipment` — shoot_day_id, equipment_id, qty, note; a trigger blocks booking a unit already booked on another confirmed day with the same date.

Flow wiring:

- Trigger on `content_items`: on entering `Crewed`, attach to the client's open draft shoot day (create if none). Removing the row from `shoot_day_items` leaves the idea at `Crewed`.
- Confirm action (RPC, security definer, role checked): requires a date and at least one item; sets `content_items.shoot_at` and stage `Scheduled` for every item on the day. Start action moves them all to `Shooting`. Both routed through the existing stage guard so no illegal jumps.
- Existing per-idea "set shoot date" control in Content becomes read-only text pointing at the shoot day.

Frontend:

- `/app/shoots` — list of shoot days grouped by client, undated ones first; detail panel with date, call time, location, item chips (add/remove), gear picker with conflict flags, confirm and start buttons.
- `/app/equipment` — simple kit list table.
- Dashboard "Waiting on you": undated shoot days for management, and today's confirmed shoots for the crew on them.
