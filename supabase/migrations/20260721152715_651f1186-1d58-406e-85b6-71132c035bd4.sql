
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS policy text,
  ADD COLUMN IF NOT EXISTS age_limit integer,
  ADD COLUMN IF NOT EXISTS pesapal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gallery text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_age integer;

CREATE INDEX IF NOT EXISTS orders_buyer_name_trgm_idx ON public.orders USING gin (buyer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tickets_holder_name_trgm_idx ON public.tickets USING gin (holder_name gin_trgm_ops);
