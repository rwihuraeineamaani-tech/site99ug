# Residents cleanup, Client Relations department, smoother sidebar

## 1. Residents page — client cards first
- The page opens straight onto **cards of all active clients** (status filter defaults to Active; "All statuses" still available, list view kept).
- Each card gets a **summary**: logo, name, status, handler, contract end date + days left, accounts count, content in motion, next shoot day, and money owed (unpaid invoice balance, only shown to people with Finance access).
- The **accounts panel and the handler/pay panel move off the top**. They go into a second tab on the page, so the page reads: `Clients` (default) | `Accounts & handlers` | `Lifecycle` (founder switch).
- Fix the money/accounts bits so they only read from the current system (contract invoices and client pot balance), not the old cleared records.

## 2. Resident record — expanded with actions
- Turn the long single page into tabs: **Overview · Onboarding · Content · Shoot days · Money · Contracts · Relations · Notes**.
- Add an **actions menu** on the record header:
  - edit details, assign/change handler, open portal invite, open in Sales, export summary PDF
  - **archive client** (hides from active cards, keeps history)
  - **delete client** — Founders/System Admin only, typed-name confirmation, blocked if the client has invoices or signed contracts (archive offered instead) so finance history is never lost.
- New **Relations tab**: contact log (calls, meetings, complaints, feedback), follow-ups with due dates, satisfaction rating, contacts list.

## 3. Client Relations as its own department
- New sidebar section **Client Relations** (separate from Communications), visible to leadership, handlers, contact persons and the communications role:
  - Overview — client health board (at-risk, renewals due in 60 days, overdue follow-ups)
  - Contact log — every interaction across clients
  - Follow-ups — due/overdue, assigned to me
  - Renewals — contracts ending soon, feeds the 5% renewal bonus
  - Feedback — satisfaction scores and complaints
- New position **Client Relations** that System Admin can assign; dashboard gets a Client Relations panel.

## 4. Sidebar — scrolls and switches pages without reopening
- Today every page wraps itself in its own shell, so the sidebar is rebuilt on each click (it flashes, jumps scroll, and closes/reopens).
- Move the shell into one shared layout that stays mounted; only the page area changes. Scroll position and open/collapsed state then stay naturally.
- On mobile, the menu stays open when switching tabs inside the same section; it closes only when the user taps outside or picks the close button.

## Technical details
- New tables (with grants + RLS scoped via `is_staff`/`is_resident_handler`): `client_interactions`, `client_followups`, `client_feedback`. `residents.archived_at` column. RPC `delete_resident` (security definer, founder/admin only, refuses when invoices/signed contracts exist).
- Add `client_relations` to `app_role`; add `departments.relations` in `useMyRoles`.
- Routes: `/app/relations`, `/app/relations/log`, `/app/relations/followups`, `/app/relations/renewals`, `/app/relations/feedback`.
- Refactor: `AppShell` becomes a persistent `<Route element={<AppLayout/>}>` with `<Outlet/>`; pages keep passing eyebrow/title via a small context instead of wrapping themselves (27 pages touched mechanically).
- Verify at desktop and 428px with Playwright; fix any build errors.
