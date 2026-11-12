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
  INSERT INTO activity_log(actor_id, actor_kind, area, action, summary, entity_type, entity_id)
  VALUES (auth.uid(), 'staff', 'residents', 'client_activated', 'Client activated after onboarding', 'resident', _resident_id);
  RETURN public.recompute_resident_lifecycle(_resident_id);
END $$;