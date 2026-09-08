# Inbox

A new **Inbox** sits directly under Dashboard in the side menu, with an unread count beside it. It is one place for everything addressed to you.

## What lands in it

- **Waiting on you** — ideas needing approval, shoot days to confirm, edits due, client numbers to fill. These are the same jobs the dashboard shows, gathered as items you can open or clear.
- **Shoot briefs** — when a brief is sent for a shoot day you are on, it arrives here with the date, call time, location and the ideas attached.
- **Announcements** — every published studio notice.
- **Client messages** — messages on clients you are the contact or handler for.
- **Messages between people** — anyone signed in can write to one person, to a department, or to the whole team.

## How it works

- A single list, newest first, with filters: All / Unread / Waiting on you / Briefs / Announcements / Messages.
- Unread items are marked; opening one marks it read. "Mark all read" clears the badge.
- Each item links straight to the thing it is about (the idea, the shoot day, the client).
- A "New message" box: pick recipients (a person, a department, or everyone), write a subject and body, send. Replies thread under the original.
- The side menu badge counts unread items only, and refreshes as you work.

## Scope

Staff side only. Clients keep their existing portal messages; those messages continue to appear in the Inbox for the staff who handle that client.

## Technical notes

- New tables: `inbox_messages` (author, subject, body, audience kind — person / department / everyone, target user, department, optional link to a resident, shoot day or content item, parent id for replies) and `inbox_reads` (message id + user id + read time). Both with grants, RLS, timestamps and update triggers. Visibility policy: you can read a message if you are the author, the named recipient, in the named department, or it is addressed to everyone.
- Database triggers fan out the automatic notices: publishing an announcement, sending a shoot brief (`shoot_days.brief_sent_at`), and a new `messages` row on a client each insert an `inbox_messages` row addressed to the right people.
- "Waiting on you" items are not stored — they are derived live from the same queries the dashboard already runs (`src/pages/app/Dashboard.tsx` job builders move into `src/lib/inbox.ts` so both pages share them), then merged into the feed by timestamp.
- New page `src/pages/app/Inbox.tsx` at `/app/inbox`, guarded by the `staff` gate in `src/App.tsx`, built from the existing deck primitives so it matches the dark portal.
- New hook `src/hooks/useInbox.ts` provides the feed and unread count; `src/components/system/AppShell.tsx` adds the nav item under Dashboard and renders the badge.
- No changes to existing tables beyond the new triggers.
