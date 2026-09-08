# Making Site 99 a world-class system

You picked everything, so this is a staged roadmap. Each phase is a working feature on its own — you approve and I build them one at a time, starting with the one you added yourself.

## Phase 1 — Client strategy: goals, targets and a workflow map

The centrepiece. Every client gets a strategy page:

- **Goals** — what we're trying to achieve for this client (e.g. "grow TikTok to 50k", "3 leads a week"), with an owner and a target date.
- **Targets** — monthly numbers per client and per person: posts, shoots, reach, follower growth. The dashboard performance panel then shows your figures *against target*, not just against last month.
- **Workflow map builder** — a visual board where you lay out the client's strategy as steps: pillars, content types, posting rhythm, who does what, and how one step feeds the next. Drag boxes, connect them, colour them by stage. Print or export as a PDF you can hand to the client.
- A monthly "how are we doing" strip: on track / behind / ahead per goal.

## Phase 2 — Notifications and your inbox

A bell in the top bar and a daily email digest: approvals waiting on you, shoot tomorrow, numbers due, cash request decided, contract expiring. You choose which ones email you and which just sit in the app.

## Phase 3 — Invoicing and money loop

Raise an invoice from a contract, send it, track sent / paid / overdue, and have payment land in the cashbook automatically with its reference. Overdue invoices show up in notifications and on the dashboard.

## Phase 4 — Reporting and exports

A monthly studio report and a per-client results pack (reach, followers, posts, best-performing content, spend), exportable as PDF or CSV for the client or the accountant.

## Phase 5 — Client portal depth

Clients see their content calendar, approve or comment on ideas, view their goals and monthly results, and see invoices with payment status.

## Phase 6 — Workload and asset library

Before booking a shoot, see who is already stretched that week. Every posted piece keeps its final files and links in one searchable place per client.

## Phase 7 — Search and history

One search box across clients, ideas, shoots, contracts and money, plus a visible record of who changed what and when.

## Technical notes

- Phase 1 tables: `client_goals` (resident_id, title, metric, target_value, due_on, owner, status), `client_targets` (resident_id or user_id, month, metric, target_value), `strategy_maps` (resident_id, title, nodes jsonb, edges jsonb, version). All with grants, RLS scoped through the existing `can_touch_resident_accounts` / staff checks, timestamps and update triggers.
- Map builder built on React Flow, saved as nodes/edges jsonb; export via print stylesheet.
- Targets feed `src/lib/kpi.ts` so `buildKpi` returns actual vs target; dashboard KPI panel gains a progress bar.
- New page `src/pages/app/ResidentStrategy.tsx` plus a Strategy tab on the resident record; deck primitives reused, no new visual language.
- Later phases: `notifications` + `notification_prefs` tables and a scheduled edge function for the digest; `invoices` + `invoice_lines` linked to `cashbook_entries`; asset links on `content_items`; a single `audit_log` fed by triggers.
