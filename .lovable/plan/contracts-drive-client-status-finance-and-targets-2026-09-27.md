# Contracts drive client status, finance and targets

## What you will get
One contract lifecycle that automatically decides whether a client is Active, due for renewal, or Complete, and keeps Finance and KPI targets in step.

```text
Draft -> Signed -> Active (onboarded + start date reached)
                     |
          14 days before end -> Renewal due (alerts + To-Do)
                     |
      end date passes -> Renewed (new contract) 
                      -> Complete (fully paid)
                      -> Ended - unpaid balance (owed money)
```

## Client status rules
- **Onboarding**: signed contract exists but onboarding steps are not all done, or start date is in the future.
- **Active**: onboarding finished AND today is within a signed contract's start and end dates. This is the only way a client becomes Active.
- **Renewal due**: active contract ends within 14 days and no follow-on contract exists.
- **Complete**: contract ended, no renewal, and every invoice for it is paid.
- **Ended - balance owed**: contract ended with unpaid invoices (shown to Finance and the Handler until settled, then flips to Complete).
- Status updates automatically every day and whenever a contract, onboarding step or payment changes. Manual status changes on the client record are removed.

## Finance
- Each contract shows value, invoiced, paid and outstanding in Legal and on the client record.
- Invoices can be filtered by contract; every contract invoice is labelled with it.
- Contract cannot reach Complete while money is outstanding.
- Finance overview gets "Contracts ending soon" and "Ended with balance owed" lists.

## Targets and KPIs
- Client end-of-contract bonus (10%) is created automatically when a contract reaches Complete; renewal adds the extra 5%. Both still need management confirmation on the KPI desk before paying out.
- Only Active clients count towards client targets, handler workload and dashboards.

## Renewal alerts
- 14 days before end: push notification + To-Do item for the Handler, Sales head and Founders, plus a calendar marker.
- "Start renewal" button creates a draft follow-on contract prefilled from the old one; when signed, the client stays Active without a gap.

## Current data impact
13 clients are currently marked Active but only 4 active contracts exist. After the change, clients without a running signed contract will move to Onboarding (or Complete/Ended). A preview list will be shown to you before the switch is applied.

## Technical details
- Consolidate on `resident_contracts` (the Legal one); migrate the single cancelled row in legacy `contracts` and point `invoices.contract_id` / `kpi_contract_bonuses.contract_id` at `resident_contracts`.
- Add `renewed_from_id`, `renewal_due_on` (generated ends_on - 14), `completed_at` to `resident_contracts`; contract statuses: draft, signed, active, renewal_due, renewed, complete, ended_unpaid, cancelled.
- SQL function `recompute_resident_lifecycle(resident_id)` sets `residents.status`/`lifecycle_status`; called by triggers on resident_contracts, resident_onboarding_steps, invoices, and a daily pg_cron job (Kampala midnight) that also queues renewal push/To-Do.
- View/RPC `contract_finance_summary` (value, invoiced, paid, outstanding) respecting `can_see_finance` and handler access.
- Frontend: Legal contract cards, ResidentRecord, Invoices filter, Finance overview lists, KPI desk auto-bonus rows, dashboards filter on Active.
