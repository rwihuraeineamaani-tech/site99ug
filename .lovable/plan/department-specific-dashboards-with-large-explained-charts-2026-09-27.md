# Department-specific dashboards with large explained charts

## Goal
Every department gets its own dashboard, with its own layout, headline numbers and large charts. Finance should look and work nothing like the Founder view, and the same goes for every other department. Each chart comes with a short plain-English explanation: what it shows, what "good" looks like, and what to do next.

## Who sees what

| Role | Layout | Headline charts |
|---|---|---|
| Founders / MD | Company overview: wide chart on top, 4-card row | Revenue vs spend (12 weeks), active clients over time, department target progress, approvals waiting |
| Finance | Ledger layout: running balance across the full width | Cash position (running balance), money in vs out per week, unpaid invoices by age (0–30/31–60/60+), bills waiting on PIN, tax set aside |
| Sales | Funnel layout | Pipeline funnel by stage, deals won vs lost per month, forecast vs target, top open deals |
| Content / Creative | Production board | Ideas by stage (flow chart), shoots this week and next, edit turnaround in days, posts due |
| Strategy | Goals layout | Goal progress per client, monthly targets hit/missed, maps waiting for Founder sign-off |
| Legal | Risk layout | Contracts expiring (90-day timeline), sign-offs pending, drafts vs signed |
| Client Relations / Comms | Client health | Client health list, follow-ups due, renewals coming up, onboarding progress per client |
| Talent & Campaigns | Campaign layout | Bookings calendar strip, campaign reach vs forecast, talent spend |
| HR / People | Team layout | Headcount, KPI target hits per person, leave/absence, pay run status |
| Ops | Operations | Equipment in use or out, shoot logistics, team workload |
| Designer / Content creator (non-lead) | Personal | My work in progress, my deadlines, my KPI/earnings progress |

People with more than one position get a switcher at the top ("Viewing as: Finance / Sales"). It uses the existing dashboard focus, and the default is their main position. Access does not change.

## Shared pieces (same look, different content)
- A top strip with 3–4 numbers for that department, each showing its change from last period.
- 1–2 large charts, full width on desktop and stacked on mobile, with a legend and a hover tooltip.
- An "i" explanation under each chart: what it shows, how it's calculated, what good looks like.
- A "Needs you" list for that department, taken from the existing To-Do and approvals.
- Greeting, clock and calendar stay, in a smaller form. The current generic KPI block is replaced by the department block.

## Rules kept
- Money figures appear only for people with Finance access; everyone else sees counts.
- Every number comes from real records. Where there's no data yet, the chart shows an empty state explaining why.
- The dashboard builder in System Admin can still reorder or hide blocks for each role.

## Technical details
- New `src/components/dashboard/departments/` folder with one file per department (e.g. `FinanceDashboard.tsx`, `SalesDashboard.tsx`), built on the existing `components/ui/chart.tsx` (Recharts) and a shared `BigChart` wrapper (title, explainer, empty state).
- New `src/lib/deptMetrics.ts` with one loader per department that queries existing tables (invoices, cashbook, content_items, shoot_days, resident_contracts, sops, talent bookings, KPI tables). No new tables.
- `Dashboard.tsx` picks the department dashboard from `viewRole` / positions and keeps greeting, To-Do and calendar. `RolePanels` rows are reused inside the "Needs you" lists.
- Add new panel keys to `dashboardPanels` so the admin builder can see them.
- Check the result at desktop width and 428px, with typecheck clean.
