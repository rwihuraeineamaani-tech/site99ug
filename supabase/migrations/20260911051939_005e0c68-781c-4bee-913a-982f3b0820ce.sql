CREATE TABLE public.calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  timezone text NOT NULL DEFAULT 'Africa/Kampala',
  location text,
  note text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','team')),
  strictness text NOT NULL DEFAULT 'warn' CHECK (strictness IN ('warn','hard')),
  freq text NOT NULL DEFAULT 'none' CHECK (freq IN ('none','daily','weekly','monthly')),
  interval_n integer NOT NULL DEFAULT 1 CHECK (interval_n >= 1),
  byweekday integer[] NOT NULL DEFAULT '{}',
  until date,
  occurrences integer CHECK (occurrences IS NULL OR occurrences > 0),
  reminder_minutes integer CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0),
  reminder_at timestamptz,
  reminder_dismissed_at timestamptz,
  work_kind text CHECK (work_kind IS NULL OR work_kind IN ('client','shoot','content','todo','brief','approval','strategy','invoice','other')),
  work_id text,
  work_label text,
  work_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (all_day OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
  CHECK (work_kind IS NULL OR work_path IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_items TO authenticated;
GRANT ALL ON public.calendar_items TO service_role;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and team read calendar items" ON public.calendar_items
FOR SELECT TO authenticated
USING (owner_user_id = auth.uid() OR (visibility = 'team' AND public.is_staff(auth.uid())));
CREATE POLICY "Owners create calendar items" ON public.calendar_items
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners update calendar items" ON public.calendar_items
FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners delete calendar items" ON public.calendar_items
FOR DELETE TO authenticated
USING (owner_user_id = auth.uid());
CREATE INDEX calendar_items_owner_date_idx ON public.calendar_items (owner_user_id, start_date, end_date);
CREATE INDEX calendar_items_team_date_idx ON public.calendar_items (start_date, end_date) WHERE visibility = 'team';
CREATE INDEX calendar_items_reminder_idx ON public.calendar_items (owner_user_id, reminder_at) WHERE reminder_at IS NOT NULL AND reminder_dismissed_at IS NULL;
CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.calendar_busy_slots (
  calendar_item_id uuid PRIMARY KEY REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  all_day boolean NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  strictness text NOT NULL CHECK (strictness IN ('warn','hard')),
  freq text NOT NULL CHECK (freq IN ('none','daily','weekly','monthly')),
  interval_n integer NOT NULL,
  byweekday integer[] NOT NULL DEFAULT '{}',
  until date,
  occurrences integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.calendar_busy_slots TO authenticated;
GRANT ALL ON public.calendar_busy_slots TO service_role;
ALTER TABLE public.calendar_busy_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read calendar busy slots" ON public.calendar_busy_slots
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR owner_user_id = auth.uid());
CREATE INDEX calendar_busy_slots_owner_date_idx ON public.calendar_busy_slots (owner_user_id, start_date, end_date);

CREATE OR REPLACE FUNCTION public.calendar_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage calendar items';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.owner_user_id := auth.uid();
  ELSIF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Calendar ownership cannot be changed';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;
  IF NOT NEW.all_day AND NEW.start_date = NEW.end_date AND NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  IF NEW.freq <> 'none' THEN
    NEW.end_date := NEW.start_date;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_item_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_item_guard() TO authenticated, service_role;
CREATE TRIGGER calendar_item_guard BEFORE INSERT OR UPDATE ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.calendar_item_guard();

CREATE OR REPLACE FUNCTION public.sync_calendar_busy_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_busy_slots WHERE calendar_item_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.calendar_busy_slots (
    calendar_item_id, owner_user_id, all_day, start_date, end_date, start_time, end_time,
    strictness, freq, interval_n, byweekday, until, occurrences, updated_at
  ) VALUES (
    NEW.id, NEW.owner_user_id, NEW.all_day, NEW.start_date, NEW.end_date, NEW.start_time, NEW.end_time,
    NEW.strictness, NEW.freq, NEW.interval_n, NEW.byweekday, NEW.until, NEW.occurrences, now()
  )
  ON CONFLICT (calendar_item_id) DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id,
    all_day = EXCLUDED.all_day,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    strictness = EXCLUDED.strictness,
    freq = EXCLUDED.freq,
    interval_n = EXCLUDED.interval_n,
    byweekday = EXCLUDED.byweekday,
    until = EXCLUDED.until,
    occurrences = EXCLUDED.occurrences,
    updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_calendar_busy_slot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_calendar_busy_slot() TO service_role;
CREATE TRIGGER sync_calendar_busy_slot
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.sync_calendar_busy_slot();

CREATE OR REPLACE FUNCTION public.calendar_slot_occurs_on(b public.calendar_busy_slots, d date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d < b.start_date THEN false
    WHEN b.until IS NOT NULL AND d > b.until THEN false
    WHEN b.freq = 'none' THEN d <= b.end_date
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
REVOKE ALL ON FUNCTION public.calendar_slot_occurs_on(public.calendar_busy_slots, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_slot_occurs_on(public.calendar_busy_slots, date) TO authenticated, service_role;

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
  UNION ALL
  SELECT c.calendar_item_id, 'staff'::text, c.owner_user_id, NULL::uuid, 'Busy'::text,
    c.strictness, c.all_day, c.start_time, c.end_time
  FROM public.calendar_busy_slots c
  WHERE _user_ids IS NOT NULL
    AND c.owner_user_id = ANY (_user_ids)
    AND public.calendar_slot_occurs_on(c, _on_date)
    AND (
      c.all_day OR _from_time IS NULL OR _to_time IS NULL
      OR (COALESCE(c.start_time, '00:00') < _to_time AND COALESCE(c.end_time, '23:59') > _from_time)
    )
$$;
REVOKE ALL ON FUNCTION public.availability_conflicts(uuid[], uuid, date, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.availability_conflicts(uuid[], uuid, date, time, time) TO authenticated, service_role;