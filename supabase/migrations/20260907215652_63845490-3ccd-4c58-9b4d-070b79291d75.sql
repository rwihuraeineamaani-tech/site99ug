CREATE TABLE public.availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind text NOT NULL DEFAULT 'staff' CHECK (owner_kind IN ('staff','resident')),
  owner_user_id uuid,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  title text NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  freq text NOT NULL DEFAULT 'none' CHECK (freq IN ('none','daily','weekly','monthly')),
  interval_n integer NOT NULL DEFAULT 1 CHECK (interval_n >= 1),
  byweekday integer[] NOT NULL DEFAULT '{}',
  until date,
  occurrences integer,
  strictness text NOT NULL DEFAULT 'warn' CHECK (strictness IN ('warn','hard')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_kind = 'staff' AND owner_user_id IS NOT NULL) OR (owner_kind = 'resident' AND resident_id IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_blocks TO authenticated;
GRANT ALL ON public.availability_blocks TO service_role;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read availability" ON public.availability_blocks
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR owner_user_id = auth.uid());

CREATE POLICY "Manage own or assigned availability" ON public.availability_blocks
FOR ALL TO authenticated
USING (
  owner_user_id = auth.uid()
  OR public.is_leadership(auth.uid())
  OR (owner_kind = 'resident' AND (public.is_resident_contact(resident_id, auth.uid()) OR public.is_resident_handler(resident_id, auth.uid())))
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR public.is_leadership(auth.uid())
  OR (owner_kind = 'resident' AND (public.is_resident_contact(resident_id, auth.uid()) OR public.is_resident_handler(resident_id, auth.uid())))
);

CREATE INDEX availability_blocks_owner_idx ON public.availability_blocks (owner_user_id);
CREATE INDEX availability_blocks_resident_idx ON public.availability_blocks (resident_id);

CREATE TRIGGER availability_blocks_updated_at
BEFORE UPDATE ON public.availability_blocks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  on_date date NOT NULL,
  blocked_user_id uuid,
  blocked_resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  reason text NOT NULL,
  approved_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.schedule_overrides TO authenticated;
GRANT ALL ON public.schedule_overrides TO service_role;
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read overrides" ON public.schedule_overrides
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Leaders can record overrides" ON public.schedule_overrides
FOR INSERT TO authenticated
WITH CHECK (public.is_md(auth.uid()) OR public.is_founder(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_occurs_on(b public.availability_blocks, d date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d < b.start_date THEN false
    WHEN b.until IS NOT NULL AND d > b.until THEN false
    WHEN b.freq = 'none' THEN d <= COALESCE(b.end_date, b.start_date)
    WHEN b.freq = 'daily' THEN ((d - b.start_date) % b.interval_n) = 0
      AND (b.occurrences IS NULL OR ((d - b.start_date) / b.interval_n) < b.occurrences)
    WHEN b.freq = 'weekly' THEN
      (CASE WHEN array_length(b.byweekday, 1) IS NULL
            THEN EXTRACT(dow FROM d)::int = EXTRACT(dow FROM b.start_date)::int
            ELSE EXTRACT(dow FROM d)::int = ANY (b.byweekday) END)
      AND ((((d - EXTRACT(dow FROM d)::int) - (b.start_date - EXTRACT(dow FROM b.start_date)::int)) / 7) % b.interval_n) = 0
      AND (b.occurrences IS NULL OR ((((d - EXTRACT(dow FROM d)::int) - (b.start_date - EXTRACT(dow FROM b.start_date)::int)) / 7) / b.interval_n) < b.occurrences)
    WHEN b.freq = 'monthly' THEN
      EXTRACT(day FROM d)::int = EXTRACT(day FROM b.start_date)::int
      AND ((((EXTRACT(year FROM d)::int - EXTRACT(year FROM b.start_date)::int) * 12) + (EXTRACT(month FROM d)::int - EXTRACT(month FROM b.start_date)::int)) % b.interval_n) = 0
      AND (b.occurrences IS NULL OR ((((EXTRACT(year FROM d)::int - EXTRACT(year FROM b.start_date)::int) * 12) + (EXTRACT(month FROM d)::int - EXTRACT(month FROM b.start_date)::int)) / b.interval_n) < b.occurrences)
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.availability_conflicts(
  _user_ids uuid[],
  _resident_id uuid,
  _on_date date,
  _from_time time DEFAULT NULL,
  _to_time time DEFAULT NULL
)
RETURNS TABLE (
  block_id uuid,
  owner_kind text,
  owner_user_id uuid,
  resident_id uuid,
  title text,
  strictness text,
  all_day boolean,
  start_time time,
  end_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.owner_kind, b.owner_user_id, b.resident_id, b.title, b.strictness, b.all_day, b.start_time, b.end_time
  FROM public.availability_blocks b
  WHERE (
      (b.owner_kind = 'staff' AND _user_ids IS NOT NULL AND b.owner_user_id = ANY (_user_ids))
      OR (b.owner_kind = 'resident' AND _resident_id IS NOT NULL AND b.resident_id = _resident_id)
    )
    AND public.block_occurs_on(b, _on_date)
    AND (
      b.all_day OR _from_time IS NULL OR _to_time IS NULL
      OR (COALESCE(b.start_time, '00:00') < _to_time AND COALESCE(b.end_time, '23:59') > _from_time)
    )
$$;

CREATE OR REPLACE FUNCTION public.shoot_days_availability_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hard_title text;
BEGIN
  IF NEW.shoot_date IS NULL OR NEW.resident_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.shoot_date IS NOT DISTINCT FROM NEW.shoot_date
     AND OLD.resident_id IS NOT DISTINCT FROM NEW.resident_id THEN
    RETURN NEW;
  END IF;

  SELECT c.title INTO hard_title
  FROM public.availability_conflicts(NULL::uuid[], NEW.resident_id, NEW.shoot_date) c
  WHERE c.strictness = 'hard'
  LIMIT 1;

  IF hard_title IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.schedule_overrides o
    WHERE o.blocked_resident_id = NEW.resident_id AND o.on_date = NEW.shoot_date
  ) THEN
    RAISE EXCEPTION 'This client is unavailable on % (%). A managing director or founder must record an override first.', NEW.shoot_date, hard_title;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shoot_days_availability_guard
BEFORE INSERT OR UPDATE ON public.shoot_days
FOR EACH ROW EXECUTE FUNCTION public.shoot_days_availability_guard();