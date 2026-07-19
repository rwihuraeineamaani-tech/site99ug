
-- Fix security definer view finding
ALTER VIEW public.public_residents SET (security_invoker = true);

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  venue text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  cover_url text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published events" ON public.events FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage events" ON public.events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ticket tiers
CREATE TABLE public.ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_ugx integer NOT NULL CHECK (price_ugx >= 0),
  capacity integer NOT NULL CHECK (capacity >= 0),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ticket_tiers(event_id);
GRANT SELECT ON public.ticket_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated;
GRANT ALL ON public.ticket_tiers TO service_role;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tiers of published events" ON public.ticket_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (e.published = true OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "admins manage tiers" ON public.ticket_tiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ticket_tiers_updated BEFORE UPDATE ON public.ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  amount_ugx integer NOT NULL CHECK (amount_ugx >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  pesapal_tracking_id text,
  pesapal_merchant_reference text UNIQUE,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orders(event_id);
CREATE INDEX ON public.orders(pesapal_tracking_id);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read orders" ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT,
  holder_name text,
  qr_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','used','void')),
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tickets(order_id);
CREATE INDEX ON public.tickets(tier_id);
GRANT SELECT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read tickets" ON public.tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public lookup by qr_token (single-token, no enumeration)
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(_token text)
RETURNS TABLE(
  ticket_id uuid, holder_name text, status text, tier_name text,
  event_title text, event_venue text, event_starts_at timestamptz, event_slug text,
  qr_token text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.holder_name, t.status, tt.name, e.title, e.venue, e.starts_at, e.slug, t.qr_token
  FROM public.tickets t
  JOIN public.ticket_tiers tt ON tt.id = t.tier_id
  JOIN public.events e ON e.id = tt.event_id
  JOIN public.orders o ON o.id = t.order_id
  WHERE t.qr_token = _token AND o.status = 'paid'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO anon, authenticated;

-- Buyer-visible order lookup (by merchant_reference; used on thank-you page)
CREATE OR REPLACE FUNCTION public.get_order_summary(_ref text)
RETURNS TABLE(
  order_id uuid, status text, amount_ugx integer, buyer_email text,
  event_title text, event_slug text, ticket_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.status, o.amount_ugx, o.buyer_email, e.title, e.slug,
    (SELECT count(*) FROM public.tickets t WHERE t.order_id = o.id)
  FROM public.orders o
  JOIN public.events e ON e.id = o.event_id
  WHERE o.pesapal_merchant_reference = _ref
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_summary(text) TO anon, authenticated;

-- Ticket count helper for tier remaining
CREATE OR REPLACE FUNCTION public.tier_sold_count(_tier_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.tickets t
  JOIN public.orders o ON o.id = t.order_id
  WHERE t.tier_id = _tier_id AND o.status IN ('paid','pending');
$$;
GRANT EXECUTE ON FUNCTION public.tier_sold_count(uuid) TO anon, authenticated;
