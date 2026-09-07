# Lock idea details after approval, projects on shoot days, one date

Three changes to how ideas and shoot days behave.

## 1. Details freeze once an idea is approved

Once an idea leaves the Idea stage (approved), these four stop being editable for everyone:

- Title
- Resident or project
- Type
- Reference link

They still show in the idea window, greyed out with a small note saying they were locked at approval. Notes and the rest of the production steps stay editable as they are today. While an idea is still at Idea stage, everything can be corrected as before. The lock is enforced in the database too, so it can't be worked around.

## 2. Shoot days can be for a project, not just a client

The "new shoot day" picker on the Shoot days page will list residents and projects together, the same way the "Belongs to" picker in Content already does. A crewed idea that belongs to a project now automatically lands on that project's open shoot day (today it is skipped because it has no client). Each shoot day header shows the project name with a "project" tag so it reads clearly next to client days.

## 3. The planned date is the shoot day date

The separate "Planned date" field disappears from the idea window. Confirming a shoot day now fills both the shoot date and the planned date for every idea on it, so there is one date and it always comes from the shoot day. Existing ideas keep whatever date they already have; where a shoot day exists, the shoot day wins.

## Technical notes

Database:

- Trigger on `content_items`: when `OLD.stage <> 'Idea'`, force `title`, `resident_id`, `project_id`, `content_type`, `link` back to their old values (same shape as the existing `content_items_lock_provenance` trigger, extended or added alongside it).
- `shoot_days`: `resident_id` becomes nullable, add `project_id uuid references projects(id)`, plus a check that exactly one of the two is set. Adjust the RLS/`can_touch` paths and the draft-day lookup accordingly.
- `content_attach_shoot_day()`: branch on `resident_id` or `project_id`; find or create the draft day for whichever owner the idea has.
- `confirm_shoot_day()`: also set `planned_at = d` alongside `shoot_at`.

Frontend:

- `Content.tsx`: derive `locked = editing.stage !== 'Idea'`; disable the title, owner, type and link inputs and drop them from the update payload when locked. Remove the `planned_at` input and the `planned_at` key from the save payload; list/board keep showing `shoot_at ?? planned_at`.
- `Shoots.tsx`: reuse the `r:<id>` / `p:<id>` encoding for the new-day select, load `projects`, and extend `residentName()` into an owner label covering both; `spareFor()` matches on the day's owner.
