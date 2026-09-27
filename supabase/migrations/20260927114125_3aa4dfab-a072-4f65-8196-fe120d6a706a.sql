ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.is_hr_level(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_u,'hr') OR public.is_md(_u) OR public.is_founder(_u) OR public.is_system_admin(_u) $$;
CREATE OR REPLACE FUNCTION public.can_view_people(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_hr_level(_u) OR public.has_role(_u,'operations_manager') OR EXISTS (SELECT 1 FROM public.staff_pay WHERE user_id = _u AND is_head) $$;
REVOKE ALL ON FUNCTION public.is_hr_level(uuid), public.can_view_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr_level(uuid), public.can_view_people(uuid) TO authenticated, service_role;

CREATE TABLE public.staff_profiles (
  user_id uuid PRIMARY KEY,
  legal_name text, preferred_name text, date_of_birth date, gender text, nationality text DEFAULT 'Ugandan', marital_status text,
  phone_alt text, personal_email text, district text, sub_county text, village text, address_line text,
  emergency_name text, emergency_relation text, emergency_phone text,
  qualification text, institution text, qualification_year int, languages text, skills text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staff_profiles TO authenticated; GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile read" ON public.staff_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_view_people(auth.uid()));
CREATE POLICY "profile insert" ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_hr_level(auth.uid()));
CREATE POLICY "profile update" ON public.staff_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_hr_level(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_hr_level(auth.uid()));

CREATE TABLE public.staff_private (
  user_id uuid PRIMARY KEY,
  nin text, nssf_no text, tin text,
  passport_no text, passport_country text, passport_expiry date,
  permit_class text, permit_no text, permit_expiry date, pass_no text,
  kin_name text, kin_relation text, kin_phone text, kin_address text,
  bank_name text, bank_branch text, account_name text, account_no text, momo_network text, momo_number text,
  blood_group text, health_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staff_private TO authenticated; GRANT ALL ON public.staff_private TO service_role;
ALTER TABLE public.staff_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private read" ON public.staff_private FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_hr_level(auth.uid()));
CREATE POLICY "private insert" ON public.staff_private FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_hr_level(auth.uid()));
CREATE POLICY "private update" ON public.staff_private FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_hr_level(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_hr_level(auth.uid()));

CREATE TABLE public.staff_employment (
  user_id uuid PRIMARY KEY,
  start_date date, contract_type text, probation_end date, contract_end date,
  reports_to uuid, department text, work_location text, notice_days int,
  updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staff_employment TO authenticated; GRANT ALL ON public.staff_employment TO service_role;
ALTER TABLE public.staff_employment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employment read" ON public.staff_employment FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_view_people(auth.uid()));
CREATE POLICY "employment insert" ON public.staff_employment FOR INSERT TO authenticated WITH CHECK (public.is_hr_level(auth.uid()));
CREATE POLICY "employment update" ON public.staff_employment FOR UPDATE TO authenticated USING (public.is_hr_level(auth.uid())) WITH CHECK (public.is_hr_level(auth.uid()));

CREATE TABLE public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, kind text NOT NULL, file_path text NOT NULL, file_name text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.staff_documents TO authenticated; GRANT ALL ON public.staff_documents TO service_role;
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs read" ON public.staff_documents FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_hr_level(auth.uid()));
CREATE POLICY "docs insert" ON public.staff_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_hr_level(auth.uid()));
CREATE POLICY "docs delete" ON public.staff_documents FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_hr_level(auth.uid()));

CREATE TABLE public.staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, kind text NOT NULL DEFAULT 'note', body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.staff_notes TO authenticated; GRANT ALL ON public.staff_notes TO service_role;
ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes hr" ON public.staff_notes FOR ALL TO authenticated USING (public.is_hr_level(auth.uid())) WITH CHECK (public.is_hr_level(auth.uid()) AND author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;
CREATE TRIGGER t_staff_profiles_upd BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_staff_private_upd BEFORE UPDATE ON public.staff_private FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_staff_employment_upd BEFORE UPDATE ON public.staff_employment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "staff docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'staff-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_hr_level(auth.uid())));
CREATE POLICY "staff docs write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_hr_level(auth.uid())));
CREATE POLICY "staff docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'staff-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_hr_level(auth.uid())));

CREATE OR REPLACE FUNCTION public.run_staff_expiry_alerts() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; u uuid; left_days int;
BEGIN
  FOR e IN
    SELECT p.user_id, 'Work permit' what, p.permit_expiry d FROM staff_private p WHERE p.permit_expiry IS NOT NULL
    UNION ALL SELECT p.user_id, 'Passport', p.passport_expiry FROM staff_private p WHERE p.passport_expiry IS NOT NULL
    UNION ALL SELECT m.user_id, 'Contract', m.contract_end FROM staff_employment m WHERE m.contract_end IS NOT NULL
    UNION ALL SELECT m.user_id, 'Probation', m.probation_end FROM staff_employment m WHERE m.probation_end IS NOT NULL
  LOOP
    left_days := e.d - (now() AT TIME ZONE 'Africa/Kampala')::date;
    CONTINUE WHEN left_days NOT IN (60, 30, 7);
    FOR u IN SELECT DISTINCT user_id FROM user_roles WHERE role IN ('hr','managing_director') LOOP
      INSERT INTO push_outbox(recipient_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key)
      VALUES (u, 'tasks', 'staff_expiry', 'staff', e.user_id,
        e.what || ' ends in ' || left_days || ' days',
        coalesce((SELECT display_name FROM team_members WHERE user_id = e.user_id), 'A team member') || ' — ' || lower(e.what) || ' ends ' || to_char(e.d, 'DD Mon YYYY') || '.',
        '/app/ops/people?person=' || e.user_id, 'staffexp:' || e.user_id || ':' || e.what || ':' || e.d || ':' || left_days || ':' || u)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.run_staff_expiry_alerts() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('staff-expiry-alerts', '15 5 * * *', $$SELECT public.run_staff_expiry_alerts()$$);