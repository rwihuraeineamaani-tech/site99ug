# Quick actions on the idea cards

Right now every decision lives inside the card: you have to open an idea, scroll to the step panel and press the button there. On the Idea stage the Approve button also stays greyed out until at least one crew role has been added, which is why approving looks like it is missing.

## What changes

1. **Approve without naming the crew first.** On an idea, Approve becomes pressable straight away. If no roles were chosen, the idea moves to Approved and the client's contact person is asked to fill the production team — exactly the path that already exists. Naming roles up front still sends it straight to Crewed.

2. **Quick action buttons on the board cards.** Each card gets a small row of buttons at the bottom, only for the people allowed to act at that stage, and only for actions that need no extra typing:

   - Idea (founders): Approve, Reject
   - Approved (founders, contact person): Fill the crew — opens the card
   - Crewed / Scheduled (management): Open shoot days
   - Shooting (founders, contact person): Shoot done
   - Editing (founders, the editor): Add the cut — opens the card
   - Review (founders): Review it — opens the card
   - Handover (handler, founders): Add post links — opens the card
   - Posted (handler, founders): Add the numbers — opens the card

   Anything that needs a link, a date, platforms or numbers opens the card on the right step instead of firing blind. Buttons never trigger when you click the card body.

3. **Same buttons in list view.** The list gets one "Next step" column with the same button, so both views behave the same.

4. **Dashboard "Waiting on you"** rows get the same one-press action where it needs no typing (approve, shoot done).

## Technical notes

- Extract the per-stage permission logic currently inlined in `stepPanel()` into a helper (`quickAction(item)`) in `Content.tsx` that returns `{ label, run }` or `{ label, opens: true }`, computed against `isFounder`, the item's resident contact/handler and the crew rows.
- Crew rows are only loaded for the open item today; for cards, the editor check falls back to `content_items.editor` / crew fetched once per board load in a single `content_crew` query keyed by content id.
- Card buttons call `advance()` with `stopPropagation`, then refresh the board.
- No database or stage-guard changes — every quick action is a transition the guard already allows.
