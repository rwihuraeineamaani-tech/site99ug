
## Goal
Let admins manually deliver tickets by copying the composed email content and each ticket's QR token from the admin dashboard — no automatic send required.

## Changes

### 1. `EventsAdmin.tsx` — new "Copy for manual send" action
For each paid order (in Pending TIDs, Buyers search, and confirmed orders), add a **Copy ticket details** button next to the existing "Resend tickets" / "Confirm & Email" actions.

Clicking it opens a modal (shadcn `Dialog`) showing:
- **To**: buyer email
- **Subject**: `Your ticket(s) — <event title>`
- **Body (plain text)**: the same text block currently built inside `send-ticket-email` (greeting, event title, date, venue, per-ticket lines) — but instead of PDF links, list each ticket with its QR token URL: `https://site99ug.com/t/<qr_token>`
- **Per-ticket QR data**: for each ticket a row showing
  - Holder name · Tier
  - QR token value (raw string)
  - QR payload URL (`https://site99ug.com/t/<qr_token>`) — this is what the scanner reads
  - Individual "Copy" buttons for the raw token and the URL

Each section has its own **Copy** button (uses `navigator.clipboard.writeText`) with a toast confirmation.

### 2. Data source
Fetch on modal open:
- `orders` row (already loaded)
- `events` row (title, venue, starts_at, organizer_name, organizer_socials, sender_from_email)
- `tickets` for the order with `holder_name, qr_token, ticket_tiers(name)`

Compose the email text client-side using the same format as `send-ticket-email/index.ts` so the copied text matches what the automatic sender would produce, minus the PDF link (replaced by the `/t/<token>` view URL).

### 3. No backend / schema changes
Purely a frontend admin convenience. `send-ticket-email` stays as-is for when email delivery works.

## Technical notes
- New file: `src/components/admin/CopyTicketDialog.tsx` holding the dialog + copy helpers.
- Import and mount it from `EventsAdmin.tsx` where order rows render; pass `orderId`.
- Use existing `useToast` for copy feedback.
- QR content shown is exactly what `send-ticket-email` embeds today: `${PUBLIC_SITE}/t/${qr_token}` (so any QR generator the user picks will produce a scannable code).
