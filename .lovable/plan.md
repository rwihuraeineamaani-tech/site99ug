# Add ideas to confirmed shoot days, and log ideas you came up with on the day

## 1. Add ideas after the date is confirmed
Right now you can only add or remove ideas while a shoot day still says "Needs a date". This change keeps that option open once the day is **Confirmed** or **Shooting**:
- The "Add a waiting idea" list stays visible on confirmed and in-progress shoot days.
- An idea added to a confirmed day moves straight to **Scheduled** and gets the shoot date. An idea added to a day that is already shooting moves to **Shooting**.
- You can take an idea off a confirmed day before shooting starts. It goes back to Crewed and waits for another day.
- Ideas that haven't been crewed yet can be added too. You'll be asked to confirm, and the idea counts as approved and crewed by the people already on the day.

## 2. "Shot on the day" ideas
On a shoot day that is shooting or done, a new **Add an idea we shot today** button opens a short form: title, type, notes and an optional link to the footage, with an optional editor.
- The idea gets its normal IDEA-number and shows who added it.
- It's attached to that shoot day for that client or project, marked as shot, and goes straight to **Editing**. From there it follows the normal flow: review, handover, posting and numbers.
- It carries an "Added on the shoot day" tag so founders can see it skipped the approval step.
- The Content pipeline gets the same option ("Add a shot idea"). You pick the shoot day it came from.

## Who can do it
The content team, founders and the crew on that shoot day. This matches who can already run the shoot day.

## Technical notes
- Shoots.tsx / ShootDay.tsx: allow addItem/remove when status is in draft, confirmed or shooting (remove is blocked once an item is shot). Add a "shot on the day" dialog.
- New SECURITY DEFINER RPCs `add_to_shoot_day(day_id, content_id)` and `add_spontaneous_idea(day_id, title, type, notes, link, editor)`. They check the caller (content team, founder or day crew), set the stage and shoot_at directly with a session flag the `content_stage_guard` accepts for these jumps, insert the `shoot_day_items` row marked shot, and set `content_items.spontaneous = true`.
- Migration: add the column `content_items.spontaneous boolean default false`. Remove path: an RPC that resets a Scheduled item to Crewed.
