# Approvals tab + a 5-minute PIN unlock for finance

## 1. One Approvals page for everyone who signs things off

New page at `/app/approvals`, shown in the sidebar right under Dashboard and Inbox, with a count badge of items waiting on you.

It gathers, in one list, everything that is genuinely waiting on the signed-in person:

- Cash requests waiting on the managing director or a founder
- Monthly payment lines waiting to be cleared or held
- Loans waiting on approval
- Strategy work waiting on a founder (maps, goals, monthly targets, whole client plans)
- Content waiting for a founder's sign-off

Each row shows what it is, who it is for, the amount or reference, how long it has been waiting, and Approve / Send back buttons that act right there without leaving the page. Sections: **Waiting on you** first, then **Waiting on someone else** (read-only, so people can see where a thing is stuck), then **Recently decided**.

People with no approval powers see a short, calm empty state instead.

The existing Strategy > Approvals page stays as it is; this new page is the cross-department view.

## 2. A PIN that unlocks finance edits for five minutes

Today the six-digit PIN is typed for each payment. We add a session unlock on top:

- The first sensitive finance action asks for the PIN in a small dialog.
- Once correct, finance edits stay unlocked for 5 minutes, with a small countdown chip in the finance page header and a "Lock now" button.
- The countdown resets on each successful action; when it runs out, the next action asks again.
- Three wrong tries keeps the existing fifteen-minute lockout behaviour.
- The unlock lives only in memory for that tab, so a refresh or a new tab asks again.

Actions put behind the unlock:

- Cashbook: adding an entry, moving money between wallets, reversing an entry
- Invoices: marking an invoice settled
- Loans: recording a repayment

Paying money out keeps its own explicit PIN step (and the second PIN above the limit) — the unlock does not replace it.

## Technical notes

- New `src/components/finance/FinanceLock.tsx`: context provider + `useFinanceLock().require()` which resolves once the PIN is verified via the existing `check_payment_pin` RPC, plus an expiry timestamp and countdown chip. Mounted in `FinancePage`.
- New `src/lib/approvals.ts`: loaders that read cash requests, payment run lines, loans, strategy tables and content items, and label each row with the role that must act. New `src/pages/app/Approvals.tsx` and a `useApprovalsWaiting` hook for the badge.
- Route added in `App.tsx` behind `RequireRole gate="staff"`; nav entry in `AppShell.tsx`.
- No database changes: all approval RPCs and PIN checks already exist and stay authoritative server-side. The unlock is a convenience layer over checks the database still enforces.
