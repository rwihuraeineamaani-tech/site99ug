
CREATE OR REPLACE FUNCTION public.tier_available_counts(_event_id uuid)
RETURNS TABLE(tier_id uuid, available int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tt.id,
    GREATEST(0, tt.capacity - COALESCE((
      SELECT count(*)::int FROM public.tickets t
      JOIN public.orders o ON o.id = t.order_id
      WHERE t.tier_id = tt.id AND o.status IN ('paid','pending')
    ), 0))
  FROM public.ticket_tiers tt WHERE tt.event_id = _event_id;
$$;

REVOKE ALL ON FUNCTION public.tier_available_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tier_available_counts(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_search_orders(_q text, _event_id uuid DEFAULT NULL, _limit int DEFAULT 25)
RETURNS TABLE(
  order_id uuid, buyer_name text, buyer_email text, buyer_phone text,
  amount_ugx int, status text, payment_method text, event_id uuid,
  event_title text, ticket_count bigint, created_at timestamptz, similarity real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.buyer_name, o.buyer_email, o.buyer_phone,
    o.amount_ugx, o.status, o.payment_method, o.event_id, e.title,
    (SELECT count(*) FROM public.tickets t WHERE t.order_id = o.id),
    o.created_at,
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
$$;

REVOKE ALL ON FUNCTION public.admin_search_orders(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_orders(text, uuid, int) TO authenticated;
