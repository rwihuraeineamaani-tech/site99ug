# Strategy gets its own home

Strategy currently lives on one page per client. This turns it into a full section in the sidebar with four tabs, run by the strategy team and signed off by founders, with every client's plan wired in.

## The section

New "Strategy" group in the sidebar with four pages:

1. **Overview** — every client on one board: who owns the plan, whether the plan is approved, how goals are tracking, what is off track, what is sitting in approval, and when the plan was last touched. Click a client to open their plan.
2. **Map builder** — a full-width strategy/workflow map editor. Pick a client, build the map, save a version, submit it for approval. Starter templates (retainer client, launch campaign, always-on content) and a version history you can open, compare by date, restore, or print.
3. **Goals & targets** — one board across all clients: goals with live progress and health, and the monthly numbers we commit to per client and metric. Filter by client, owner, month and status. Create, edit, submit for approval.
4. **Approvals** — the founder queue. Everything waiting: maps, goals, targets, and whole client plans. Approve, or send back with a note. Shows who submitted it and when. Non-founders see the same list read-only so they know where things stand.

The existing per-client Strategy page stays and links both ways with the section.

## Who can do what

- **Strategy team** — a new **Strategist** role, plus creative director and sales head, plus founders/MD/admin. They create and edit goals, targets and maps, and submit them for approval.
- **Founders** (and MD/admin) — approve or send back. Approval is required on strategy maps, client goals, monthly targets, and the client plan as a whole.
- **Everyone else on staff** — can read Strategy but not change it.

## How approval works

Everything strategic carries a state: **draft → submitted → approved** (or **changes requested**, which drops back to draft with the founder's note attached).

- Only approved goals and targets count towards the dashboard KPI targets, so nothing unapproved quietly changes what the studio is measured on.
- A map version is approved on its own; the client plan approval is a single sign-off covering that client's whole strategy, re-requested whenever something material changes.
- Every approval, rejection and note is stamped with who and when, and shows on the client's plan.

## Technical notes

- Migration: add `strategist` to the `app_role` enum; add `status`, `submitted_by/at`, `approved_by/at`, `review_note` to `client_goals`, `client_targets`, `strategy_maps`; add a `client_plans` table (one row per resident) holding plan status, owner, approval stamps and note; add `strategy_map_versions` (resident, snapshot of nodes/edges, version, status, stamps). Grants + RLS on all: staff read, strategy team write, founders approve via a `strategy_can_approve` helper. Trigger-based guard so only founders/MD/admin can move a row into `approved`.
- Helper `public.is_strategy_team(uuid)` mirroring the existing `is_leadership` pattern.
- `src/lib/strategy.ts` gains plan/approval types, status labels and tones, submit/approve/reject helpers, map version load/save/restore, and template definitions.
- New pages under `src/pages/app/strategy/`: `Overview.tsx`, `MapBuilder.tsx`, `Goals.tsx`, `Approvals.tsx`, sharing a `StrategyPage` shell with the tab bar (same pattern as `FinancePage`).
- Routes `/app/strategy`, `/app/strategy/map`, `/app/strategy/goals`, `/app/strategy/approvals` in `src/App.tsx`, gated to staff; sidebar group in `AppShell.tsx` with a count badge on Approvals for founders.
- `src/lib/kpi.ts` filters `client_targets` to approved rows only.
- `src/hooks/useMyRoles.ts` gains `isStrategyTeam` and `canApproveStrategy`.

## Also queued

The approved dashboard greeting work is still outstanding and will be built alongside this.
