# Leadership Work Assignments

## Goal
Give all leadership roles—Founder, Managing Director, Creative Director, Sales Head, and System Admin—a reliable way to assign work, follow progress, receive evidence, and accept completed work.

## Experience

### 1. Assign work from To-Do
- Add a leadership-only **Assign work** action on the To-Do page.
- Capture a clear instruction, assignee or assignees, priority, due date and time, and optional private notes.
- Support useful task types such as contract, sales/deal, report, call/follow-up, finance, content, strategy, operations, and general work.
- Keep every assignment private by default: only its assignees, assigning leader, and System Admin can see it.
- Allow an optional link to an existing Resident, sale/deal, contract, shoot, invoice, report, content item, strategy item, or another app page.
- Let the leader choose which completion evidence is required: written update, file/link, and leader sign-off.

### 2. Give each person a proper task workspace
- Extend **To-Do** with **My work** and, for leadership, **Assigned by me** views.
- Show assigned work alongside existing content, shoot, approval, strategy, finance, operations, and Sales actions in card and list layouts.
- Add filters for status, priority, task type, assignee, overdue, today, and upcoming work.
- Provide a task detail view with the instruction, deadline, linked work, assignees, activity history, evidence, and clear next action.
- Let assignees mark work in progress, submit the required written update and file/link evidence, or request clarification.
- Let the assigning leader accept the submission, return it with feedback, reassign it, change the deadline, or cancel it.
- Keep accepted work in a searchable completed history rather than removing its record.

### 3. Connect tasks to the rest of the system
- Open linked Residents, deals, contracts, shoots, invoices, reports, and other work directly from the assignment.
- Surface open leadership assignments in the dashboard’s To-Do count and urgent work area.
- Add dated assignments to the assignee’s work calendar without exposing private task details to other staff.
- Preserve existing specialist ownership: for example, assigning “make this contract” tracks responsibility but the contract itself remains managed in Legal.

### 4. Deadlines and notifications
- Send push notifications when work is assigned, reassigned, due soon, overdue, submitted, returned, or accepted.
- Add reminder entries to the existing push queue with deduplication and deep links to the relevant task.
- Respect each user’s existing task notification preference.
- Update To-Do and sidebar counts when assignments change.

## Permissions and safeguards
- Enforce leadership assignment rights in the database, not only in the interface.
- Permit the Founder, Managing Director, Creative Director, Sales Head, and System Admin to create assignments.
- Restrict viewing to assignees, the assigning leader, and System Admin; task evidence follows the same access rules.
- Restrict completion submissions to assignees and acceptance/return decisions to the assigning leader or System Admin.
- Record assignment, reassignment, deadline, status, evidence, feedback, and sign-off events in an immutable activity history.

## Technical implementation
- Add task, assignee, evidence, and activity tables with explicit authenticated/service grants, row-level access rules, indexes, timestamps, and status validation.
- Add a private task-evidence storage area with matching access controls.
- Use structured optional links (`entity_type`, `entity_id`, and internal path) so existing records remain authoritative and are not duplicated.
- Extend the current To-Do loader, dashboard feed, calendar feed, badge counts, and push outbox rather than creating a disconnected task list.
- Add secure database functions for submission, return, acceptance, cancellation, and activity logging so state transitions cannot be bypassed.

## Verification
- Test every leadership role can assign work and ordinary staff cannot.
- Test private visibility with the assigning leader, assignee, unrelated staff member, and System Admin.
- Walk through assignment → notification → in progress → evidence submission → return or acceptance.
- Verify linked records, dashboard/To-Do counts, calendar timing, push deep links, mobile card/list layouts, file access, and completed history.
- Run type checks, the preview build, database/security checks, and desktop/mobile browser walkthroughs.
