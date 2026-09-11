# System Administration and Approval Workflow Control

## Goal
Create a system-admin-only control centre where the administrator can define who does what, assign responsibilities, and build the live approval workflows used by Finance, Content, Strategy, Contracts, and future departments.

Published workflows will control real approvals. Draft diagrams will never affect live work until they pass validation and are explicitly published.

## Admin section
Add a dedicated **System Administration** area with these tabs:

1. **People & access**
   - Show every team member, job title, roles, departments, client assignments, and active delegations.
   - Create accounts, edit titles, assign or remove roles, and clearly explain the effective access each role grants.
   - Reconcile the existing role lists so every supported staff role, including Strategist, can be assigned consistently.
   - Restrict role and account administration to users who explicitly hold the System admin role; Founder status alone will not grant editing rights.

2. **Responsibilities**
   - Maintain a detailed responsibility catalogue by department and work type.
   - Assign each responsibility to a primary person or role, with optional backup people.
   - Show a responsibility matrix: work area × accountable role/person × backup × approval authority.
   - Flag gaps, duplicate ownership, inactive users, and responsibilities without a qualified approver.

3. **Workflow editor**
   - Provide a visual drag-and-drop canvas using the project’s existing diagram editor patterns.
   - Support Start, Review, Approval, Condition, Parallel approval, Notification, Escalation, and End nodes.
   - Configure each step’s approver by role, named person, responsibility owner, or requester’s manager/department owner.
   - Support ordered approvals, parallel approvals, “any one” or “all must approve,” separation of duties, rejection/send-back routes, and requester-exclusion rules.
   - Build conditions through safe form controls for amount, department, client, risk, contract type, content stage, and other approved record fields—never executable custom code.
   - Configure deadlines, reminders, overdue escalation, substitutes, and temporary delegation.
   - Include starter templates for Finance, Content, Strategy, and Contracts.

4. **Versions & publishing**
   - Keep an editable draft separate from the currently published version.
   - Validate unreachable steps, loops, missing approvers, invalid conditions, and dead ends before publishing.
   - Show a plain-language route preview and a test simulator using sample values.
   - Publish atomically, preserve immutable version history, compare versions, and roll back by republishing a previous valid version.
   - Existing approval instances continue on the workflow version they started with; new work uses the newly published version.

5. **Audit & health**
   - Record every role change, assignment, delegation, workflow edit, publish, approval, rejection, reassignment, reminder, escalation, and override.
   - Show active approvals, overdue steps, average response time, bottlenecks, and workload by approver.
   - Allow filtering and export without exposing private finance details to unauthorized users.

## Runtime approval experience
- Replace duplicated approval-count and approval-list logic with one authoritative approval service.
- Create an approval instance when covered work is submitted, resolve the published workflow version, evaluate its conditions, and open the correct first step or parallel step set.
- Populate **Approvals**, **To-Do**, sidebar badges, dashboard summaries, and reminders from the same pending-step records.
- Approvers can approve, reject, request changes, comment, attach evidence, or delegate when allowed.
- The system revalidates every action in the database; hiding a button is never treated as authorization.
- Keep domain records and approval records synchronized so a document cannot display “approved” unless its workflow instance completed.

## Initial live workflows
Launch all four areas together after migration and verification, implementing integrations in this order:

### 1. Finance
- Cash requests, monthly payment runs, loans, invoices, payment execution, and sensitive cashbook changes.
- Preserve dual-approval and finance-PIN rules.
- Support amount-based routing and ensure the requester cannot approve their own request or provide both required approvals.

### 2. Content
- Idea approval, production gates, edit review, final sign-off, rejection, and send-back loops.
- Map current pipeline stages to workflow steps without losing existing content status or history.

### 3. Strategy
- Client plans, goals, monthly targets, strategy maps, and saved map versions.
- Preserve Founder sign-off while allowing the administrator to configure ordered review and escalation steps.

### 4. Contracts
- Add the missing controlled Legal workflow for drafting, legal review, internal approval, signature, activation, renewal, expiry, and cancellation.
- Prevent arbitrary status jumps and include contracts in the unified Approvals and audit views.

## Data and security design
- Add versioned workflow definitions, immutable published workflow versions, structured nodes/transitions, approval instances, step assignments, decisions, comments/evidence, responsibility assignments, delegations, reminders, and audit events.
- Use explicit grants and row-level rules on every new table.
- Add an exact System-admin database check for configuration changes; do not reuse the current broader leadership check.
- Keep workflow conditions as validated structured data with an allow-list of fields and operators.
- Use database functions for submission and approval transitions so callers cannot skip steps, select another approver, change ownership, or alter completed history.
- Preserve current domain-specific guards until each area is proven against the new engine, then replace duplicate rules deliberately rather than weakening them.

## Migration and rollout
1. Add the admin-only gate and consolidate account/role administration into the new section.
2. Add responsibilities, delegations, workflow definitions, versions, runtime instances, steps, and audit storage.
3. Build the admin matrix, editor, validator, simulator, publishing, version history, and audit views.
4. Integrate Finance first internally, then Content, Strategy, and Contracts.
5. Seed equivalent published workflows from today’s rules before switching live records to the engine.
6. Keep in-progress legacy approvals on their existing path or migrate them through an explicit, audited mapping; never silently reinterpret them.
7. Switch the unified Approvals/To-Do/dashboard feeds to runtime step assignments only after all four seeded workflows pass parity checks.

## Verification
- Confirm only an explicit System admin can create, edit, publish, roll back, or assign roles and responsibilities.
- Test each seeded workflow’s happy path, rejection, send-back, parallel approval, conditional branch, delegation, timeout, escalation, and unavailable approver behavior.
- Prove self-approval and two-approval separation cannot be bypassed through direct requests.
- Verify private finance details remain restricted while assigned approvers receive enough context to decide.
- Verify old approval records remain readable and in-progress work completes correctly.
- Test badges, To-Do, dashboard, reminders, comments, evidence, audit history, mobile layouts, diagram editing, and version rollback end to end.

## Technical notes
- Reuse `@xyflow/react` canvas, minimap, controls, and version-history patterns from the Strategy map builder, but create approval-specific node forms and validation.
- Replace the closed, hard-coded approval union and duplicated badge queries with database-backed workflow instance and task queries.
- Continue using the existing secure account-management function for identity operations, tightened to explicit System-admin authorization and aligned role vocabulary.
