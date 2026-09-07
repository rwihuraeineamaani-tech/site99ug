# Ideas move through a proper production flow

An idea's stage stops being something anyone can drag or type. It only moves when the right person does the one action that belongs to them, and every hand-off lands on that person's dashboard.

## The flow

```text
Idea            founders review
  -> Approved   founders pick the roles the shoot needs, add notes, may preselect people
  -> Crewed     contact person / content lead / strategy head / founders fill every role
  -> Scheduled  contact person or founders set the shoot date
  -> Shooting   shoot day: "Shoot done -> post production"
  -> Editing    lands on the assigned editor
  -> Review     editor uploads the cut (or marks it sent directly); founders approve
  -> Handover   handler gets platforms + suggested captions, posts it
  -> Posted     handler records post links and the time range posted
  -> Archived   10 days later the handler is asked for the numbers
```

Rejected stays available to founders at any point before posting.

## Who each resident belongs to

Each resident record gains two named people, set once in Management: a contact person and a handler. Every idea for that resident follows those two automatically, so nobody re-picks them per item.

## Approving

Founders open an idea at Idea stage and approve it. On approval they choose which roles the shoot needs (for example lead, shooter, second camera, editor, designer, strategist), can already put a name against some of them, and can leave notes for the crew. The item becomes Approved and appears on the contact person's dashboard as "Crew needed".

Once every requested role has a person against it the item becomes Crewed and is ready for the contact person or a founder to set the shoot date.

## Shoot day and after

On the shoot day the contact person or a founder presses "Shoot done - send to post production". The item lands on the dashboard of whoever holds the editing role. When the editor finishes they either upload the file or mark it as sent directly, and it goes to the founders as a to-do. Founder approval passes it to the handler, who sees the platforms to post on and the suggested captions.

When the handler presses "Posted" they are asked for the post links and the time range it was posted in. Ten days later the item shows up on the handler's dashboard again asking for the numbers: views, reach, average watch time, likes, comments, shares, saves, follows gained, link clicks, and a short note on why it performed or not. Everything is kept on the item and readable in the archive.

## Waiting on you

Every dashboard gets a "Waiting on you" list at the top with the items currently sitting on that person, and the menu shows a count. No emails.

## Stage is never edited by hand

The stage select disappears from the edit form and board drag-and-drop is removed. Each stage shows only the action buttons the signed-in person is allowed to press.

## Technical notes

- `residents`: add `contact_user_id uuid`, `handler_user_id uuid` (both reference team members by user id), editable from Management / Site editing.
- `content_items`: extend the stage set to `Idea, Approved, Crewed, Scheduled, Shooting, Editing, Review, Handover, Posted, Archived, Rejected`; add `approved_by`, `approved_at`, `crew_notes`, `shoot_at`, `edit_file_url`, `sent_direct bool`, `editor_done_at`, `founder_approved_at`, `platforms text[]`, `caption_suggestions text`, `posted_links text[]`, `posted_from`, `posted_to`, `posted_at`, `metrics jsonb`, `metrics_due_at date`, `metrics_filled_at`.
- New table `content_crew` (content_id, role text, user_id nullable, note) with grants, RLS and update trigger; an item is Crewed when no row has a null `user_id`.
- Stage transitions enforced in the database by a `BEFORE UPDATE` trigger on `content_items` that checks the from/to pair against the caller's role via the existing `has_any_role` / `can_edit_content` helpers, plus the resident's `contact_user_id` / `handler_user_id` and the crew's editor. RLS keeps the existing read rules; the trigger rejects any other stage change so the UI can never be the only guard.
- `metrics_due_at` set to `posted_at + 10 days` on transition to Posted; the archive prompt is a dashboard query on `metrics_due_at <= current_date and metrics_filled_at is null`.
- `Content.tsx`: remove the stage select and drag-and-drop, add a per-stage action bar in the detail dialog, an approval dialog (role checklist + notes + optional names), a crew dialog, a post dialog (links + time range) and a metrics dialog.
- `Dashboard.tsx`: new "Waiting on you" section built from one query per pending role (crew needed, schedule, shoot day, editing, founder review, handover, metrics due); the count feeds the sidebar badge in `AppShell.tsx`.
- `useMyRoles`: no new roles - contact/handler come from the resident record, not `user_roles`.
