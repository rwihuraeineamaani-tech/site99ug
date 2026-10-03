# Fix Approvals: no errors, right people, admin approves all, no content

## What is wrong
- Pressing Approve on some items shows "column does not exist". The exact column is not confirmed yet; the screen's own lists load fine, so the fault is in the approve step on the database side.
- 38 content workflow steps are still waiting in Approvals even though content sign-offs are switched off.

## What will change
1. **Find and fix the column error.** Sign in as you, press Approve on each kind of item (money requests, payment lines, loans, contracts, strategy, workflow steps), capture the exact error, then fix the database step that refers to the missing column. Repeat for every kind until none fail.
2. **System Admin approves everything.** Make sure every approval action (workflow steps, money requests, payment runs, loans, invoices, contracts, onboarding sign-offs, strategy) treats System Admin the same as a Founder, with the override recorded in history.
3. **Right people only.** Each item shows under "Waiting on you" only for the position it is meant for (or a named person), plus Founders/System Admin. Everyone else sees it under "Waiting on someone else". The sidebar badge, To-Do and notifications use the same rule.
4. **Content out of Approvals.** Close the 38 waiting content steps (marked as handled in the pipeline, kept in history), stop new content items from opening approval steps, and hide content from Approvals, the badge, To-Do and notifications. All content decisions happen in the Content Pipeline.
5. **Verify.** As you, approve one of each kind with no error. As a non-approver, confirm items appear only under "Waiting on someone else".

## Technical notes
- Inspect `decide_approval_task`, `approve_cash_request`, `approve_payment_run`, loan/invoice approval and any sync triggers on `approval_instances` for stale column names.
- Ensure `is_founder()` covers `admin` and is used in each override.
- Data update: set pending `approval_tasks`/`approval_instances` for content entity types to cancelled/skipped; guard submission so content never creates instances while `content_approvals_enabled()` is false.
- Filter content in `src/lib/approvals.ts`, `useApprovalsWaiting.ts`, `todo.ts`, `useNotificationFeed.ts`.
