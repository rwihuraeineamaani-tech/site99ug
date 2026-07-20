## 1. Nav bar — only Services and About

In `src/components/Nav.tsx`, replace the `inlineLinks` array (currently Residents, Projects, Events, About) with just:

- Services (existing hover dropdown, stays on the left)
- About (right)

Residents, Projects, and Events remain reachable from the burger overlay menu and from the Services dropdown, so nothing becomes orphaned.

## 2. Add "Ticketing" as a service

Two edits:

- `src/components/Nav.tsx` — add `{ to: "/services#ticketing", label: "Event Ticketing" }` to the `services` dropdown array.
- `src/pages/Services.tsx` — add a new section with `id="ticketing"` describing event ticketing (MoMo + Airtel Money via Pesapal, QR check-in, tier pricing, scanner for gate). End with a CTA button linking to `/events` (public directory) and a note that admins manage events at `/admin/events`.

## 3. Fix Events admin image upload

Currently `src/pages/EventsAdmin.tsx` only has a text field for `cover_url`. Mirror the pattern already working in `src/pages/Admin.tsx`:

- Add an `uploadFile` helper that uploads to the existing public `project-images` bucket under an `events/` prefix and returns the public URL.
- Replace the "Cover image URL" text input with a file picker (`<input type="file" accept="image/*">`) that uploads on change, sets `form.cover_url`, shows a small preview, and offers a Clear button. Keep a fallback URL field for pasting an existing link.
- Add `uploading` state to disable Save while an upload is in flight and toast success/error.

No schema or bucket changes needed — `project-images` is already public and the admin has write access.

## 4. Payment checkout & confirmation — options overview

You asked what other checkout/confirmation methods exist. Today the site uses **Pesapal hosted checkout + IPN callback**. Here's the landscape, no code changes in this plan — pick one and we'll wire it as a follow-up:

**Checkout entry points (how the buyer pays)**
- Pesapal hosted page (current) — buyer is redirected to Pesapal, picks MoMo / Airtel / card, comes back. Zero PCI scope.
- Pesapal Express / Direct API — keep the buyer on our site; we render our own MoMo/Airtel form and call Pesapal server-side. More design control, more edge cases.
- Flutterwave Standard — alternative aggregator, same MoMo/Airtel/card mix, slightly different fee card.
- Direct MTN MoMo Collections API + Airtel Money Collections API — no aggregator, lower fees, but you manage two integrations and settlement per telco.

**Confirmation methods (how we know it's paid)**
- IPN webhook (current) — Pesapal POSTs to `pesapal-ipn` when status changes. Requires the endpoint to be publicly reachable (it is).
- Return-URL poll — on the thank-you page, call `GetTransactionStatus` ourselves. Good as a **belt-and-braces backup** to IPN so a delayed webhook doesn't leave an order "pending" for the buyer.
- Scheduled reconciliation — a cron edge function that sweeps `orders` in `pending` older than N minutes and asks the provider for status. Catches missed IPNs.
- Manual admin action — an admin button in `/admin/events` to force-check an order or mark it paid.

**Buyer notifications (separate from confirmation)**
- Email receipt + ticket QR via the existing email queue on successful payment.
- SMS via Africa's Talking / Twilio to the buyer's phone number.
- WhatsApp Business template message with the QR link.

Recommendation to discuss next turn: keep Pesapal hosted checkout, and add (a) return-URL status poll on the thank-you page and (b) a nightly reconciliation cron. That closes the "stuck pending" gap without changing the payment surface.

## Out of scope for this plan

- PDF uploads (you said leave it for now).
- Any change to the Projects admin uploader (it's working).
- Building the payment options above — this plan only lists them.

## Technical notes

- Nav change is a one-array edit; the burger overlay `links` array stays untouched so nothing is unreachable.
- Events cover upload reuses the existing `project-images` bucket + its public RLS; no migration required.
- Services page section IDs are already anchor targets, so `/services#ticketing` will scroll correctly.
