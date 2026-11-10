# Connect Cashbook payments to contracts and invoices

## What you will get
1. **Every cashbook line can point to a contract and an invoice.** When an invoice is marked paid, the money-in line is linked automatically.
2. **Manual entries:** when adding money in or out in the Cashbook, pick the client, then optionally their contract and an open invoice.
3. **Cashbook ledger:** linked lines show a small contract badge and invoice number next to the client. Clicking opens the contract or invoice.
4. **Link older lines:** Finance, MD and Founders get a "Link" action on unlinked lines to attach them to a contract or invoice.
5. **Contract details (Legal and the client's Residents file):** a new "Payments & Cashbook" section listing each payment received against that contract, with date, amount, account, reference and receipt download, plus a simple reconcile line: contract value, invoiced, cash received, still owed.

## Technical details
- Migration: add nullable `resident_contract_id` and `invoice_id` to `cashbook_entries` (with indexes); update the invoice settlement path so the cashbook row it writes carries both IDs; backfill existing rows that already reference a paid invoice where that can be matched.
- Cashbook screen: contract and invoice pickers filtered by chosen client; badges and a Link dialog; existing PIN gating and permissions unchanged.
- Contract details: query cashbook rows by `resident_contract_id` (and via linked invoices), show the ledger and reconciliation.
- Verify in the browser: pay a test invoice, confirm the cashbook line is linked and appears under the contract.
