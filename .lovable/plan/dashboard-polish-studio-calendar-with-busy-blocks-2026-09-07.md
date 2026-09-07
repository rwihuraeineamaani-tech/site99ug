# Dashboard polish + studio calendar with busy blocks

## 1. Header

- Logo enlarged and set beside the name and job title, with a thin divider between the mark and the text.
- The Kampala clock moves out of the greeting and into the top right of the header bar: live time with seconds, day and date under it, plus a small "on air" dot.
- Next to the clock: a compact set of live chips — items waiting on you, shoots today, unread notices — each clickable and each straight to the right screen.
- The greeting block keeps the name, role chips and one-line read on the day, but loses the duplicated clock.

## 2. Overview becomes a board

- The four big count tiles shrink into one slim strip of small figures across the top (waiting on you, on your plate, in the pipeline, your month) — one line, not four cards.
- The space freed goes to a work board: columns for **Waiting on you**, **Today & overdue**, **This week**, and **Your departments**. Every card in the board is clickable and carries its one-press action (Approve, Shoot done, Post it, Add the numbers) directly on the card.
- Under the board, a week schedule view: seven day columns showing shoots, posting dates, numbers due and busy blocks for the signed-in person, with arrows to move week to week. Clicking any entry opens the underlying record.
- Everything stays role-shaped — people only see the columns and entries that belong to them.

## 3. Calendar page (`/app/calendar`)

New item in the sidebar under Overview.

- Month and week views of the whole studio: shoot days, posting dates, deadlines, events, plus busy blocks for both team members and clients/residents.
- Filter by person, by client and by kind of entry.
- "I'm busy" button opens a block form: title, whether it is all-day or a time range, start and end date, and a repeat rule — none, daily, weekly (pick days), or monthly, with an interval ("every 2 weeks") and an end date or occurrence count.
- Each block picks a strictness: **Warn only** (schedulers see a warning) or **Do not schedule me** (hard block).
- Leadership can create blocks for clients as well as themselves; everyone can manage their own.

## 4. Enforcement in scheduling

- When a shoot day is given a date, or crew is added to a dated shoot, the app checks every person and the client against their busy blocks.
- Warn-only clash: a visible warning naming who is busy and why; saving still allowed.
- Hard block: saving is refused with the same explanation. MDs and founders get an override with a required reason, recorded on the shoot day.
- The check runs in the database as well as on screen, so it cannot be bypassed.

## Technical notes

- New tables: `availability_blocks` (owner kind staff/resident, owner id, title, all-day flag, start/end date, start/end time, recurrence rule fields, strictness warn/hard, note, created_by, timestamps) and `schedule_overrides` (shoot day id, blocked person, reason, approver, timestamp). Full GRANTs, RLS: read for staff, write for the owner or leadership; residents' blocks writable by their contact/handler and leadership.
- Recurrence stored as structured columns (freq, interval, byweekday int array, until date, count) — expanded client-side by a new `src/lib/recurrence.ts` and mirrored by a SQL function `availability_conflicts(user_ids uuid[], resident_id uuid, on_date date, from_time time, to_time time)` used by both the UI check and a `shoot_days` guard trigger.
- New `src/pages/app/Calendar.tsx`, `src/components/deck/Board.tsx`, `src/components/deck/WeekStrip.tsx`, `src/components/calendar/*` (month grid, week grid, block dialog). Header clock extracted into `src/components/deck/HeaderClock.tsx` with a 1s tick.
- `Dashboard.tsx` restructured around the board; existing data hooks and quick-step logic reused unchanged.
