DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.recompute_resident_lifecycle'::regproc);
  d := replace(d, $q$status <> 'complete');$q$, $q$status NOT IN ('complete','not_needed'));$q$);
  EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.activate_resident(_resident_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE open_count int;
BEGIN
  IF NOT (public.can_run_onboarding(auth.uid()) OR public.is_founder()) THEN
    RAISE EXCEPTION 'You do not have permission to activate clients';
  END IF;
  SELECT count(*) INTO open_count FROM resident_onboarding_steps
   WHERE resident_id = _resident_id AND status NOT IN ('complete','not_needed');
  IF open_count > 0 THEN
    RAISE EXCEPTION '% onboarding step(s) are still open', open_count;
  END IF;
  UPDATE residents SET onboarding_status = 'complete', updated_at = now() WHERE id = _resident_id;
  INSERT INTO activity_log(actor_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'client_activated', 'resident', _resident_id::text);
  RETURN public.recompute_resident_lifecycle(_resident_id);
END $$;
REVOKE ALL ON FUNCTION public.activate_resident(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.activate_resident(uuid) TO authenticated;

SELECT public.recompute_resident_lifecycle('7ab6a2bd-2f5c-460d-8269-743002c65b95');