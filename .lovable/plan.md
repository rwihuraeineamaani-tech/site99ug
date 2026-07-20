# Fix ticket system — missing table grants

## Root cause (verified)

The four ticket tables (`events`, `ticket_tiers`, `orders`, `tickets`) have RLS policies but **zero `GRANT`s** to `anon`, `authenticated`, or `service_role`. Confirmed via `information_schema.role_table_grants` returning an empty set for all four tables. Supabase's Data API requires explicit grants in addition to RLS — without them every request returns `permission denied for table ...`.

Effect on the user: on `/events/:slug`, the anon read of `ticket_tiers` returns 0 rows, so no tier options render, the Total stays at UGX 0, and the "Pay with MoMo / Airtel" button stays disabled. Same failure blocks admin CRUD in `/admin/events` for `authenticated` users, and would block the edge function from writing orders/tickets under `service_role`.

## Fix (one migration)

Add grants matching the existing policies:

```sql
-- Public reads for the storefront (policies already restrict to published rows)
GRANT SELECT ON public.events        TO anon, authenticated;
GRANT SELECT ON public.ticket_tiers  TO anon, authenticated;

-- Admin CRUD (policies already restrict to admins via has_role)
GRANT INSERT, UPDATE, DELETE ON public.events       TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated;

-- Edge functions (pesapal-checkout / pesapal-ipn / ticket-scan)
GRANT ALL ON public.events, public.ticket_tiers, public.orders, public.tickets TO service_role;

-- Admin dashboards read orders + tickets (policies already restrict to admins)
GRANT SELECT ON public.orders  TO authenticated;
GRANT SELECT ON public.tickets TO authenticated;
```

No schema, policy, or code changes. Existing RLS remains the source of row-level authorization.

## Verification after migration

1. Load `/events/{slug}` as an anon visitor — tier rows appear, +/- buttons update the total.
2. In `/admin/events`, create/edit an event and add a tier — success toasts, no permission errors.
3. Trigger checkout — `pesapal-checkout` inserts the order + reserved tickets and returns a `redirect_url`.

If checkout still fails after the grants land, I'll pull `pesapal-checkout` logs to diagnose (Pesapal auth, IPN registration, etc.) — that would be a separate follow-up, not part of this fix.
