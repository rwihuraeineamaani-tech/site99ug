# Separate Chat, Briefs, Announcements, and To-Do

## Goal
Turn the current mixed Inbox into clear work areas:

- **Chat** for private one-to-one conversations with staff and clients
- **Briefs** for proper shoot/client brief documents
- **Announcements** for studio-wide notices
- **To-Do** for every action assigned to the signed-in person

The existing Inbox currently combines these item types and also includes content tasks. The new structure will keep each type distinct and easier to open, read, and act on.

## Navigation
Add these entries directly below Dashboard:

1. **To-Do** — badge shows outstanding tasks
2. **Chat** — badge shows unread conversations
3. **Briefs** — badge shows unread/new briefs
4. **Announcements** — badge shows unread/new announcements
5. **Approvals** and **Calendar** remain separate

Remove “Waiting on you” from Inbox and remove its full card column from Dashboard. The Dashboard will retain a compact To-Do count/link so it still provides a useful morning summary without duplicating the task board.

## Chat
Build database-backed, private conversations with one stable conversation per person.

- Conversation list showing the person, staff/client label, latest message, time, and unread count
- New-chat button that opens a searchable people picker
- Staff can start chats with other staff and linked client contacts
- Client portal users can chat with their assigned Site 99 team through the same conversation system
- Dedicated conversation URLs such as `/app/chat/:threadId`; opening, switching, or refreshing keeps the correct conversation
- Standard chat screen with message history, timestamps, unread state, composer, send state, and clear empty/error states
- Chat button available in the Chat header and on relevant staff/client records
- Mobile layout opens the conversation cleanly and returns to the conversation list
- Migrate or preserve access to existing resident-office messages so earlier communication is not lost

## Briefs
Create a dedicated `/app/briefs` register and `/app/briefs/:id` detail view.

- List briefs with client, shoot date/context, author, created date, attachment state, and unread state
- Opening a brief shows a standard document layout: title, client, date, full body, linked shoot/content, attachments, and actions
- Link shoot-day brief notifications to the actual brief detail rather than expanding generic Inbox text
- Client portal Briefs opens the same underlying brief record with client-safe actions and permissions
- Keep brief creation in the existing operational workflow; this work improves delivery, reading, and deep linking rather than duplicating brief ownership

## Announcements
Create a dedicated `/app/announcements` feed and `/app/announcements/:id` detail view.

- Published announcements appear as a clean dated feed, separate from direct messages
- Opening one shows the full notice, author/publisher, publish date, and read state
- Leadership continues to create drafts and publish from Management
- Staff and clients only see announcements allowed by their existing access rules
- Notification items deep-link to the announcement itself

## To-Do
Create `/app/todo` as the signed-in person’s complete action centre.

- **Card view** by default, reusing the stronger WaitingCard treatment
- **List view** as an alternate compact mode; remember the selected view in the browser
- Filters for All, Overdue, Today, Next up, Content, Shoots, Approvals, Strategy, Finance, and Operations
- Group and sort by urgency, then due date
- Each item shows action, title, client/project, source, stage/status, due date, and an Open action
- Safe quick actions remain available where the current workflow already permits them
- Include current content-stage work, assigned shoot duties, account-number deadlines, finance/strategy/content approvals, operational deadlines, and other records that explicitly identify the current user as responsible
- Do not copy tasks into a second editable table: derive them from their source records so completion and permissions stay authoritative
- Sidebar badge and Dashboard count use the same unified task result

## Backend and permissions
- Add conversation/thread and message storage with row-level access for participants only
- Store participant membership separately so conversations cannot be discovered by unrelated users
- Add per-user read state for chat, briefs, and announcements
- Link notifications to real brief/announcement/chat records using stable identifiers
- Extend client access carefully: clients can only see their own conversations and client-visible briefs/announcements
- Staff visibility follows existing roles and client assignments; no client can search or contact unrelated clients
- Add explicit grants, indexes, timestamps, and participant-checked database policies for every new table

## Technical implementation
- Split the existing Inbox responsibilities into focused hooks and pages while retaining compatibility with existing notifications during migration
- Add shared detail-page components for document metadata, attachments, read state, and deep links
- Add a unified typed task adapter that combines existing workflow sources without changing their approval/business rules
- Route Chat, Briefs, Announcements, and To-Do through staff access guards; expose the permitted chat/brief/announcement views in the client portal
- Update unread/task badge hooks to avoid duplicate full-page queries in the sidebar
- Preserve the current dark/light design tokens, app shell, buttons, status chips, and mobile navigation behavior

## Verification
- Create two staff/client conversations, send messages in both directions, reload each dedicated URL, and confirm histories remain isolated
- Verify unrelated users cannot read or send into another conversation
- Open a brief and announcement from their lists and from a notification, confirming the same full detail record appears
- Verify staff/client visibility for briefs and announcements
- Compare To-Do totals with the Dashboard badge and underlying content, shoot, approval, strategy, finance, and deadline records
- Test card/list switching, filters, quick actions, unread counts, desktop, and mobile layouts
- Run type checks, build checks, and authenticated browser walkthroughs for staff and client views
