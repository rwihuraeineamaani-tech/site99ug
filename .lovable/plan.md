# Personal, private-by-default work calendar

## Goal
Turn the existing studio schedule into a normal personal work calendar where each person can add precise timed or all-day items, keep details private by default, optionally share full details with the team, receive in-app reminders, and connect events to existing Site 99 work.

## Experience
- Replace the narrow “I’m busy” action with a clear **New item** flow while retaining availability controls.
- Let a person enter a title, date, start and end time, all-day state, location, notes, recurrence, reminder time, and optional linked work.
- Default every new item to **Private**.
- Offer two visibility choices:
  - **Private:** only the owner sees the title, notes, location, reminder, and linked work; teammates see only “Busy” and its time when viewing or scheduling that person.
  - **Team:** authenticated staff can see the event details.
- Keep the existing **Warn only / Do not schedule** choice so calendar items can inform or prevent scheduling.
- Support one-off, daily, weekly, and monthly repetition with an end date or occurrence count.
- Allow items to be opened, edited, duplicated, or deleted from month and week views.

## Calendar views and time handling
- Expand the week view into a time-based day schedule with events positioned by start and end time, plus an all-day row.
- Keep the month overview, but show start times and open a day agenda instead of hiding detail after three items.
- Add an agenda view for upcoming work and personal items in chronological order.
- Use Kampala time consistently for creation, display, “now,” reminder timing, overdue states, and cross-midnight events.
- Detect invalid ranges and visibly flag overlapping items without exposing private details.

## Work integration
- Continue merging shoots, content dates, metrics deadlines, and studio events into the calendar.
- Allow a personal item to link to an existing client, shoot, content item, To-Do item, brief, approval, strategy item, invoice, or other supported work record.
- Show a contextual **Open work** action on linked items while preserving the linked record’s existing permissions.
- Include personal calendar items in dashboard Today/This week summaries using the same privacy rules.

## Reminders
- Add owner-only in-app reminders such as at start time, 5/15/30 minutes before, 1 hour before, 1 day before, or a custom time.
- Surface due reminders in the existing in-app experience and mark them read/dismissed without emailing anyone.
- Derive whether a reminder is due from its stored timestamp; no recurring background job is needed.

## Privacy and scheduling safeguards
- Store full calendar-item details behind owner/team visibility rules, with private as the database default.
- Expose a separate, deliberately minimal busy-time record to teammates for private items so row access can never reveal hidden titles, notes, locations, reminders, or work links.
- Derive ownership from the signed-in account; never accept another owner ID from the form.
- Update scheduling conflict checks so staff items marked “Do not schedule” are enforced, while leadership retains the existing recorded override flow.
- Ensure deleting, changing visibility, or changing recurrence updates the corresponding busy-time signal.

## Technical changes
- Add calendar item, reminder/read-state, work-link, and private busy-projection structures through a database migration with grants, row-level access rules, indexes, timestamp validation triggers, and secure recurrence/conflict helpers.
- Keep client-side calendar types, recurrence utilities, and the combined calendar loader aligned with the database rules.
- Add focused event/editor and agenda components rather than overloading the current availability dialog.
- Preserve existing client availability blocks and shoot-scheduling behavior while correcting staff hard-block enforcement.

## Verification
- Create private and team-visible timed items, recurring items, all-day items, and linked-work items as a signed-in user.
- Verify the owner sees full private details and another staff account sees only “Busy” with the occupied time.
- Verify team-visible items expose their intended details, while editing/deleting remains owner-controlled.
- Verify reminders appear at the correct Kampala time and can be dismissed.
- Verify staff hard blocks prevent conflicting shoot scheduling and the existing leadership override is recorded.
- Walk month, week, agenda, dashboard summaries, mobile layout, filters, editing, deletion, recurrence, and linked-work navigation end to end.
