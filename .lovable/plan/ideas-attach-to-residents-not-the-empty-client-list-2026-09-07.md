# Ideas attach to residents, not the empty client list

The people the work is for are the residents. The "client" picker in Content & strategy currently reads from a separate client list that has no records in it, while there are 12 residents and 5 projects already in the system. Swap it over.

## What changes

- The picker on a new idea, on the edit form and in the idea archive lists **residents** and **projects**, in two groups, plus "No one yet — idea archive".
- The board cards, the list and the filters show the resident's name (or the project title) instead of a client name.
- Nothing is lost in the move: there are no content items yet, so there is nothing to migrate.
- The separate invited-client accounts stay exactly as they are for the client portal; they simply stop appearing in the content picker.

## Access

Only names are needed for the picker, so the portal reads a name-and-territory-only list of residents — resident email addresses stay locked down as they are now. Anyone in Content & strategy can pick a resident; nothing else about residents becomes visible.

## Technical notes

- Migration: add `resident_id uuid references public.residents(id) on delete set null` to `content_items`, with an index. `client_id` stays on the table (unused by the pipeline, still referenced by the client-portal policy) — no data to backfill since `content_items` is empty.
- RLS policy on `content_items` gains resident scoping later if residents are ever given portal access; for now the existing content-team and client policies are unchanged.
- Add `public.resident_options()` — `SECURITY DEFINER`, `STABLE`, returning `(id uuid, name text, territory text)` from `public.residents` where `visible` or not, ordered by `display_order`; `EXECUTE` granted to `authenticated` only, gated on `public.is_staff(auth.uid())`. This avoids widening `SELECT` on the residents table itself (which carries emails).
- `Content.tsx`: `ClientRow` → `ResidentRow`, load via `supabase.rpc("resident_options")`, owner encoding becomes `r:<id>` for residents and `p:<id>` for projects, `ownerLabel` and the "Belongs to" filter follow. Labels in the UI change from "Client" to "Resident".
