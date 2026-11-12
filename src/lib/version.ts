/** Site 99 releases, newest first. Add one entry per release with plain-English notes. */
export type Release = { version: string; date: string; title: string; notes: string[] };

export const RELEASES: Release[] = [
  {
    version: "2.3.0",
    date: "2026-11-12",
    title: "Official look, part one",
    notes: [
      "Every drop-down in the system now looks like a proper field with a clear arrow, instead of a grey block.",
      "Filters, view switches and tabs share one shape and size, and the one you have picked is easy to see.",
      "Status labels are calmer and easier to read, for example Active, Paid or Cancelled.",
      "The side menu shows the page you are on with a red marker, and long section names no longer wrap.",
      "Calendar and Sign out in the top bar are proper buttons.",
      "Long dashes are gone from on-screen text across the system.",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-11-12",
    title: "Finance office and the payroll sheet",
    notes: [
      "New Finance office page: company registration, TIN, NSSF, VAT, letterhead, the bank account and mobile money clients pay into, who signs, days to pay, and the second PIN limit, all in one place.",
      "New invoices start with the due date and VAT rate set in Finance office.",
      "The old payroll and volunteer sheet now sits in Finance, Old sheet archive, Payroll sheet, read only, checked against the cashbook.",
      "Opening balances from 1 November 2026 stay open for the Finance team to fill in, and Finance office shows which accounts still need one.",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-11-12",
    title: "Official invoices and receipts",
    notes: [
      "Invoices and receipts have a new official layout: letterhead, TIN, a clear VAT line, paid to date, balance due, how to pay, terms and a signature line.",
      "Every payment linked to an invoice is its own receipt, numbered by its cashbook line, with the amount in words and a PAID stamp.",
      "Finance can email an invoice or a receipt to the client straight from Invoices. Emails go out once the Site 99 email address finishes its setup check.",
      "Clients can download receipts for every payment in their portal, under Contract and Billing.",
      "Finance fills in the TIN, bank account, mobile money and who signs once, under Invoices, Invoice and receipt details.",
      "Marking a video as posted now uses the day you pick, not the day you click. Posted videos have a Fix posted day box for older ones.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-11-12",
    title: "The finance overhaul",
    notes: [
      "One clean numbering system with no dashes, for example S9926INVA001. Invoices, receipts, expenses, transfers, loans and production fund requests each have their own code, and numbers are never reused.",
      "The old Google Sheet now lives in Finance, Old sheet archive, read only, with every row renumbered and problem rows flagged.",
      "A side by side check of October and November shows what is on the sheet but not in the app, and the other way round.",
      "Accounts can be added, edited and colour coded, with an opening balance on 1 November 2026.",
      "Transfers between our own accounts never count as income or spending. Bank and mobile money charges are saved as their own line, and mobile money always needs a TID.",
      "New production fund: a monthly estimate, a limit set by a Co-founder, requests that move money into the fund, and alerts at every step.",
      "Cashbook entries can be ticked against the statement, and a month locks once Finance and a Co-founder both sign it off.",
      "Reports now include profit and loss, cash flow and a balance sheet, by week or month, as PDF or CSV.",
      "Every Friday Finance approves and sends the weekly report pack to the Co-founders and MD, with an 8am reminder.",
    ],
  },
];

export const APP_VERSION = RELEASES[0].version;
