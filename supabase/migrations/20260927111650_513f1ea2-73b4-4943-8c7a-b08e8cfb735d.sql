ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS spontaneous boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.add_to_shoot_day(_day_id uuid, _content_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE d record; c record; target text;
BEGIN
  SELECT * INTO d FROM public.shoot_days WHERE id = _day_id;
  IF d IS NULL THEN RAISE EXCEPTION 'Shoot day not found'; END IF;
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), _day_id)) THEN
    RAISE EXCEPTION 'You cannot change this shoot day.' USING ERRCODE='42501'; END IF;
  IF d.status NOT IN ('draft','confirmed','shooting') THEN RAISE EXCEPTION 'This shoot day is closed.'; END IF;
  SELECT * INTO c FROM public.content_items WHERE id = _content_id;
  IF c IS NULL THEN RAISE EXCEPTION 'Idea not found'; END IF;
  IF c.stage NOT IN ('Idea','Approved','Crewed','Scheduled') THEN RAISE EXCEPTION 'This idea is already past scheduling.'; END IF;
  PERFORM set_config('app.shoot_sync','on',true);
  DELETE FROM public.shoot_day_items WHERE content_id = _content_id AND outcome = 'planned';
  INSERT INTO public.shoot_day_items (shoot_day_id, content_id) VALUES (_day_id, _content_id);
  target := CASE d.status WHEN 'draft' THEN 'Crewed' WHEN 'confirmed' THEN 'Scheduled' ELSE 'Shooting' END;
  UPDATE public.content_items SET stage = target,
    approved_by = COALESCE(approved_by, auth.uid()), approved_at = COALESCE(approved_at, now()),
    shoot_at = CASE WHEN target='Crewed' THEN shoot_at ELSE d.shoot_date END,
    planned_at = CASE WHEN target='Crewed' THEN planned_at ELSE d.shoot_date END
   WHERE id = _content_id;
  PERFORM set_config('app.shoot_sync','off',true);
END $$;

CREATE OR REPLACE FUNCTION public.remove_from_shoot_day(_content_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE i record;
BEGIN
  SELECT si.*, sd.status AS day_status INTO i FROM public.shoot_day_items si JOIN public.shoot_days sd ON sd.id = si.shoot_day_id
   WHERE si.content_id = _content_id AND si.outcome = 'planned' LIMIT 1;
  IF i IS NULL THEN RAISE EXCEPTION 'This idea is not waiting on a shoot day.'; END IF;
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), i.shoot_day_id)) THEN
    RAISE EXCEPTION 'You cannot change this shoot day.' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.shoot_sync','on',true);
  DELETE FROM public.shoot_day_items WHERE id = i.id;
  UPDATE public.content_items SET stage = 'Crewed', shoot_at = NULL WHERE id = _content_id AND stage IN ('Scheduled','Shooting');
  PERFORM set_config('app.shoot_sync','off',true);
END $$;

CREATE OR REPLACE FUNCTION public.add_spontaneous_idea(_day_id uuid, _title text, _type text, _notes text DEFAULT NULL, _link text DEFAULT NULL, _editor uuid DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE d record; new_id uuid;
BEGIN
  SELECT * INTO d FROM public.shoot_days WHERE id = _day_id;
  IF d IS NULL THEN RAISE EXCEPTION 'Shoot day not found'; END IF;
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), _day_id)) THEN
    RAISE EXCEPTION 'You cannot change this shoot day.' USING ERRCODE='42501'; END IF;
  IF d.status NOT IN ('confirmed','shooting','done') THEN RAISE EXCEPTION 'Only shoot days that have happened can take shot ideas.'; END IF;
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'Give the idea a title.'; END IF;
  PERFORM set_config('app.shoot_sync','on',true);
  INSERT INTO public.content_items (title, content_type, notes, link, resident_id, project_id, stage, spontaneous,
     approved_by, approved_at, shoot_at, planned_at)
  VALUES (trim(_title), _type, _notes, NULLIF(trim(coalesce(_link,'')),''), d.resident_id, d.project_id, 'Idea', true,
     auth.uid(), now(), d.shoot_date, d.shoot_date)
  RETURNING id INTO new_id;
  UPDATE public.content_items SET stage = 'Editing' WHERE id = new_id;
  DELETE FROM public.shoot_day_items WHERE content_id = new_id;
  INSERT INTO public.shoot_day_items (shoot_day_id, content_id, outcome, outcome_by, outcome_at)
   VALUES (_day_id, new_id, 'shot', auth.uid(), now());
  IF _editor IS NOT NULL THEN
    INSERT INTO public.content_crew (content_id, role, user_id) VALUES (new_id, 'Editor', _editor);
  END IF;
  PERFORM set_config('app.shoot_sync','off',true);
  RETURN new_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_to_shoot_day(uuid,uuid), public.remove_from_shoot_day(uuid), public.add_spontaneous_idea(uuid,text,text,text,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_to_shoot_day(uuid,uuid), public.remove_from_shoot_day(uuid), public.add_spontaneous_idea(uuid,text,text,text,text,uuid) TO authenticated;