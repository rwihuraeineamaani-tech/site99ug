# Positions, access, and role-based workspaces

## Goal
Give every internal team member the shared tools they need, while making their dashboard and sidebar match their actual work. A person’s visible job title will stay separate from private system permissions.

## Position and access model

- Add a neutral **Team member** base access level for every internal account. This always includes Dashboard, To-Do, Chat, Briefs, Announcements, Approvals, Calendar, Settings, and read-only access to the full Content Pipeline.
- Keep **System Administrator** as a separate technical permission held only by `site99ug@gmail.com`; it is not treated as somebody’s job position.
- Replace the broad overlapping access labels with clear business positions:
  - Founder
  - Managing Director
  - Operations Manager
  - Finance
  - Legal
  - Sales & Partnerships
  - Strategy
  - Content Creation / Production
  - Talent
  - Communications
  - Designer
  - Events Manager
  - Site Editor
  - Gate Scanner
  - Read-only
- Keep the free-text **Job title** as the only position label shown beside a person’s name. Permission names remain visible only in System Administration and the person’s Settings page.
- Only the System Administrator can assign or remove positions and access. There will be no employee access-request flow.
- Reset current non-core access safely: first record each person’s existing access in the action trail, then convert internal accounts to Team member access only. Preserve the sole System Administrator account. Show the administrator suggested positions based on existing job titles, but do not grant them automatically.

## Content Pipeline for everyone

- Put **Content Pipeline** in every internal team member’s sidebar and allow every internal account to read it.
- Keep editing controlled by position and assignment: people who own content work can edit relevant records; everyone else can follow progress without changing it.
- Align database rules with the interface so Strategy and every other internal position sees the same pipeline records instead of an empty screen.
- Keep shoot-day and sensitive financial details under their own permissions; universal pipeline visibility does not grant Finance, Legal, Resident-management, or System Administration access.

## Position-based dashboards

Every dashboard keeps the shared urgent layer: work due today, overdue work, this week, calendar, To-Do, and the person’s assigned work. Position panels then add the relevant daily view:

- **Founder:** company health, revenue and margin direction, sales coverage, major risks, approvals, sign-offs, department workload, and work assigned.
- **Managing Director:** delivery health, cross-team deadlines, workload, approvals, client risks, finance exceptions, and turnaround time.
- **Operations Manager:** work moving through each stage, average and longest turnaround time, blocked work, overdue handoffs, team capacity, shoot readiness, equipment, and weekly reporting.
- **Finance:** cash requests, payments, invoices due/overdue, cashbook exceptions, budgets, tax filing deadlines, and finance approvals.
- **Legal:** contracts by stage, contracts nearing expiry, approval delays, compliance renewals, documents awaiting action, and contract billing status from Finance.
- **Sales & Partnerships:** pipeline value, next follow-ups, offers awaiting decisions, expected closes, Resident onboarding handoffs, and target progress.
- **Strategy:** strategy maps, goals, monthly targets, approvals, Resident progress, and content-performance signals.
- **Content Creation / Production:** the full production queue, assigned briefs, shoots, editing/review stages, posting schedule, late work, and stage turnaround.
- **Talent:** upcoming shoots and bookings, assigned talent work, agreements/releases needing attention, usage-rights deadlines where recorded, and workload.
- **Communications:** briefs, announcements, scheduled posts, messages needing replies, publishing calendar, approvals, and overdue communications.
- **Designer:** assigned design work, briefs, review/revision queue, delivery dates, stage turnaround, and workload.
- **Events Manager:** upcoming events, readiness, ticket/payment exceptions, staffing, and event deadlines.
- **Site Editor:** website publishing queue, projects, announcements, unresolved Resident links, and recent changes.
- **Gate Scanner / Read-only:** a minimal operational view containing only the tasks, schedule, and records each needs.

Metrics will use existing live records where available. Empty panels will explain what starts producing the metric rather than display invented figures.

## Combined positions

- Default to **All my work**, merging every assigned position’s panels, removing duplicates, and placing urgent or overdue items first.
- Add a compact position switcher so a person can focus on one position without changing their real access.
- Merge sidebar sections for all assigned positions, remove repeated links, and keep Content Pipeline pinned for everyone.
- A per-person dashboard arrangement set by the System Administrator overrides the combined default; otherwise the system merges the saved layouts for all that person’s positions.
- Switching the view filters presentation only. It never expands or removes the person’s approved permissions.

## System Administration

Expand **People & access** into a clear position-control workspace:

- Show name, job title, account state, assigned positions, and common Content Pipeline access.
- Add an edit screen grouped into **Position**, **Workspace access**, and **Approval authority**, rather than one long list of technical roles.
- Add a reset-review queue showing each person’s previous access and suggested new positions, with one-click assignment by the System Administrator.
- Record every assignment, removal, and reset in the action trail with actor, person, before/after values, and time.
- Update the Dashboard Builder to configure each new position and each individual, preview the resulting dashboard/sidebar, and support the combined-layout rules.

## Technical implementation

- Add the base team-member permission and new business positions through a database migration; update helper functions, row-level rules, and server-side admin validation together.
- Keep permissions in the dedicated roles table, separate from profile/job-title data.
- Add an immutable access-change history record for the reset and future edits.
- Update role definitions, route guards, navigation composition, dashboard panel registry, dashboard loading, and the administrator user service.
- Add role panels and turnaround calculations from stage timestamps and existing work, content, contract, finance, shoot, communication, and calendar records.
- Preserve Finance PIN protection: a position may reveal the Finance section, but money pages still require the person’s PIN session.

## Verification

- Test as the sole System Administrator: reset review, assign/remove multiple positions, edit a title, and confirm the action trail.
- Test representative Legal, Strategy, Content, Talent, Finance, Founder, Operations, Communications, and Designer accounts.
- Confirm every internal account can open and read the Content Pipeline while unauthorized edit actions remain blocked.
- Confirm combined-role users get the merged dashboard/sidebar and can switch between position views without changing access.
- Check desktop and 428px mobile layouts, keyboard navigation, no sideways scrolling, code checks, and the preview build.
