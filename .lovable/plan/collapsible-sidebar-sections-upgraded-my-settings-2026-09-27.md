# Collapsible sidebar sections + upgraded My Settings

## 1. Collapsible sidebar sections

The staff sidebar has grown long (Overview, Departments, System administration, Legal, Talent & Campaigns, Client Relations, Strategy, Management, Finance, Winding down). Make each section a collapsible group in `src/components/system/AppShell.tsx`:

- Each section heading becomes a tap/click target with a chevron that expands or collapses its items (shadcn `Collapsible` inside `SidebarGroup`).
- **Auto-open rule:** the section containing the current page is always open; **Overview** starts open. All other sections start closed.
- The user's open/closed choices are remembered per browser (sessionStorage, same pattern as the existing sidebar scroll memory) so navigating doesn't re-collapse what they opened.
- Collapsed (icon-only) sidebar mode is unchanged — sections don't collapse there.
- Scroll memory, badges, active highlighting and mobile behaviour stay as they are.

## 2. Upgrade My Settings (`src/pages/app/Settings.tsx`)

Rebuild the page into a cleaner, more complete settings centre, keeping everything that works today:

- **New layout:** left-side vertical tab list on desktop (Profile, Appearance, Notifications, Account, Security), keeping the horizontal pills on mobile. A header card with avatar initials, name, title and email.
- **Profile:** name and job title (as now), plus phone number and a short bio stored on `team_members` (new nullable columns `phone`, `bio`), shown on the person's profile.
- **Appearance:** dark / light / system cards (as now), plus a sidebar-density choice (Comfortable / Compact) stored on `team_members` and applied in the shell.
- **Notifications:** unchanged push controls and per-category switches, restyled into the new layout.
- **Account:** email, roles, departments, team-since date (as now), plus quick links to My KPI and To-Do.
- **Security:** change password, change email, payment PIN (as now), plus an **active sessions** note and a "Sign out of all other devices" button (`supabase.auth.signOut({ scope: "others" })`).
- All saves keep the existing toast feedback and error handling.

## Technical details

- Migration: `ALTER TABLE team_members ADD COLUMN phone text, ADD COLUMN bio text, ADD COLUMN nav_density text` (no new table, no RLS change — existing team_members policies already let a user update their own row; verify before relying on it).
- Sidebar collapse state key: `site99:sidebar-groups` in sessionStorage.
- No changes to routes, roles, or navigation items themselves.
- Verify with typecheck plus a Playwright pass at desktop and 428px: collapse/expand a section, reload to confirm memory, and save each settings tab.
