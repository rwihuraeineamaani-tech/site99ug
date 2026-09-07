-- 1. lock core details after approval
CREATE OR REPLACE FUNCTION public.content_items_lock_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.ref_no := OLD.ref_no;
  NEW.added_by := OLD.added_by;
  NEW.added_on := OLD.added_on;
  IF OLD.stage <> 'Idea' THEN
    NEW.title := OLD.title;
    NEW.resident_id := OLD.resident_id;
    NEW.project_id := OLD.project_id;
    NEW.client_id := OLD.client_id;
    NEW.content_type := OLD.content_type;
    NEW.link := OLD.link;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. shoot days for projects
ALTER TABLE public.shoot_days ALTER COLUMN resident_id DROP NOT NULL;
ALTER TABLE public.shoot_days ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.shoot_days DROP CONSTRAINT IF EXISTS shoot_days_one_owner;
ALTER TABLE public.shoot_days ADD CONSTRAINT shoot_days_one_owner
  CHECK ((resident_id IS NOT NULL) <> (project_id IS NOT NULL));

-- 3. attach crewed ideas to their owner's open day
CREATE OR REPLACE FUNCTION public.content_attach_shoot_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_id uuid;
BEGIN
  IF NEW.stage <> 'Crewed' OR (NEW.resident_id IS NULL AND NEW.project_id IS NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shoot_day_items WHERE content_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO day_id FROM public.shoot_days
   WHERE status = 'draft'
     AND ((NEW.resident_id IS NOT NULL AND resident_id = NEW.resident_id)
       OR (NEW.resident_id IS NULL AND project_id = NEW.project_id))
   ORDER BY created_at LIMIT 1;

  IF day_id IS NULL THEN
    INSERT INTO public.shoot_days (resident_id, project_id, created_by)
    VALUES (NEW.resident_id, CASE WHEN NEW.resident_id IS NULL THEN NEW.project_id END, auth.uid())
    RETURNING id INTO day_id;
  END IF;

  INSERT INTO public.shoot_day_items (shoot_day_id, content_id) VALUES (day_id, NEW.id)
  ON CONFLICT (content_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 4. one date: confirming the day sets both shoot and planned date
CREATE OR REPLACE FUNCTION public.confirm_shoot_day(_day_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
     SET stage = 'Scheduled', shoot_at = d, planned_at = d
   FROM public.shoot_day_items i
   WHERE i.shoot_day_id = _day_id AND i.content_id = c.id AND c.stage = 'Crewed';
END;
$function$;