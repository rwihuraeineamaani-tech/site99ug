# Leadership dashboard and role dashboards you can configure

## 1. Leadership view on the dashboard
A leadership panel set for anyone who can assign work (Founder, MD, Creative Director, Sales Head, System Admin):

- **Work I assigned** — every task they gave out, with the person, deadline, and where it stands (not started, in progress, sent back, waiting sign-off, done).
- **Deadlines** — late, due today, due this week, each opening the task.
- **Progress at a glance** — small bars: how much of the work they assigned is done, in progress, or late.
- **Waiting for my sign-off** — tasks staff have submitted with their written update or file, with Accept and Send back right there.
- **Team load** — one line per person: how many open tasks they hold and how many are late.

Everything links to the same task pages under To-Do, and dated tasks keep showing on the calendar as they do now.

## 2. Dashboards for the other roles
Each role gets a sensible default set of panels, built from the pieces the dashboard already has plus a few new ones:

- **Creative / content** — my content, shoots I am crewed on, this week, my numbers.
- **Finance** — money waiting on approval, payments due, invoices unpaid, month figures.
- **Sales** — my opportunities, follow-ups due, offers waiting for approval, targets.
- **Strategy** — client goals, monthly targets, maps waiting for approval.
- **Legal** — contracts expiring, documents waiting, compliance items.
- **Operations** — shoots ahead, equipment out, client funds.
- **Everyone** — greeting, To-Do count, today and late, this week, calendar week strip.

Panels only ever show what the person is already allowed to see — configuring a dashboard never widens access.

## 3. Dashboard builder in System administration
A new **Dashboards** tab in the Control centre, for the system admin only:

- Pick a role (or a specific person) on the left.
- Tick the panels that role should see and drag them into the order they appear.
- Choose the layout width for each panel (full width or column).
- A live preview shows how it will look.
- Save, and everyone in that role sees it next time they open the dashboard. A person-specific layout beats their role layout; a role with nothing set falls back to the built-in default.
- A "Reset to default" button on every role.

## Technical notes
- New table `dashboard_layouts`: `scope` ('role' | 'user'), `role` (app_role, nullable), `user_id` (nullable), `panels` jsonb (ordered list of `{ key, width }`), timestamps, unique per role and per user. Grants: read for `authenticated`, full for `service_role`; RLS — any signed-in staff can read, only `is_system_admin()` can write.
- New table for nothing else; leadership data comes from the existing `leadership_tasks`, `leadership_task_assignees`, `leadership_task_evidence` and `leadership_task_activity`.
- `src/lib/dashboardPanels.ts`: a registry mapping panel key → title, component, required roles, default width; plus `DEFAULT_LAYOUTS` per role.
- `src/components/dashboard/panels/*`: extract the existing dashboard sections (today, this week, KPI, week grid, retainer share, To-Do summary) into panel components, and add the new leadership panels (`assigned_work`, `signoffs`, `team_load`, `deadlines`) and the role panels listed above.
- `src/pages/app/Dashboard.tsx`: keep the greeting and figure strip, then resolve the layout (user → role → default) and render panels from the registry, filtering out any the person's roles do not allow.
- `src/pages/app/SystemAdmin.tsx`: add the `dashboards` tab with role/person picker, panel checklist with drag ordering, width control, preview and save.
- Sign-off actions reuse the existing `decide_leadership_task` RPC; no new server logic.
- Verify with a typecheck, the preview build, and signed-in checks of the leadership dashboard and the builder saving a layout.

## Still queued
The Finance PIN lock (every Finance action locked until the PIN is typed, with a "Set up your PIN" button for anyone without one) comes right after this.
