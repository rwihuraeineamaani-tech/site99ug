CREATE OR REPLACE FUNCTION public.set_client_pay(_resident_id uuid, _retainer_ugx integer, _people jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer := 0;
  contacts integer := 0;
  p jsonb;
  amt integer;
BEGIN
  IF NOT public.can_see_finance(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF _retainer_ugx < 0 THEN
    RAISE EXCEPTION 'The retainer cannot be negative.' USING ERRCODE = '22004';
  END IF;

  FOR p IN SELECT * FROM jsonb_array_elements(COALESCE(_people, '[]'::jsonb)) LOOP
    IF (p->>'kind') NOT IN ('contact','handler') THEN
      RAISE EXCEPTION 'Each person must be a contact or a handler.' USING ERRCODE = '22004';
    END IF;
    IF (p->>'kind') = 'contact' THEN contacts := contacts + 1; END IF;
    amt := COALESCE(
      NULLIF(p->>'share_amount_ugx','')::int,
      ROUND(_retainer_ugx * COALESCE(NULLIF(p->>'share_percent','')::numeric, 0) / 100.0)::int
    );
    total := total + GREATEST(amt, 0);
  END LOOP;

  IF contacts > 1 THEN
    RAISE EXCEPTION 'A client can only have one contact person.' USING ERRCODE = '22004';
  END IF;
  IF total > _retainer_ugx THEN
    RAISE EXCEPTION 'The shares add up to more than the retainer.' USING ERRCODE = '22004';
  END IF;

  UPDATE public.residents SET retainer_ugx = _retainer_ugx WHERE id = _resident_id;

  DELETE FROM public.client_assignments a
   WHERE a.resident_id = _resident_id
     AND a.user_id NOT IN (
       SELECT (x->>'user_id')::uuid FROM jsonb_array_elements(COALESCE(_people,'[]'::jsonb)) x
     );

  INSERT INTO public.client_assignments (resident_id, user_id, kind, share_amount_ugx, share_percent, created_by)
  SELECT _resident_id,
         (x->>'user_id')::uuid,
         x->>'kind',
         NULLIF(x->>'share_amount_ugx','')::int,
         NULLIF(x->>'share_percent','')::numeric,
         auth.uid()
  FROM jsonb_array_elements(COALESCE(_people,'[]'::jsonb)) x
  ON CONFLICT (resident_id, user_id) DO UPDATE
    SET kind = EXCLUDED.kind,
        share_amount_ugx = EXCLUDED.share_amount_ugx,
        share_percent = EXCLUDED.share_percent;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_client_pay(uuid, integer, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_client_pay(uuid, integer, jsonb) TO authenticated;