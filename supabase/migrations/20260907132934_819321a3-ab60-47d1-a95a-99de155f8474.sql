-- EQUIPMENT ---------------------------------------------------------------
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view equipment" ON public.equipment
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Leadership manages equipment" ON public.equipment
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SHOOT DAYS ---------------------------------------------------------------
CREATE TABLE public.shoot_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  shoot_date date,
  call_time text,
  location text,
  notes text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoot_days_status_chk CHECK (status IN ('draft','confirmed','shooting','done','cancelled'))
);
CREATE INDEX shoot_days_resident_idx ON public.shoot_days(resident_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_days TO authenticated;
GRANT ALL ON public.shoot_days TO service_role;
ALTER TABLE public.shoot_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view shoot days" ON public.shoot_days
  FOR SELECT TO authenticated USING (public.can_view_content(auth.uid()));
CREATE POLICY "Content leads manage shoot days" ON public.shoot_days
  FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()))
  WITH CHECK (public.can_edit_content(auth.uid()));
CREATE TRIGGER shoot_days_updated_at BEFORE UPDATE ON public.shoot_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shoot_day_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  content_id uuid NOT NULL UNIQUE REFERENCES public.content_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shoot_day_items_day_idx ON public.shoot_day_items(shoot_day_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_day_items TO authenticated;
GRANT ALL ON public.shoot_day_items TO service_role;
ALTER TABLE public.shoot_day_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view shoot day items" ON public.shoot_day_items
  FOR SELECT TO authenticated USING (public.can_view_content(auth.uid()));
CREATE POLICY "Content leads manage shoot day items" ON public.shoot_day_items
  FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()))
  WITH CHECK (public.can_edit_content(auth.uid()));

CREATE TABLE public.shoot_day_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shoot_day_id, equipment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_day_equipment TO authenticated;
GRANT ALL ON public.shoot_day_equipment TO service_role;
ALTER TABLE public.shoot_day_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view shoot day equipment" ON public.shoot_day_equipment
  FOR SELECT TO authenticated USING (public.can_view_content(auth.uid()));
CREATE POLICY "Content leads manage shoot day equipment" ON public.shoot_day_equipment
  FOR ALL TO authenticated
  USING (public.can_edit_content(auth.uid()))
  WITH CHECK (public.can_edit_content(auth.uid()));

-- gear double-booking guard ------------------------------------------------
CREATE OR REPLACE FUNCTION public.shoot_equipment_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  owned integer;
  booked integer;
  gear text;
BEGIN
  SELECT shoot_date INTO d FROM public.shoot_days WHERE id = NEW.shoot_day_id;
  IF d IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT quantity, name INTO owned, gear FROM public.equipment WHERE id = NEW.equipment_id;
  SELECT COALESCE(sum(e.qty), 0) INTO booked
  FROM public.shoot_day_equipment e
  JOIN public.shoot_days s ON s.id = e.shoot_day_id
  WHERE e.equipment_id = NEW.equipment_id
    AND e.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND s.shoot_date = d
    AND s.status IN ('confirmed','shooting');
  IF booked + NEW.qty > COALESCE(owned, 0) THEN
    RAISE EXCEPTION '% is already booked on another shoot that day.', COALESCE(gear, 'That gear')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shoot_day_equipment_availability
  BEFORE INSERT OR UPDATE ON public.shoot_day_equipment
  FOR EACH ROW EXECUTE FUNCTION public.shoot_equipment_availability();

-- auto-attach crewed ideas to an open shoot day ----------------------------
CREATE OR REPLACE FUNCTION public.content_attach_shoot_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_id uuid;
BEGIN
  IF NEW.stage <> 'Crewed' OR NEW.resident_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shoot_day_items WHERE content_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  SELECT id INTO day_id FROM public.shoot_days
   WHERE resident_id = NEW.resident_id AND status = 'draft'
   ORDER BY created_at LIMIT 1;
  IF day_id IS NULL THEN
    INSERT INTO public.shoot_days (resident_id, created_by)
    VALUES (NEW.resident_id, auth.uid())
    RETURNING id INTO day_id;
  END IF;
  INSERT INTO public.shoot_day_items (shoot_day_id, content_id) VALUES (day_id, NEW.id)
  ON CONFLICT (content_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER content_items_attach_shoot_day
  AFTER INSERT OR UPDATE OF stage ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.content_attach_shoot_day();

-- confirm / start a shoot day ----------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_shoot_day(_day_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  n integer;
BEGIN
  IF NOT public.can_edit_content(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  SELECT shoot_date INTO d FROM public.shoot_days WHERE id = _day_id;
  IF d IS NULL THEN
    RAISE EXCEPTION 'Pick a date first.' USING ERRCODE = '22004';
  END IF;
  SELECT count(*) INTO n FROM public.shoot_day_items WHERE shoot_day_id = _day_id;
  IF n = 0 THEN
    RAISE EXCEPTION 'Add at least one idea to this shoot day.' USING ERRCODE = '22004';
  END IF;
  UPDATE public.shoot_days
     SET status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
   WHERE id = _day_id;
  UPDATE public.content_items c
     SET stage = 'Scheduled', shoot_at = d
   FROM public.shoot_day_items i
   WHERE i.shoot_day_id = _day_id AND i.content_id = c.id AND c.stage = 'Crewed';
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_shoot_day(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_shoot_day(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_shoot_day(_day_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_edit_content(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shoot_days SET status = 'shooting' WHERE id = _day_id AND status = 'confirmed';
  UPDATE public.content_items c
     SET stage = 'Shooting'
   FROM public.shoot_day_items i
   WHERE i.shoot_day_id = _day_id AND i.content_id = c.id AND c.stage = 'Scheduled';
END;
$$;
REVOKE ALL ON FUNCTION public.start_shoot_day(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_shoot_day(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finish_shoot_day(_day_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_edit_content(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shoot_days SET status = 'done' WHERE id = _day_id AND status IN ('confirmed','shooting');
END;
$$;
REVOKE ALL ON FUNCTION public.finish_shoot_day(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finish_shoot_day(uuid) TO authenticated, service_role;