# Finance: real pages, a cashbook, and the numbers behind it

Finance stops being one page with tabs. Each part gets its own page and its own entry in the sidebar, and a cashbook is added that records every shilling in and out, wallet by wallet.

## Sidebar

Finance becomes a group with its own pages:

```text
Finance
  Overview
  Cashbook
  Requests
  Payments
  This month
  Loans
  Budgets
  Reports
  Look up
```

People who can't see money still get Requests only, so they can ask for cash without seeing the rest.

## Cashbook

A running record of money in and money out, split by wallet (MTN MoMo, Airtel Money, Bank, Cash, and any wallet you add).

- A "Log an entry" button opens a short form: in or out, wallet, amount, date, category, who it was to or from, a note, an optional reference number and an optional receipt file.
- Money in can be tagged to a resident, project or event, so income can be traced.
- Each wallet shows its current balance; the page shows the total across all wallets.
- Transfers between wallets are one action that writes both sides.
- Filter by wallet, month, direction and category; search by name, note or reference; export what you're looking at.
- Every payment finance marks as paid on the Payments board writes itself into the cashbook automatically, so nothing is typed twice.
- Only finance and founders can log entries. Entries can't be quietly deleted — a wrong entry is reversed, leaving both lines visible.

## Overview page

The landing page for Finance: balance per wallet and the total, money in versus money out this month, what's waiting on approval and on payment, the recurring payments due this month, and the biggest categories of spend.

## Budgets

A monthly cap per spending category. Each category shows the cap, what's been spent and what's left, with a clear mark when a cap is passed. Set once and it carries into following months until changed.

## Resident and project profitability

Per resident (and per project): money in, money out, and the difference, for a chosen month or range. Reachable both from the Finance section and from a resident's own page.

## Reports

- Monthly statement: opening balance, money in, money out, closing balance, per wallet.
- Category breakdown for any date range.
- Resident/project summary.
- Every report exports to CSV, and the monthly statement prints cleanly to PDF.

## What stays the same

Requests, approvals, the payments board, the monthly run, loans and look-up all keep working exactly as they do — they just live on their own pages now.

## Technical notes

Database (one migration):

- `wallets` — name, kind, active, sort. Seeded with MTN MoMo, Airtel Money, Bank, Cash.
- `cashbook_entries` — wallet_id, direction (in/out), amount_ugx, entry_date, category, counterparty_name, counterparty_kind, resident_id, project_id, event_id, note, reference, attachment_path, transaction_id (when it came from a payment), transfer_group_id, reverses_id, created_by, timestamps.
- `budgets` — month, category, cap_ugx, notes, created_by, timestamps; unique on (month, category).
- GRANTs to `authenticated` and `service_role` on all three; RLS: read for `can_see_finance() OR is_leadership()`, write for `can_see_finance() OR is_founder()`; no deletes (use the reverse action).
- `log_cashbook_entry(...)` and `reverse_cashbook_entry(_id, _reason)` as SECURITY DEFINER functions with role gates inside, `REVOKE EXECUTE` from PUBLIC/`anon`, `GRANT` to `authenticated`.
- `wallet_balances()` and `finance_month_summary(_month date)` SECURITY DEFINER read helpers for the overview and reports.
- `record_payment(...)` extended to accept a wallet and write a matching cashbook entry inside the same transaction.
- New private storage bucket `cashbook-receipts` with policies mirroring `resident-contracts`.

Frontend:

- `src/pages/app/finance/` with `Overview.tsx`, `Cashbook.tsx`, `Requests.tsx`, `Payments.tsx`, `MonthlyRun.tsx`, `Loans.tsx`, `Budgets.tsx`, `Reports.tsx`, `Lookup.tsx`; existing panels in `src/components/finance/` are reused as-is inside the new pages.
- Routes `/app/finance` (overview) and `/app/finance/cashbook|requests|payments|monthly|loans|budgets|reports|lookup`, all behind `RequireRole gate="finance"` except Requests which stays open to staff. `/app/finance/t/:id` unchanged.
- `AppShell.tsx` gains a nested Finance group using the existing sidebar group pattern.
- `src/lib/finance.ts` grows `WALLET_KINDS`, `DIRECTIONS`, `ugx()` formatting and shared month helpers.
