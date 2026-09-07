-- 1. helpers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_content_crew(_user_id uuid, _content_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.content_crew c WHERE c.content_id = _content_id AND c.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.content_items i
      WHERE i.id = _content_id AND i.resident_id IS NOT NULL
        AND (public.is_resident_contact(i.resident_id, _user_id)
          OR public.is_resident_handler(i.resident_id, _user_id))
    )
  )
$$;
REVOKE ALL ON FUNCTION public.is_content_crew(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_content_crew(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_shoot_crew(_user_id uuid, _day_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shoot_day_items i
    WHERE i.shoot_day_id = _day_id AND public.is_content_crew(_user_id, i.content_id)
  )
$$;
REVOKE ALL ON FUNCTION public.is_shoot_crew(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_shoot_crew(uuid, uuid) TO authenticated, service_role;

-- 2. every staff account can read the pipeline ------------------------------
CREATE OR REPLACE FUNCTION public.can_view_content(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_user_id)
$$;

-- 3. crew can act on their own items ---------------------------------------
DROP POLICY IF EXISTS "Content team can edit content" ON public.content_items;
CREATE POLICY "Content team can edit content"
  ON public.content_items FOR UPDATE TO authenticated
  USING (public.can_edit_content(auth.uid()) OR public.is_content_crew(auth.uid(), id))
  WITH CHECK (public.can_edit_content(auth.uid()) OR public.is_content_crew(auth.uid(), id));

DROP POLICY IF EXISTS "Content leads manage shoot days" ON public.shoot_days;
CREATE POLICY "Content leads manage shoot days"
  ON public.shoot_days FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), id))
  WITH CHECK (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), id));

DROP POLICY IF EXISTS "Content leads manage shoot day items" ON public.shoot_day_items;
CREATE POLICY "Content leads manage shoot day items"
  ON public.shoot_day_items FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), shoot_day_id))
  WITH CHECK (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), shoot_day_id));

DROP POLICY IF EXISTS "Content leads manage shoot day equipment" ON public.shoot_day_equipment;
CREATE POLICY "Content leads manage shoot day equipment"
  ON public.shoot_day_equipment FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), shoot_day_id))
  WITH CHECK (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), shoot_day_id));

-- 4. stage guard accepts assigned crew for the crew-facing steps ------------
CREATE OR REPLACE FUNCTION public.content_stage_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  is_founder boolean;
  is_contact boolean;
  is_handler boolean;
  is_editor boolean;
  is_crew boolean;
  ok boolean := false;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  IF uid IS NULL THEN RETURN NEW; END IF;

  is_founder := public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[]);
  is_contact := NEW.resident_id IS NOT NULL AND public.is_resident_contact(NEW.resident_id, uid);
  is_handler := NEW.resident_id IS NOT NULL AND public.is_resident_handler(NEW.resident_id, uid);

  SELECT EXISTS (
    SELECT 1 FROM public.content_crew c
    WHERE c.content_id = NEW.id AND c.user_id = uid AND lower(c.role) LIKE '%edit%'
  ) INTO is_editor;

  SELECT EXISTS (
    SELECT 1 FROM public.content_crew c WHERE c.content_id = NEW.id AND c.user_id = uid
  ) INTO is_crew;

  IF NEW.stage = 'Rejected' THEN ok := is_founder;
  ELSIF OLD.stage = 'Idea' AND NEW.stage = 'Approved' THEN ok := is_founder;
  ELSIF OLD.stage = 'Approved' AND NEW.stage = 'Crewed' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Crewed' AND NEW.stage = 'Scheduled' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Scheduled' AND NEW.stage = 'Shooting' THEN ok := is_founder OR is_contact OR is_crew;
  ELSIF OLD.stage = 'Shooting' AND NEW.stage = 'Editing' THEN ok := is_founder OR is_contact OR is_crew;
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
$$;

-- 5. shoot day actions: crew can start and wrap, leads still confirm --------
CREATE OR REPLACE FUNCTION public.start_shoot_day(_day_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), _day_id)) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shoot_days SET status = 'shooting' WHERE id = _day_id AND status = 'confirmed';
  UPDATE public.content_items c
     SET stage = 'Shooting'
   FROM public.shoot_day_items i
   WHERE i.shoot_day_id = _day_id AND i.content_id = c.id AND c.stage = 'Scheduled';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_shoot_day(_day_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), _day_id)) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shoot_days SET status = 'done' WHERE id = _day_id AND status IN ('confirmed','shooting');
END;
$$;