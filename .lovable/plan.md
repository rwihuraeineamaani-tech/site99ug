## Goal
Make `/admin/events` (and `/admin`) feel like a real console, and fix the header overlapping the page title.

## The overlap
The global `Nav` renders a fixed header with a logo at `h-24` (96px) / `md:h-36` (144px) plus `py-5`, so the header occupies roughly 136–184px. Admin pages start their content at `pt-28` (112px), so the logo and Menu button sit on top of the "Admin / Events" title and the action buttons. At the current 876px-wide preview this is exactly what's happening.

Fix: give admin pages a chrome of their own instead of fighting the marketing nav.

## Changes

### 1. Admin shell (new `src/components/admin/AdminShell.tsx`)
- Wraps admin pages without the marketing `Nav`/`Footer` (`Layout` gets bypassed, or a `bare` variant is used).
- Own slim top bar: small Site 99 mark, "Console" label, right side = Export, Scanner link, Sign out.
- Left sidebar on desktop (Dashboard, Event Manager, Buyers, Trashed, Scanner, Site Admin), collapsing to a horizontal scrollable tab strip on mobile.
- Content region uses consistent `px-6 md:px-10 py-8` — no `pt-28` guesswork, so nothing can be covered.

### 2. `EventsAdmin.tsx` upgrade
- Move the existing four tabs into the shell's nav; keep the same state machine.
- Dashboard: restyle the 4 stat cards (label, big number, subtle accent rule), add "Tickets issued" and "Paid orders today".
- Pending TID table: sticky header, zebra rows, status pills (pending / paid / rejected) instead of raw mono text, actions collapsed into a compact row that wraps cleanly on narrow screens.
- Event Manager: keep the current form but group it into collapsible sections (Details, Media, Payments, Policies, Organizer, Ticketing) so the form stops being one long scroll; tier list gets clearer edit/reorder controls.
- Buyers Search & Trashed: shared table component so all three lists look identical.
- Empty and loading states get proper placeholders instead of bare text.

### 3. `Admin.tsx` (site admin)
- Adopt the same shell and card/table styling so both admin screens match.

## Technical notes
- Purely presentational: no schema, RPC, or edge-function changes; all existing handlers (`confirmOrder`, `sendTickets`, `trashOrder`, `exportCsv`, tier CRUD) are reused as-is.
- New files: `src/components/admin/AdminShell.tsx`, `src/components/admin/OrdersTable.tsx`, `src/components/admin/StatCard.tsx`.
- Styling stays on semantic tokens plus the existing `site-red` / `site-black` tokens.
