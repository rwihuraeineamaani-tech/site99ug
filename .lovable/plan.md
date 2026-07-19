# Event Ticketing — Pesapal (Uganda MoMo + Airtel)

Direct-to-merchant ticketing with Pesapal handling MTN MoMo, Airtel Money, and card at checkout. Funds settle to the payout account configured in your Pesapal dashboard (bank or MoMo merchant number). QR tickets by email, door-scan check-in, admin CRUD + sales dashboard.

## User flows

**Buyer**
1. Browses `/events`, opens an event
2. Picks tier + quantity, enters name + email + phone
3. Redirected to Pesapal hosted checkout → selects MTN MoMo / Airtel / card → pays
4. Returns to `/tickets/thanks?order=…`; QR ticket(s) also emailed
5. Ticket page shows a signed QR per seat

**Admin**
- `/admin` gets an **Events** tab: create/edit event (title, slug, venue, date, cover, description), add ticket tiers (name, price UGX, capacity)
- **Sales** tab: revenue, tickets sold, per-event breakdown, CSV export
- `/admin/scan`: camera QR scanner marks tickets `used` at the door

## Data model (new tables)

- `events` — slug, title, description, venue, starts_at, ends_at, cover_url, published, created_by
- `ticket_tiers` — event_id, name, price_ugx, capacity, sort
- `orders` — event_id, buyer_name, buyer_email, buyer_phone, amount_ugx, status (`pending|paid|failed|cancelled`), pesapal_tracking_id, pesapal_merchant_reference
- `tickets` — order_id, tier_id, holder_name, qr_token (random 32-byte, unique), status (`valid|used|void`), used_at, used_by

RLS: anon can read `events`/`ticket_tiers` where `published = true`; a ticket is readable only by its `qr_token` (fetched via a security-definer function scoped to a single token — no bulk enumeration); admins full CRUD; orders/tickets writes only via edge functions.

## Edge functions

- `pesapal-checkout` — auth: public. Validates cart, creates `orders` + reserved `tickets` (pending), calls Pesapal `Auth/RequestToken` → `Transactions/SubmitOrderRequest`, returns `redirect_url`.
- `pesapal-ipn` — auth: public (Pesapal IPN URL). On notification, fetches `GetTransactionStatus`, flips order to `paid`/`failed`. On paid: activates tickets, enqueues confirmation email with QR links.
- `ticket-scan` — auth: admin only. Accepts qr_token, atomically marks `valid → used`, returns holder + tier.

## Payment provider setup

You'll be prompted to save three secrets (Pesapal dashboard → API keys):
- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_ENV` (`sandbox` or `live`)

After first deploy I'll register the IPN URL against your account and store `PESAPAL_IPN_ID`. Payout to your MoMo/Airtel merchant number is configured inside Pesapal itself (Settlement Accounts), not in code.

## Pages / files

- `src/pages/Events.tsx`, `src/pages/EventDetail.tsx`, `src/pages/TicketView.tsx`, `src/pages/ThankYou.tsx`
- `src/pages/admin/EventsAdmin.tsx`, `src/pages/admin/SalesDashboard.tsx`, `src/pages/admin/Scanner.tsx` (uses `html5-qrcode`)
- Nav: add **Events** to the inline links and Services menu isn't affected
- `supabase/functions/pesapal-checkout`, `pesapal-ipn`, `ticket-scan`

## Out of scope for v1

- Refunds (handled manually in Pesapal dashboard for now)
- Reserved seating maps
- Discount codes / early-bird auto-switching
- Passing tickets between wallets

Ready to build once you approve — I'll request the three Pesapal secrets right after the DB migration lands.