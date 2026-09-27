# Finish moving off the old finance payment setup

Finance ends up with one path for money: **client contract → invoice → approval → PIN-released payment → cashbook**. The old routes are moved over and then removed.

## 1. Every payment goes through an invoice
- The Payment board only shows invoices that are approved and waiting to be paid, plus money requests and monthly-run lines, which each get an invoice raised automatically when approved.
- The "record payment" option that skipped the invoice step is removed. Paying always settles an invoice and writes the cashbook entry.
- Each payment shows its full trail: contract → invoice → approval → payment → cashbook.

## 2. One contracts list
- The 1 record in the old contracts list moves over: into client contracts if the other party is a client, or kept as a non-client agreement in Legal (supplier, venue, partner) if not.
- Legal overview, Deadlines, the dashboard panels and Invoices read from the one list. The "legacy contract" option in the invoice form goes away.

## 3. Past money records in one place
- The 5 money requests, 1 monthly run and 4 wallets are checked. Any paid item with no invoice or cashbook entry gets a matching entry, marked "moved from old records" with its original date.
- Reports, Filing and Look-up then read only from the cashbook and invoices, so totals match everywhere.
- A before/after total check is run so no money goes missing or gets counted twice.

## 4. Pay comes from the KPI system only
- The older client pay splits (6 client assignments) become "one Handler per client" in the KPI system. Anything that doesn't fit, such as two people split on one client, is listed for management to pick before the switch.
- Dashboard greeting, People, Services and the finance summaries stop using the old retainer shares and show KPI pay instead.

## 5. Remove the old screens
- Remove the old retainer-split screens and the direct-payment pieces. Keep the underlying old records only as a read-only backup so history isn't lost.
- Check desktop and phone views and the preview error checks before finishing.

## Technical notes
- A data step backfills `cashbook_entries`/`invoices` from paid `cash_requests`/`payment_run_lines` without a link. Records are tagged `source='legacy'` so the step can run more than once safely.
- The `contracts` row is moved into `resident_contracts` when it has a resident; otherwise it stays as the only non-client agreement table. Drop `invoices.contract_id` once nothing references it.
- `record_payment` requires an `invoice_id`; approval triggers on requests and run lines raise the invoice.
- `client_assignments`, `my_retainer_shares` and `client_pay_overview` users switch to the kpiPay/`set_client_pay` handler data. Revoke write access to the old tables instead of dropping them.
- Files: PaymentBoardPanel, RequestsPanel, MonthlyRunPanel, FinanceTransaction, Invoices, legal Overview/Contracts, ops Deadlines/People, RolePanels, Dashboard, greeting, finance.ts, tax.ts, strategy.ts, Services.
