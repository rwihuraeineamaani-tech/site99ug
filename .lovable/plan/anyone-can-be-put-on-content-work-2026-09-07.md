# Anyone can be put on content work

Today only Founder, Managing Director, Creative Director and Creative accounts can touch the content pipeline or shoot days. Finance, Sales, Legal and other team accounts can look but not act, and they can't be picked as crew. This opens it up by assignment.

## What changes

- **Everyone on the team can see Content and Shoot days.** The section appears in the sidebar for every staff account.
- **Being put on a job gives you the rights for that job.** If a finance person is added as crew on an idea — shooter, editor, whatever the role — they can act on that idea and on the shoot day it belongs to, exactly like a creative would: mark the shoot done, add the cut, add remarks, upload the file.
- **They still can't act on jobs they're not on.** Creating new ideas, approving, and moving other people's work stays with the content roles and leadership.
- **The crew picker lists the whole team**, with the usual production people grouped at the top and everyone else below, so a finance or legal person can be selected without hunting.
- **Their assigned jobs show on their dashboard** under "Waiting on you", same as for anyone else.

## Technical notes

- New helper `public.is_content_crew(_user_id uuid, _content_id uuid)` — true when the user appears in `content_crew` for that item, or is the item's resident contact/handler.
- New helper `public.is_shoot_crew(_user_id uuid, _day_id uuid)` — true when the user is crew on any idea attached to that shoot day.
- `content_items` UPDATE policy becomes `can_edit_content(auth.uid()) OR is_content_crew(auth.uid(), id)`. INSERT and DELETE stay on `can_edit_content`.
- `can_view_content` widens to `is_staff(auth.uid())` so every staff account reads the pipeline; `can_edit_content` is left alone as the "full rights" check.
- `content_stage_guard()` keeps its per-stage actor rules but accepts a crew member as a valid actor for the crew-facing transitions (shoot done, editing, handover file). Approval and stage jumps still require leadership/content roles.
- `shoot_days`, `shoot_day_items`, `shoot_day_equipment` UPDATE policies gain `OR is_shoot_crew(...)`; `start_shoot_day`/`finish_shoot_day` accept crew, `confirm_shoot_day` stays leadership-only.
- `content_crew` INSERT/UPDATE/DELETE remain `can_edit_content` — only the content leads decide who's on a job.
- Frontend: `src/pages/app/Content.tsx` and `src/pages/app/Shoots.tsx` compute an `iAmCrew` flag per item and use it alongside the existing role checks when deciding which action buttons to show; the crew `<select>` groups team members into "Production" and "Everyone else" via `<optgroup>`. Sidebar entry in `src/components/system/AppShell.tsx` moves from a content-role check to a staff check.
