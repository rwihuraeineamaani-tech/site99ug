
# Archive: Admin Panel + Lightbox Case Studies

Turn the Archive into a CMS-driven gallery you control from a private admin dashboard. No code edits needed to add work — just log in and upload.

## What you'll be able to do

- Log in at `/admin` with your email + password (only you).
- Add, edit, reorder, and delete projects from a dashboard.
- Upload a cover image + multiple gallery images per project.
- Click any project on the public Archive to open a lightbox with the full case study (description, gallery, external link).
- Existing 6 placeholder projects stay until you replace them.

## What I need from you (per project, when adding)

Required:
1. Cover image (JPG/PNG, ideally portrait ~1200×1500)
2. Title
3. Client name
4. Year
5. Tag (e.g. "Identity / Film")

Optional:
6. Short description (1–3 sentences)
7. Extra gallery images
8. External link (live site, video, IG)
9. Display order (otherwise newest first)

You'll upload everything through the dashboard — no need to send it to me.

## Public experience

- Archive page keeps its current horizontal-scroll layout and red hover treatment.
- Clicking a card opens a full-screen lightbox: large cover, title/client/year/tag, description, gallery thumbnails, and an external link button if provided.
- Closes on `Esc`, click outside, or close button.

## Technical section

**Backend (Lovable Cloud — needs to be enabled)**

- `projects` table: `id`, `title`, `client`, `year`, `tag`, `description`, `cover_url`, `gallery_urls[]`, `external_url`, `display_order`, `created_at`.
- Storage bucket `project-images` (public read).
- RLS: public can `SELECT`; only authenticated admins can `INSERT/UPDATE/DELETE`.
- `user_roles` table + `has_role()` security-definer function for admin gating (per security best practice).
- Auth: email/password only. You sign up once, then I'll grant you the `admin` role via SQL.

**Frontend**

- `src/lib/supabase.ts` — client.
- `src/hooks/useProjects.ts` — fetch projects via React Query.
- `src/pages/Archive.tsx` — replace hardcoded array with fetched data; add lightbox state.
- `src/components/ProjectLightbox.tsx` — modal with cover, copy, gallery, link.
- `src/pages/Admin.tsx` — login gate + dashboard (list, add, edit, delete, reorder, image upload).
- `src/pages/AdminLogin.tsx` — sign in form.
- Route guard: non-admins on `/admin` get redirected.

**Migration**: seed the table with the current 6 placeholder projects so nothing visually breaks on first load.

## Order of work

1. Enable Lovable Cloud.
2. Create schema, storage bucket, RLS, roles.
3. Build admin login + dashboard.
4. Wire Archive to live data + add lightbox.
5. You sign up → I grant admin role → you start uploading.
