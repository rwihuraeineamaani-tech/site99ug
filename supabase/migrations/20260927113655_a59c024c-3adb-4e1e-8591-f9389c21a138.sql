CREATE TABLE public.attendance_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  enforce_cutoff boolean NOT NULL DEFAULT true,
  cutoff_time time NOT NULL DEFAULT '09:00',
  grace_min int NOT NULL DEFAULT 10,
  work_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  require_clockout boolean NOT NULL DEFAULT false,
  exempt_user_ids uuid[] NOT NULL DEFAULT '{}',
  geofence_enabled boolean NOT NULL DEFAULT false,
  geo_lat double precision, geo_lng double precision, geo_radius_m int NOT NULL DEFAULT 200,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.attendance_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read attendance settings" ON public.attendance_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "md edits attendance settings" ON public.attendance_settings FOR UPDATE TO authenticated
  USING (public.is_md(auth.uid()) OR public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_md(auth.uid()) OR public.is_system_admin(auth.uid()));

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day date NOT NULL,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  status text NOT NULL DEFAULT 'on_time',
  late_minutes int NOT NULL DEFAULT 0,
  note text,
  lat double precision, lng double precision,
  excused_by uuid, excuse_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or leadership read attendance" ON public.attendance_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_leadership(auth.uid()) OR public.is_md(auth.uid()) OR public.is_system_admin(auth.uid()) OR public.has_role(auth.uid(),'operations_manager'));

CREATE OR REPLACE FUNCTION public.clock_in(_note text DEFAULT NULL, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL)
RETURNS public.attendance_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.attendance_settings; nowk timestamp := (now() AT TIME ZONE 'Africa/Kampala'); d date := nowk::date;
  late int := 0; st text := 'on_time'; r public.attendance_records; dist double precision;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can clock in'; END IF;
  SELECT * INTO s FROM public.attendance_settings WHERE id = 1;
  IF NOT s.enabled THEN RAISE EXCEPTION 'Clock-in is switched off'; END IF;
  IF s.geofence_enabled AND s.geo_lat IS NOT NULL THEN
    IF _lat IS NULL THEN RAISE EXCEPTION 'Please allow location to clock in'; END IF;
    dist := 6371000 * 2 * asin(sqrt(power(sin(radians(_lat - s.geo_lat)/2),2) + cos(radians(s.geo_lat))*cos(radians(_lat))*power(sin(radians(_lng - s.geo_lng)/2),2)));
    IF dist > s.geo_radius_m THEN RAISE EXCEPTION 'You are % m from the office — clock in when you arrive', round(dist); END IF;
  END IF;
  IF s.enforce_cutoff THEN
    late := GREATEST(0, floor(extract(epoch FROM (nowk::time - (s.cutoff_time + make_interval(mins => s.grace_min)))) / 60)::int);
    IF late > 0 THEN st := 'late'; late := late + s.grace_min; END IF;
  END IF;
  INSERT INTO public.attendance_records (user_id, day, clock_in_at, status, late_minutes, note, lat, lng)
  VALUES (auth.uid(), d, now(), st, late, NULLIF(trim(_note),''), _lat, _lng)
  ON CONFLICT (user_id, day) DO NOTHING RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'You already clocked in today'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.clock_out()
RETURNS public.attendance_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.attendance_records;
BEGIN
  UPDATE public.attendance_records SET clock_out_at = now(), updated_at = now()
  WHERE user_id = auth.uid() AND day = (now() AT TIME ZONE 'Africa/Kampala')::date AND clock_out_at IS NULL
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'No open clock-in for today'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.excuse_attendance(_user uuid, _day date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_md(auth.uid()) OR public.is_system_admin(auth.uid())) THEN RAISE EXCEPTION 'Only the MD can excuse days'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Give a reason'; END IF;
  INSERT INTO public.attendance_records (user_id, day, status, excused_by, excuse_reason)
  VALUES (_user, _day, 'excused', auth.uid(), _reason)
  ON CONFLICT (user_id, day) DO UPDATE SET status = 'excused', late_minutes = 0, excused_by = auth.uid(), excuse_reason = _reason, updated_at = now();
  INSERT INTO public.activity_log (actor_id, area, action, summary, entity_type, entity_id, detail)
  VALUES (auth.uid(), 'Management', 'attendance.excuse', 'Excused a clock-in day', 'user', _user, jsonb_build_object('day', _day, 'reason', _reason));
END $$;

REVOKE ALL ON FUNCTION public.clock_in(text,double precision,double precision), public.clock_out(), public.excuse_attendance(uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clock_in(text,double precision,double precision), public.clock_out(), public.excuse_attendance(uuid,date,text) TO authenticated;