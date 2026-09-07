# Adding an idea to Content & strategy

Make adding an item quick: a title, an optional client, a type, notes and a reference link. Everything else the system fills in itself.

## The add form

Asked for:
- Title
- Client — chosen from the client records already in Management, plus "No client yet"
- Type — Vertical short-form video, Long-form video, Carousel, Poster, Photo set, Campaign, Strategy
- Notes
- Reference link

Filled in automatically, not asked and not editable:
- Reference code — a running number, IDEA-0001, IDEA-0002, and so on
- Stage — always Idea for a new item
- Added on — today's date
- Added by — the person signed in

## Who added it

Every item shows its code and the name of the person who added it, on the card, in the list and in the detail view. Nobody can change either one, so the record stays honest for tracking who contributes ideas. A "Person" filter can be pointed at the person who added an item as well as the people working on it.

Existing items that predate this get codes assigned in order of when they were created; ones with no known author show "—".

## Idea archive

A third view alongside Board and List: every item with no client yet. Each row has an "Assign client" action that attaches a client without opening the full editor. Once a client is set, the item leaves the archive and shows up in the normal board and list.

## Editing later

The full editor keeps everything it has now — stage, lead, shooter, editor, planned date, link, notes — plus a read-only line at the top showing the code, who added it and when. Planned date stays a separate, optional field for scheduling; it is not prefilled.

## Technical notes

- Migration on `content_items`: add `ref_no` (bigint, generated from a sequence, unique, not null) and a display code derived as `IDEA-` + zero-padded `ref_no`; add `added_by uuid` defaulting to `auth.uid()` and backfill from `created_by`; add `added_on date not null default current_date`. Backfill `ref_no` for existing rows ordered by `created_at`.
- Block edits to `ref_no`, `added_by` and `added_on` with a `BEFORE UPDATE` trigger that restores the old values, so immutability holds at the data level, not just in the form.
- Author names: read from `team_members` (user_id → display_name/email) and join client-side into a `Map<uuid, name>`; residents/clients fall back to the email local part.
- `Content.tsx`: split the current single dialog into a lean "New idea" dialog (title, client, type, notes, link) and the existing full edit dialog with an added read-only meta strip. Add `"archive"` to the `Segmented` view union with its own table and an inline client select per row.
- Update `TYPES` to the new list and keep old values rendering correctly for existing rows.
