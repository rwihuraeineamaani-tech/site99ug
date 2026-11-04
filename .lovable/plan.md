# Homepage logo manager in System Admin

## What you get
- A new **Website logos** tab in System Admin.
- Upload a logo, give it a name (and an optional website link), and it appears in the homepage logo scroll.
- Remove a logo, hide it for now without deleting, and drag or arrow to set the order.
- Logos here are standalone. They are not tied to any client record, so you can show brands, partners or past clients freely.
- Only System Admin can add, hide, reorder or remove. Website visitors just see the visible logos.

## What changes on the homepage
- The scroll reads only from this new list instead of client records.
- The six logos showing today are copied into the list once, so the strip looks the same on day one. After that, changes to client logos no longer affect the scroll.
- If the list is empty, the strip is hidden.

## Technical details
- New table `site_logos` (id, name, image_path, link_url, sort_order, visible, created_at). Grants: anon/authenticated SELECT, service_role ALL. RLS: public read where visible; write only via `has_role(auth.uid(),'admin')`.
- New public storage bucket `site-logos`; storage policies allow public read and admin-only insert/delete.
- One-time copy of current resident logos (visible website clients) into `site_logos`.
- `src/pages/app/SystemAdmin.tsx`: add `logos` tab with a `SiteLogosManager` component (upload, rename, link, visible toggle, up/down order, delete with confirmation).
- `src/pages/Index.tsx`: build `marqueeItems` from `site_logos` (visible, ordered) via public URLs; `Marquee` unchanged.
- Record in AGENTS.md: homepage logo strip is sourced from `site_logos`, independent of residents.
