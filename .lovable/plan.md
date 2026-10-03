# Client contract details, Founder sign-off and monthly retainer pricing

## What you will get

### 1. A full contract details page for every client
Each client contract gets its own detail view (from Legal and from the client's record) showing:
- Title, contract type, start and end dates, number of months
- Monthly retainer and the total contract value (worked out for you)
- Services covered (deliverables per month, platforms, shoot days per month)
- Payment terms (invoice day, due days), notice period, renewal terms
- Signatories on both sides, signed document file, notes
- Approval trail: who drafted it, who edited it, who approved it and when
- Money so far: invoiced, paid, outstanding

**Every staff member can read the full details**, matching the full client record access you just opened.

### 2. Legal edits, Founder approves
```text
Legal drafts/edits -> Submitted for approval -> Founder (or System Admin) approves -> Signed/Running
                                    \-> Sent back with a note -> Legal edits again
```
- Legal team (plus MD) can create and edit contract details while it is a draft or sent back.
- Approved contracts are locked. Changing one reopens it as a new approval round, so the trail stays honest.
- Founder approval requests appear in Approvals, the notification bell and the Founder's To-Do.

### 3. System Admin counts as Founder everywhere
Your Founder account that also holds System Admin can approve anything waiting on a Founder. Today some approvals only check the exact "Founder" position, so the System Admin position blocks you. Every Founder check will accept either.

### 4. Content approvals switched off for now
Ideas no longer wait for an MD or Founder sign-off; they move through the pipeline without the approval step, and content items disappear from the Approvals list. This is a switch, so it can be turned back on later.

### 5. Monthly retainer drives the contract value
- You enter the **monthly retainer**. Months are counted from the start and end dates (or typed in).
- **Contract value = monthly retainer x number of months**, calculated automatically and shown everywhere.
- Existing contracts: the old value field is treated as the total; the monthly figure is backfilled as total / months, and you will see a preview list of each client's monthly figure before it is applied.

### 6. Same numbers in Finance and KPIs
- New client invoices from a contract prefill one month's retainer, with the period label (for example "October 2026 retainer").
- Contract money summary (invoiced, paid, outstanding) compares against the calculated total.
- Client portal "Documents" shows monthly retainer and total.
- KPI end-of-contract bonus (10%, plus 5% on renewal) uses the calculated total.
- Renewal drafts copy the monthly retainer, not the old total.

## Technical details
- `resident_contracts`: add `monthly_retainer_ugx bigint`, `months int` (default derived from dates), `contract_type`, `services jsonb`, `payment_terms`, `invoice_day`, `notice_days`, `client_signatory`, `site99_signatory`, `approval_state` (draft / submitted / approved / returned), `submitted_by/at`, `approved_by/at`, `return_note`. `value_ugx` becomes a trigger-maintained total (`monthly_retainer_ugx * months`), widened to bigint.
- Guard trigger: only `legal`, MD or Founder/admin may edit details while draft/returned; only `is_founder()` may set approved; editing an approved row resets it to submitted. RPCs `submit_contract_for_approval`, `approve_contract`, `return_contract`. Existing staff-read policy kept.
- `recompute_resident_lifecycle` treats a contract as signed only once approved.
- Founder equivalence: `has_role(uid,'founder')` paths in `can_act_approval_task` and any `'founder'` role checks also accept `admin`; frontend `FOUNDER_ROLES` audited so every `isFounder` includes admin.
- Content approvals: a `finance_settings`-style flag `content_approvals_enabled=false`; `src/lib/approvals.ts` skips the content section and the pipeline skips the approval stage while off.
- Backfill via data update with a preview query first; `contract_finance_summary`, `contractLifecycle.startRenewal`, `Invoices.tsx` prefill, `kpiPay.ts`, `ResidentRecord.tsx`, `legal/Contracts.tsx`, `PortalDocuments.tsx`, `deptMetrics.ts`, `RolePanels.tsx`, `Sales.tsx` read the new fields.
- Verify signed in as the Founder/System Admin account: approve a submitted contract, and as a plain staff member: view full contract details read-only.
