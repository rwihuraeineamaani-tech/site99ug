## 1. Resident access — invite by email

**Database**
- Add `email` (text, unique) and `invited_at` columns to `residents`.
- Add a new `app_role` value `'resident'` (enum extension) so we can grant portal access without admin powers.
- Add a SQL function `accept_resident_invite()` that, on a signed‑in user, looks up `residents.email = auth.email()` and inserts a `('resident')` row into `user_roles` for that user. Runs `SECURITY DEFINER`.
- RLS update on `residents`: residents can `SELECT` their own row (`email = auth.email()`); admins keep full control.

**Flow**
1. Admin opens **Admin → Residents → New** and fills in name, territory, since, status, **email**.
2. Person goes to `/residents/login`, signs up (or signs in) with that exact email.
3. On first load of `/residents/portal`, the app calls `accept_resident_invite()`. If their email matches an invited resident, they receive the `resident` role and enter the portal. Otherwise they see a "Not invited yet — contact office@site99ug.com" screen with a Sign‑out button.
4. Admin can revoke by deleting the resident row + their `user_roles` row (button in admin).

(No email is auto-sent in v1 — admin shares the link manually. We can wire branded invite emails later.)

## 2. Resident portal v1 — real content

New tabs in `/residents/portal` (sticky side rail on desktop, top tabs on mobile):

- **Overview** — greeting, status chip, "since" date, quick stats (projects, unread announcements).
- **Projects** — grid of projects assigned to this resident, opens the existing `ProjectLightbox`.
- **Briefs & Deliverables** — list of files/links the admin posted for them; download buttons.
- **Announcements** — site‑wide feed from admin (newest first, unread dot).
- **Profile + Messages** — editable name/territory/avatar, plus a simple thread to admin (one conversation per resident).

**New tables**
- `resident_projects(resident_id, project_id)` — many‑to‑many link; admin assigns via a multi‑select on each project.
- `briefs(id, resident_id, title, body, file_url, created_at)` — admin CRUD; resident read‑only on their own.
- `announcements(id, title, body, created_at, published)` — admin CRUD; all residents can read published ones.
- `messages(id, resident_id, sender_role, body, created_at, read_at)` — resident ↔ admin thread.
- Storage bucket `resident-files` (private) for briefs/avatars; signed URLs on read.

**Admin console additions**
- Project editor: add a "Assign to residents" multi‑select.
- New tabs: **Briefs**, **Announcements**, **Messages** (inbox grouped by resident).
- Residents tab now has an "Open as resident" preview link and a "Revoke access" action.

## 3. Menu overlay scroll fix (laptop bug)

Symptoms on ~900×500 viewports: the 5 menu items are taller than the screen, so the last one ("Access") is cut off and the overlay can't scroll because body scroll is locked and the overlay itself isn't scrollable.

Fix in `src/components/Nav.tsx`:
- Make the inner container scrollable: `overflow-y-auto overscroll-contain` and switch from `justify-between` with `h-full` to a normal flow with `min-h-full` so content can grow past the viewport.
- Tighten short‑viewport sizing: cap menu link size with a custom clamp (e.g. `clamp(2rem, 7vh, 6rem)`) and reduce vertical gap on `lg:h-[<700px]` heights.
- Keep body scroll locked (already correct), but allow scroll inside the overlay.
- Verify at 889×528 (current preview) and at 1366×768.

## Technical details

```text
DB migration
  ALTER TYPE app_role ADD VALUE 'resident';
  ALTER TABLE residents
    ADD COLUMN email text UNIQUE,
    ADD COLUMN invited_at timestamptz DEFAULT now();

  CREATE FUNCTION accept_resident_invite() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE uid uuid := auth.uid();
            mail text := (auth.jwt() ->> 'email');
    BEGIN
      IF EXISTS (SELECT 1 FROM residents WHERE email = mail) THEN
        INSERT INTO user_roles(user_id, role)
        VALUES (uid, 'resident')
        ON CONFLICT DO NOTHING;
        RETURN true;
      END IF;
      RETURN false;
    END $$;

  -- New tables: resident_projects, briefs, announcements, messages
  -- RLS: residents read own rows via has_role + email match; admins full access.
  -- Storage bucket: resident-files (private).

Frontend
  - src/hooks/useResidentMe.ts          (current resident row + role check)
  - src/hooks/useBriefs.ts, useAnnouncements.ts, useMessages.ts
  - src/pages/ResidentPortal.tsx        (tabs, calls accept_resident_invite() on mount)
  - src/pages/Admin.tsx                 (+ Briefs, Announcements, Messages tabs;
                                         project ↔ resident assignment UI;
                                         add email field to resident form)
  - src/components/Nav.tsx              (overlay scroll + responsive sizing)

No business-logic changes outside the above; existing Archive/Index keep working.
```

## Out of scope (can come later)
- Auto-sent invite emails with branded template.
- Real-time chat (we'll poll messages in v1).
- Resident-uploaded files.
