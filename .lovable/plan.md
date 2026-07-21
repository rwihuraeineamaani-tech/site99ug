## 1. Fix ticket delivery email

The email provider is rejecting sends with `missing_parameter: text` — the queue payload from `send-ticket-email` only includes `html`. Add a plain-text fallback (`text`) built from the ticket links so the provider accepts it. Redeploy the function, then re-trigger delivery for the order that failed (`rwihuraeineamaani@gmail.com`, ref MANUAL-...) via the admin "Resend tickets" button.

## 2. Trash / restore orders (soft-delete)

Scope: an admin marks an entire order inactive. Its tickets stop working at the gate and it's hidden from active dashboards, but it can be restored.

**Database**
- Add `deleted_at timestamptz` to `orders`.
- Update `get_ticket_by_token` and `tier_sold_count` / `tier_available_counts` to ignore orders where `deleted_at is not null` (trashed orders free their seat and their QR fails scan).
- Update `admin_search_orders` to accept an `_include_trashed boolean` and filter accordingly.

**Admin UI (`EventsAdmin.tsx`)**
- Add a "Trash" button on each order row in the Dashboard pending list and Buyers search results → sets `deleted_at = now()` with a confirm dialog.
- Add a "Trashed" tab listing soft-deleted orders with a "Restore" button (clears `deleted_at`).
- Trashed orders are excluded from stats, pending TID list, and default buyer search.

**Scanner (`ticket-scan` / `TicketScanner.tsx`)**
- Because `get_ticket_by_token` will exclude trashed orders, scanning a trashed ticket returns "not found / invalid" — no code change needed beyond the RPC update.

## Technical notes
- Soft-delete only; no row deletion. Restore is a single UPDATE.
- Email fix is a one-line payload addition + redeploy; no schema change.
