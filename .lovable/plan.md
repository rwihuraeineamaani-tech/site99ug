## Goal
Bring the Resident Portal up to the same visual quality as the public site — editorial typography, atmospheric backdrop, mono labels, site-red accents — without changing any logic or data flow.

## Scope (visual only)

**1. Portal shell**
- Replace the plain `pt-28` page with a hero band: small "Resident Portal" eyebrow in site-red, large display name, status/territory/since as a single typographic line with `·` separators.
- Add a subtle northern-lights backdrop (toned-down version of the home hero — slow, low-opacity) behind the header band only, so it feels like the same world but doesn't distract from content.
- Sticky top-right sign-out as an inline ghost link.

**2. Side rail navigation**
- Convert the current tab buttons into a numbered editorial rail: `01 Overview / 02 Projects / 03 Briefs / 04 Announcements / 05 Profile`.
- Active tab: site-red number + foreground label + a thin red rule on the left.
- On mobile, collapse to a horizontal scroll strip with the same numbering.

**3. Overview**
- Replace the 4-card stat grid with a single "dispatch" panel:
  - Greeting headline ("Welcome back, {first name}.")
  - Two-column meta: Status / Since on one side, Briefs count / Announcements count on the other — all set in display + mono labels, no boxes.
- Add a "Latest announcement" preview card underneath (title + 2-line excerpt + date), tappable to jump to the Announcements tab.

**4. Projects**
- Keep the grid but unify with the public Residents page: full-bleed cover, title overline, year as mono caption. Hover: grayscale → color (already there) + a thin red underline on the title.

**5. Briefs & Announcements**
- Drop the rounded boxed cards. Use a horizontal-rule list: date in mono on the left gutter, title display, body muted, "Open file →" in site-red. Feels like a press archive.

**6. Profile + Messages**
- Profile: 4-up label/value grid, no border box, just a top + bottom rule.
- Messages: keep bubble layout but theme the resident bubble in site-red and office bubble as a subtle outlined card; round corners reduced to match the rest of the site (rounded-md not rounded-2xl). Composer becomes a single bottom bar with the send button as a red pill, mirroring the home hero's CTA.

**7. "Access pending" empty state**
- Already on-brand; just add the same northern-lights backdrop and a "Check again" button next to Sign out.

## Out of scope
- No data model changes, no new tables, no new hooks.
- No changes to Admin, Nav, or public site.
- No new dependencies.

## Files touched
- `src/pages/ResidentPortal.tsx` — all of the above.
- Possibly a small `src/components/PortalAurora.tsx` for the toned-down backdrop (extracted from the Index hero so we don't duplicate the animation).

## Verification
- Load `/residents/portal` signed in as a resident; check Overview, Projects, Briefs, Announcements, Profile.
- Check at 928×528 (current viewport), mobile (375), and desktop (1440).
- Confirm no console errors and existing actions (send message, open project, open brief file, sign out) still work.
