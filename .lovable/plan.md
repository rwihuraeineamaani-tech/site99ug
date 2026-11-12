# Client calendar, client approvals and client shoot days

## 1. "Client view" calendar inside each client's profile (staff side)
On every client's card in Residents, a new **Client view** tab shows the same calendar the client sees in their portal, so staff can check exactly what the client sees.

Colour of each item on the calendar:

| Colour | Meaning |
|---|---|
| Green tick | Posted |
| Yellow | Not edited yet (Idea up to Shooting, plus Editing) |
| Red | Posted, but the numbers (views, likes) are overdue after 10 days |
| Red outline with a cross | Rejected by the team, or the client asked for changes |
| Blue "Your turn" | Waiting for the client to approve |
| Grey with a stage label | Any other stage, for example "Handover" or "Review" |

The same colours and a small key show in the client's own portal calendar.

## 2. Client approval switch (set per client)
- New setting in the client's profile: **Client approves content: On / Off**. Staff with client edit rights set it.
- **On:** videos in Review show in the client's portal as a to-do ("Approve this video") on their dashboard and calendar.
- Each to-do shows a **Watch on Google Drive** button (the cut link), plus caption (editable), collab account with a profile link, tags and the posting window. The client can reject the collab or tags, as they can today.
- **Approve** moves the video straight to **Handover** and tells the handler.
- **Ask for changes** sends it back to Editing with the client's note.
- **Off:** the team's current flow is unchanged and the client only sees progress.
- If the client takes too long, only **System Admin** gets an **Approve for client** button. It is recorded in the history as an override.

## 3. Client shoot day page
Clicking a shoot day in the client's portal opens a full page:
- Date, call time, location, map link, who from Site 99 is coming.
- Videos planned for that day: title, idea and the look.
- **What we need from you**: a list of items (products, outfits, access, people), each with a status (needed, ready, provided).
- **Budget and costs for you**: items the client is asked to pay for or supply, with prices and a total.
- **Download client brief (PDF)**.

Staff shoot day screen gets:
- A "What we need from the client" editor (item, quantity, price, who pays, note, show to client yes/no).
- Two downloads: **Client copy PDF** (no internal costs, crew pay or notes) and **Team copy PDF** (everything).

## 4. Other things we can add for clients (suggestions, not part of this build)
- Monthly performance report: posted count, views and best video, as a PDF.
- Asset upload box: clients drop logos, product photos and price lists for the team.
- Content request: the client suggests an idea that goes into the pipeline as an Idea.
- Shoot day RSVP: the client confirms or asks to move a date.
- Post-shoot rating and feedback (1 to 5) after each shoot.
- Payment reminder with a pay-now note on unpaid invoices.
- WhatsApp or email alerts when something needs their approval.

## Technical details
- `residents.client_approves_content boolean default false`.
- A DB helper maps each item to a calendar status: `posted`, `numbers_due` (Posted, no metrics, more than 10 days since `posted_at`), `rejected` / `changes`, `awaiting_client`, `not_edited`, `other`. The portal and the staff "Client view" both use it, so they always match.
- `client_review_content` RPC: on approve, when the client has approval switched on and the item is in Review, set stage to Handover and notify the handler. On changes, return it to Editing. New `admin_override_client_approval(item_id, note)` is allowed only for `is_system_admin`, and writes the audit record.
- New table `shoot_day_client_needs` (shoot_day_id, item, qty, unit_price_ugx, payer, status, visible_to_client, note) with grants and RLS: staff edit, the portal client reads only visible rows for their own shoot days.
- New portal route `/portal/shoots/:id`. PDFs use the existing branded PDF helper, in client and team variants.
- Staff preview reuses the portal calendar component, with the resident id passed in rather than read from the logged-in client.

## Assumptions to confirm
- "Due numbers" means a posted video whose numbers haven't been entered after 10 days.
- Approval switch defaults to Off for existing clients, so nothing changes until you switch it on per client.
