-- allow internal sync to bypass the stage guard
CREATE OR REPLACE FUNCTION public.content_stage_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_founder boolean; is_contact boolean; is_handler boolean; is_editor boolean; is_crew boolean;
  ok boolean := false;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  IF uid IS NULL OR current_setting('app.shoot_sync', true) = 'on' THEN RETURN NEW; END IF;
  is_founder := public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[]);
  is_contact := NEW.resident_id IS NOT NULL AND public.is_resident_contact(NEW.resident_id, uid);
  is_handler := NEW.resident_id IS NOT NULL AND public.is_resident_handler(NEW.resident_id, uid);
  SELECT EXISTS (SELECT 1 FROM public.content_crew c WHERE c.content_id = NEW.id AND c.user_id = uid AND lower(c.role) LIKE '%edit%') INTO is_editor;
  SELECT EXISTS (SELECT 1 FROM public.content_crew c WHERE c.content_id = NEW.id AND c.user_id = uid) INTO is_crew;
  IF NEW.stage = 'Rejected' THEN ok := is_founder;
  ELSIF OLD.stage = 'Idea' AND NEW.stage = 'Approved' THEN ok := is_founder;
  ELSIF OLD.stage = 'Approved' AND NEW.stage = 'Crewed' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Crewed' AND NEW.stage = 'Scheduled' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Scheduled' AND NEW.stage = 'Shooting' THEN ok := is_founder OR is_contact OR is_crew;
  ELSIF OLD.stage IN ('Scheduled','Shooting') AND NEW.stage = 'Editing' THEN ok := is_founder OR is_contact OR is_crew;
  ELSIF OLD.stage = 'Editing' AND NEW.stage = 'Review' THEN ok := is_founder OR is_editor OR is_crew;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Handover' THEN ok := is_founder;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Editing' THEN ok := is_founder;
  ELSIF OLD.stage = 'Handover' AND NEW.stage = 'Posted' THEN ok := is_founder OR is_handler;
  ELSIF OLD.stage = 'Posted' AND NEW.stage = 'Archived' THEN ok := is_founder OR is_handler;
  ELSIF OLD.stage = 'Rejected' AND NEW.stage = 'Idea' THEN ok := is_founder;
  END IF;
  IF NOT ok THEN
    RAISE EXCEPTION 'You cannot move this item from % to %.', OLD.stage, NEW.stage USING ERRCODE = '42501';
  END IF;
  IF NEW.stage = 'Posted' THEN
    NEW.posted_at := COALESCE(NEW.posted_at, now());
    NEW.metrics_due_at := (COALESCE(NEW.posted_at, now()) + interval '10 days')::date;
  END IF;
  IF NEW.stage = 'Approved' THEN
    NEW.approved_by := COALESCE(NEW.approved_by, uid);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  IF NEW.stage = 'Review' THEN NEW.editor_done_at := COALESCE(NEW.editor_done_at, now()); END IF;
  IF NEW.stage = 'Handover' THEN NEW.founder_approved_at := COALESCE(NEW.founder_approved_at, now()); END IF;
  RETURN NEW;
END;
$function$;

-- shoot day outcome -> pipeline
CREATE OR REPLACE FUNCTION public.shoot_item_outcome_sync()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.outcome IS NOT DISTINCT FROM OLD.outcome THEN RETURN NEW; END IF;
  PERFORM set_config('app.shoot_sync', 'on', true);
  IF NEW.outcome IN ('shot','partly') THEN
    UPDATE public.content_items SET stage = 'Editing'
     WHERE id = NEW.content_id AND stage IN ('Scheduled','Shooting');
  ELSIF OLD.outcome IN ('shot','partly') THEN
    UPDATE public.content_items SET stage = 'Scheduled'
     WHERE id = NEW.content_id AND stage = 'Editing' AND editor_done_at IS NULL;
  END IF;
  PERFORM set_config('app.shoot_sync', 'off', true);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shoot_item_outcome_sync ON public.shoot_day_items;
CREATE TRIGGER shoot_item_outcome_sync AFTER UPDATE OF outcome ON public.shoot_day_items
  FOR EACH ROW EXECUTE FUNCTION public.shoot_item_outcome_sync();

-- pipeline -> shoot day outcome
CREATE OR REPLACE FUNCTION public.content_shot_sync()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('app.shoot_sync', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.stage = 'Editing' AND OLD.stage IN ('Scheduled','Shooting') THEN
    UPDATE public.shoot_day_items SET outcome = 'shot', outcome_by = auth.uid(), outcome_at = now()
     WHERE content_id = NEW.id AND outcome IN ('planned','missed');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_shot_sync ON public.content_items;
CREATE TRIGGER content_shot_sync AFTER UPDATE OF stage ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.content_shot_sync();

-- move / reschedule an idea to another (or a new) shoot day
CREATE OR REPLACE FUNCTION public.move_shoot_day_item(_content_id uuid, _to_day_id uuid DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  item record; src record; dst record; c record;
BEGIN
  SELECT * INTO item FROM public.shoot_day_items WHERE content_id = _content_id;
  IF item IS NULL THEN RAISE EXCEPTION 'That idea is not on a shoot day.'; END IF;
  SELECT * INTO src FROM public.shoot_days WHERE id = item.shoot_day_id;
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), src.id)) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF item.outcome = 'shot' THEN RAISE EXCEPTION 'This idea was already shot.'; END IF;
  SELECT * INTO c FROM public.content_items WHERE id = _content_id;

  IF _to_day_id IS NULL THEN
    INSERT INTO public.shoot_days (resident_id, project_id, created_by)
    VALUES (src.resident_id, src.project_id, auth.uid()) RETURNING id INTO _to_day_id;
  END IF;
  IF _to_day_id = src.id THEN RAISE EXCEPTION 'It is already on this day.'; END IF;
  SELECT * INTO dst FROM public.shoot_days WHERE id = _to_day_id;
  IF dst IS NULL THEN RAISE EXCEPTION 'That shoot day is not there.'; END IF;
  IF dst.status NOT IN ('draft','confirmed','shooting') THEN RAISE EXCEPTION 'You can only move ideas to a day that has not finished.'; END IF;
  IF dst.resident_id IS DISTINCT FROM src.resident_id OR (src.resident_id IS NULL AND dst.project_id IS DISTINCT FROM src.project_id) THEN
    RAISE EXCEPTION 'Both shoot days must be for the same client.';
  END IF;

  UPDATE public.shoot_day_items
     SET shoot_day_id = _to_day_id, outcome = 'planned', outcome_at = NULL, outcome_by = NULL,
         outcome_note = CASE WHEN item.outcome_note IS NULL THEN 'Moved from an earlier shoot day'
                             ELSE item.outcome_note END
   WHERE id = item.id;

  PERFORM set_config('app.shoot_sync', 'on', true);
  IF dst.status IN ('confirmed','shooting') THEN
    UPDATE public.content_items SET stage = 'Scheduled', shoot_at = dst.shoot_date, planned_at = dst.shoot_date
     WHERE id = _content_id AND stage IN ('Crewed','Scheduled','Shooting');
  ELSE
    UPDATE public.content_items SET stage = 'Crewed', shoot_at = NULL
     WHERE id = _content_id AND stage IN ('Scheduled','Shooting');
  END IF;
  PERFORM set_config('app.shoot_sync', 'off', true);
  RETURN _to_day_id;
END $$;
REVOKE ALL ON FUNCTION public.move_shoot_day_item(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.move_shoot_day_item(uuid, uuid) TO authenticated;