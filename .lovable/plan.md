# Filing, invoices and PIN-released payments

Three connected pieces: a real Ugandan filing page built from the cashbook, an invoice register that feeds the payment board, and a PIN step that releases every payment with evidence attached.

## 1. Filing page (`/app/finance/filing`)

Finance and leadership only.

- **Monthly VAT return** — pick a month and get: sales and output VAT at 18%, purchases and recoverable input VAT (only entries backed by an EFRIS-style invoice), reverse-charge VAT on imported services (Google, Meta, software), exempt and zero-rated lines, and net VAT payable or credit. Due-by-15th reminder.
- **Annual income tax pack** — pick a year: taxable income, deductible running costs, disallowed items listed by reason, capital items with their capital allowance rates and this year's write-off, chargeable profit and tax at 30%, plus withholding tax already suffered as a credit.
- **Tax guide** — a plain-English section covering what counts as our income, what is never deductible, capital versus running cost, VAT registration and reverse charge, withholding at 6% and 15%, PAYE/NSSF, and filing dates. Built from the existing rules so the guide and the numbers never disagree.
- **Every figure is clickable** — open the list of entries behind it.
- **Exports**: a PDF filing pack (cover, the return figures as submitted, then the supporting schedule of every entry) and a CSV of the same lines to paste into the URA template. Both carry the accountant-review note.

## 2. Invoice register (`/app/finance/invoices`)

One register, two directions.

- **Invoices we issue** — pick a client or a contract and the payee, value, period and terms prefill from the contract. Add lines, VAT on or off, due date. Numbered in sequence, exported as a branded PDF, marked sent, then part-paid or paid — and settled money lands in the cashbook as income.
- **Invoices sent to us** — upload the supplier bill (Google Workspace and the like), record supplier, amount, VAT, due date and category. It then goes through the normal approval and lands on the payment board as something cleared for payment.
- **Recurring bills** — a monthly subscription raises its own draft invoice each month on its due day, ready for approval.
- Every invoice shows its trail: contract → invoice → approval → payment → cashbook entry, each step clickable.

## 3. PIN-released payments

- Each Finance, Founder and MD member sets a 6-digit payment PIN under **Settings → Security** (set, change, and see when it was last changed). Stored hashed; never readable.
- Marking anything paid now asks for the payer's PIN. Wrong PIN three times in a row locks payment release for 15 minutes.
- Payments at or above a set amount (default UGX 1,000,000, changeable by a founder) need a second person's PIN as well — a Founder or MD, and never the same person twice.
- The payment screen collects the evidence in one step: which wallet or account it left, method, transaction ID, date, comment, and the receipt file. Transaction ID and the wallet become required.
- Everything is written to the payment record and the cashbook entry, and the release — who, which PINs, when — is written to the finance audit trail.

## Technical notes

- New tables: `invoices` and `invoice_lines` (direction, party, contract link, numbering, VAT, status, file path, recurring parent), `payment_pins` (per-user hashed PIN via pgcrypto, failed-count, locked-until), `finance_settings` (dual-PIN threshold). Grants, RLS scoped to finance/leadership, and updated-at triggers on each.
- `record_payment` gains PIN verification, second-approver verification above the threshold, and required wallet/reference; verification runs in a `SECURITY DEFINER` function so hashes never leave the database, with EXECUTE revoked from PUBLIC and anon.
- Paying a supplier invoice or settling a client invoice writes the matching `cashbook_entries` row through the existing logging path, so the filing page reads one source.
- Filing maths lives in `src/lib/tax.ts` beside the existing `CATEGORY_TAX` rules; PDF built client-side with the existing print styling; CSV via the existing `csv`/`download` helpers.
- A nightly-safe check raises recurring invoices on load rather than adding a scheduled job.

## Not included

Direct submission to URA or EFRIS — the pack is prepared for a person to file.
