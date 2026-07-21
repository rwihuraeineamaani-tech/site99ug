
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_deleted_at_idx ON public.orders (deleted_at);

CREATE OR REPLACE FUNCTION public.get_ticket_by_token(_token text)
 RETURNS TABLE(ticket_id uuid, holder_name text, status text, tier_name text, event_title text, event_venue text, event_starts_at timestamp with time zone, event_slug text, qr_token text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.holder_name, t.status, tt.name, e.title, e.venue, e.starts_at, e.slug, t.qr_token
  FROM public.tickets t
  JOIN public.ticket_tiers tt ON tt.id = t.tier_id
  JOIN public.events e ON e.id = tt.event_id
  JOIN public.orders o ON o.id = t.order_id
  WHERE t.qr_token = _token AND o.status = 'paid' AND o.deleted_at IS NULL
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.tier_sold_count(_tier_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM public.tickets t
  JOIN public.orders o ON o.id = t.order_id
  WHERE t.tier_id = _tier_id AND o.status IN ('paid','pending') AND o.deleted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.tier_available_counts(_event_id uuid)
 RETURNS TABLE(tier_id uuid, available integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tt.id,
    GREATEST(0, tt.capacity - COALESCE((
      SELECT count(*)::int FROM public.tickets t
      JOIN public.orders o ON o.id = t.order_id
      WHERE t.tier_id = tt.id AND o.status IN ('paid','pending') AND o.deleted_at IS NULL
    ), 0))
  FROM public.ticket_tiers tt WHERE tt.event_id = _event_id;
$function$;

CREATE OR REPLACE FUNCTION public.admin_search_orders(_q text, _event_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 25, _include_trashed boolean DEFAULT false)
 RETURNS TABLE(order_id uuid, buyer_name text, buyer_email text, buyer_phone text, amount_ugx integer, status text, payment_method text, event_id uuid, event_title text, ticket_count bigint, created_at timestamp with time zone, deleted_at timestamp with time zone, similarity real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.buyer_name, o.buyer_email, o.buyer_phone,
    o.amount_ugx, o.status, o.payment_method, o.event_id, e.title,
    (SELECT count(*) FROM public.tickets t WHERE t.order_id = o.id),
    o.created_at, o.deleted_at,
    GREATEST(
      similarity(coalesce(o.buyer_name,''), _q),
      similarity(coalesce(o.buyer_email,''), _q),
      CASE WHEN o.buyer_phone ILIKE '%'||_q||'%' THEN 0.9 ELSE 0 END,
      CASE WHEN o.pesapal_merchant_reference ILIKE '%'||_q||'%' THEN 0.95 ELSE 0 END,
      CASE WHEN o.manual_tid ILIKE '%'||_q||'%' THEN 0.95 ELSE 0 END
    ) AS sim
  FROM public.orders o
  JOIN public.events e ON e.id = o.event_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND (_include_trashed OR o.deleted_at IS NULL)
    AND (_event_id IS NULL OR o.event_id = _event_id)
    AND (
      o.buyer_name % _q OR o.buyer_email ILIKE '%'||_q||'%'
      OR o.buyer_phone ILIKE '%'||_q||'%'
      OR o.pesapal_merchant_reference ILIKE '%'||_q||'%'
      OR o.manual_tid ILIKE '%'||_q||'%'
      OR similarity(coalesce(o.buyer_name,''), _q) > 0.2
    )
  ORDER BY sim DESC, o.created_at DESC
  LIMIT _limit;
$function$;
