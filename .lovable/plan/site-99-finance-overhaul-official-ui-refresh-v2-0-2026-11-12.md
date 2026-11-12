# Site 99 Finance Overhaul + Official UI Refresh (v2.0)

## What the old sheet shows (145 rows, Mar to Nov 2026)
- **Loans and capital booked as Revenue** (Muhendo and Rwihura loans, "Capital In Eine"). This inflates income and hides what the company owes.
- **Receipts use INV numbers** (S9926-INV-xxx is used for every money-in), so invoices and receipts are the same thing. Malformed IDs too (S992026-1016-INV-036). For system purposes every old sheet row gets renumbered into the new format (see Phase 3), with the original ID kept beside it for reference.
- **Wrong balance direction**: "Transfer to PayRoll" (2,000,000 out) and "The Picture Hub" (775,000 out) *raised* the balance. These two rows alone break the balance by about UGX 5.5M. The payroll transfer went to a separate payroll/volunteer pay sheet, so that sheet also needs importing to see where the money actually went.
- **Blank or plug rows**: INV-031/032/033 have no amounts, "Unknown Expense" 59,000, and "Balance as at today" 454,700, which was a note (like a comment) rather than a real transaction, but it was entered as money in and changed the balance.
- **Dates out of order** (Oct 3 rows after Oct 21), and October rows lost their payment type.
- In the app today: 12 invoices (S99-2026-0001 to 0012, two void) and 30 cashbook entries already exist on the new system.

## Phase 1. Clean starting point (finance)
1. **Opening balance on 1 November 2026**: we enter the real bank and mobile money balances you hold on that day, confirmed against statements. Everything before it is kept as a read-only "Old sheet archive" for reference, not mixed into the live books.
2. **Import the sheet** into the archive with each row corrected and flagged (loan, capital, reversed sign, missing amount), so you can see what was wrong and why.
3. **Re-check Oct and Nov** entries already in the app against the sheet and bank, and list every difference for Finance to accept or fix.

## Phase 2. Proper money categories
- Money in splits into **Client revenue, Owner capital, Loans received, Other income**. Money out into **Payroll, Production gear, Software, Transport, Operations, Loan repayments, Owner drawings, Transfers**.
- **Production fund**: a separate account for day-to-day production operations. At the start of each month the Head of Content Creation and Strategy (or System Admin) sends a spending estimate to the Co-founders. Either Co-founder approves and sets the month's limit. Each time the Head requests money, it is transferred into the production fund and the remaining requestable balance drops. The fund shows its limit, amount drawn, remaining, and what it was spent on.
- **Transfers** (e.g. main account to payroll account) move money between your own accounts and never count as income or expense.
- **Charges on every transfer and payment**: bank or mobile money fees are recorded as their own line (Bank charges / Mobile money charges). **Mobile money always requires a transaction ID (TID)** before it can be saved.
- **Accounts**: Equity Bank, Mobile Money, Petty cash, Payroll account, Production fund, each with its own running balance plus a total. Finance can add and edit accounts and give each one a colour, used everywhere that account appears.
- **Loans register**: who lent, amount, repaid, still owed (the Muhendo 40,000 still unpaid shows here).

## Phase 3. Clear, separate document numbers
- Format, no dashes: **S99 + last two digits of the year + three-letter code + count A001 to Z999**. Example: `S9926INVA001`. After A999 comes B001, up to Z999.
- Codes: `INV` invoice, `RCT` receipt, `EXP` expense / payment voucher, `TRF` transfer, `CRN` credit note, `LON` loan, `PRF` production fund request.
- Numbers are given by the system only, never typed, never reused. A void keeps its number and shows VOID.
- All old sheet rows and the existing S99-2026-00xx invoices are renumbered into this format for system purposes, with the old number stored beside each so nothing sent to clients is lost. Everything from now on continues the new series.

## Phase 4. Invoices that look and send properly
- Redesigned invoice and receipt PDFs (letterhead, TIN, bank and mobile money details, VAT line, terms, signature/stamp).
- **Email invoice and receipt** to the client and their contact people with a proper written message, from the Site 99 address. This needs the email domain setup finished (still pending under More, Emails).
- Receipt is created automatically when a payment is recorded against an invoice.

## Phase 5. Monthly close and reports
- **Bank reconciliation**: tick each entry against the statement, month locked after Finance + Founder sign-off.
- Reports: Profit and loss, Cash flow, Balance sheet (cash, money owed to us, loans owed, owner capital), Aged unpaid invoices. All PDF/CSV.
- **Every Friday** Finance approves and sends the weekly report pack to the Co-founders (and MD). The system prepares it automatically and reminds Finance on Friday morning.

## Phase 6. Official UI system (v2.0)
- Study **My Kweeza** and **Hardware Management System** and copy their strengths: layered dark surfaces (background, card, raised card), clear borders and shadows, solid primary/secondary/danger buttons with proper sizes, consistent tables, form fields, page headers and mobile bottom bar.
- Rebuild the shared building blocks first (buttons, cards, tables, inputs, dialogs, page header), then apply page by page: Finance, Dashboard, Residents, Content, then the rest.
- Check every page on phone and desktop in dark and light mode.

## Phase 7. Versioning
- Start at **Site 99 v2.0**, with a "What's new" page and version shown in Settings. Each release gets a short plain-English change note.

## Suggested order
Phase 1 to 3 first (stops the bleeding), then 4, then 6 alongside 5, then 7. Each phase ships separately so finance work never waits on the design work.

## Decisions needed from you
- Opening date: **1 November 2026** (confirmed).
- The real opening balances per account on that date.
- Please upload the payroll/volunteer pay sheet.
- Loans from Rwihura: **loans to repay** (confirmed).

## Technical details
- New tables: `finance_accounts` (with colour), `loans`, `production_fund_budgets` / `production_fund_requests`, `payroll_legacy` (the payroll sheet), `legacy_ledger` (archived sheet rows with correction flags), `period_closes`; `cashbook_entries` gains `account_id`, `category`, `transfer_pair_id`, `charge_ugx`, `tid` (required for mobile money), `reconciled_at`. Friday report pack via a scheduled job and Finance approval.
- Number series per document type via a `document_sequences` table (code, year, letter, count) and a `next_doc_number(code)` function producing S99YYCCCL###; old numbers kept in a `legacy_number` column.
- Receipts and payment vouchers become rows linked to `invoices`/cashbook entries, keeping the rule that every outgoing payment is an approved bill.
- Email via the Lovable email system once notify.site99ug.com verifies.
- UI: new tokens for surface layers, elevation and button variants in the global CSS and shadcn variants; reference projects read via cross-project checkout.
