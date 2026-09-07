# Command deck: a personal dashboard for every person and every department

Turn the overview screen and each department landing page into a dark, high-contrast "command deck" that opens with what that specific person has to do today.

## The look

A dark control-room surface used only inside the signed-in system — the public site stays exactly as it is.

- Near-black background, one step lighter for panels, light grey text, the Site 99 red as the single signal colour.
- Big numbers, hairline rules, tight grid, quiet motion: panels fade up in sequence on load, numbers count up once, hover lifts a card slightly.
- A live clock and date in Kampala time in the header, plus a greeting by first name that changes with the hour.
- Everything keeps the existing rounded corners, spacing and chips so the rest of the system still feels like one product.

## What each person sees first

The top of the overview is a "before you start" strip, built from that person's roles and their own assignments:

1. **Waiting on you** — only the items they personally can move, each with the one-press action that moves it on (approve, crew it, shoot done, send to review, post it, add the numbers). Counted and pinned at the top.
2. **Today** — shoots dated today or overdue, content due, weekly numbers to fill, payment approvals waiting, deadlines from ops. One list, sorted by time.
3. **My numbers** — their own retainer share this month, items they delivered this month, items they still owe, and their approval turnaround. Personal figures only; client and company totals stay with finance and leadership.
4. **Team pulse** — latest announcements, who is on shoot today, and anything blocked for more than three days. Read-only for everyone.

Below that, the department cards they already have access to, each now showing a live count (open content, requests waiting, contracts expiring) instead of a static blurb.

Role shaping:
- Founders and leadership additionally get approvals, money-in-vs-out this month and anything stalled across the studio.
- Crew see their shoots, their edits and their gear list first.
- Client-relations people see their clients' pending weeks and posting gaps first.
- Finance people see requests and payments due first; people without money access never see any of it.
- A brand-new person with nothing assigned sees a short "here's how to start" panel instead of empty lists.

## Department landing pages

Content, Finance, Ops and Legal overviews get the same treatment: a header row of live figures for that department, a "waiting on you here" list scoped to that department, and then the existing sections. No new data is invented — each figure is read from what is already stored.

## Technical notes

- Add a `deck` dark theme scope in `index.css` as semantic tokens (surface, panel, rule, ink, ink-soft, signal, glow) applied by a wrapper class inside `AppShell`, so no component hardcodes colours.
- New `src/components/deck/` primitives: `DeckHeader` (greeting, clock, role chips), `DeckStat` (animated figure), `DeckPanel`, `TaskRow` (title, why, one-press action), `PulseFeed`.
- New `src/lib/deck.ts` builds the personal task list from content items, shoot days, pending account weeks, finance requests and ops deadlines, gated by `useMyRoles` and `useMyAssignments`. The existing `waiting` logic in `Dashboard.tsx` moves here and is reused by the department pages.
- Add read-only helper functions in the database for the personal month figures (delivered count, owed count, turnaround) so a single call replaces several client-side queries; readable by the signed-in user for their own rows only.
- Motion via CSS transitions and a small count-up hook — no new animation library.
- Refactor `src/pages/app/Dashboard.tsx` to compose the new panels; department overviews reuse the same primitives through `SectionPage`.
