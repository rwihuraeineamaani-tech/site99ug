# Residents: cards, logos, brand guidelines, contracts in Legal only

## What changes

### 1. Cards by default, list as an option
The residents page shows a grid of client cards: logo (or initials), name, territory, status, "yours" mark, number of accounts, number of content pieces, and whether a contract is active. A small Cards / List switch sits next to the search box; the choice is remembered per person so it opens the way they left it. The existing list stays exactly as it is behind the List option.

### 2. Client logo, added by admins
Each client gets a logo. Only system admins see the upload control, on the client's own record. Uploading replaces the previous file. The logo then shows on the client card, at the top of the client record, and on the brand guidelines sheet.

### 3. Contracts live in Legal only
The "Add a contract" form and the archive / make-active buttons are removed from the client record. That section becomes a read-only summary of what Legal holds — title, status, dates, value — with a link through to Legal → Contracts, where the contract is created and managed. Legal already shows resident contracts, so nothing is lost and there is one place to work. Nothing existing is deleted.

### 4. Brand guidelines per client
A new Brand guidelines section on the client record holding:
- Primary and secondary fonts, and how each is used
- Brand colours (name plus hex, add as many as needed)
- Tone of voice
- Do's and don'ts
- Logo files (multiple uploads: full logo, mark, light and dark versions)
- One guidelines PDF upload
- Free notes

Any staff member can read them. The client's contact person, their handler, leadership and admins can edit. There is also a clean print / PDF view of the sheet so it can be handed to a shooter or editor before a job.

## Technical notes

- `residents.avatar_url` already exists and is returned by `resident_records()`; the logo reuses it, stored in a new private `client-logos` bucket with a signed URL for display. A `set_resident_logo` function restricted to admins does the write, since `residents` updates are otherwise leadership-gated.
- New table `brand_guidelines` (one row per resident): fonts, colours as JSONB, tone, do's, don'ts, notes, `pdf_path`, plus `created_by` / timestamps. Grants to `authenticated` and `service_role`, RLS on: read for any staff, write for leadership, admins, and the resident's contact or handler (existing `is_staff`, `is_leadership`, `is_resident_contact`, `is_resident_handler` helpers).
- New table `brand_assets` for the logo files (resident_id, label, file_path, sort) with the same access rules.
- New private buckets `client-logos` and `brand-files` with `storage.objects` policies mirroring those rules.
- View toggle stored in `localStorage` under `site99:residents-view`.
- Files touched: `src/pages/app/Residents.tsx` (card grid + toggle), `src/pages/app/ResidentRecord.tsx` (logo header, read-only contracts, brand section), a new `src/components/residents/BrandGuidelines.tsx`, and print styles in `src/index.css`.
