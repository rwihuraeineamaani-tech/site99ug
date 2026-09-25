
-- 1. One handler per client (stored as the 'contact' row)
DELETE FROM public.client_assignments a WHERE a.kind='handler'
  AND EXISTS (SELECT 1 FROM public.client_assignments c WHERE c.resident_id=a.resident_id AND c.kind='contact');
UPDATE public.client_assignments a SET kind='contact' WHERE kind='handler'
  AND a.id = (SELECT id FROM public.client_assignments x WHERE x.resident_id=a.resident_id ORDER BY created_at LIMIT 1);
DELETE FROM public.client_assignments WHERE kind='handler';
CREATE UNIQUE INDEX IF NOT EXISTS client_assignments_one_handler ON public.client_assignments(resident_id);

CREATE OR REPLACE FUNCTION public.sync_resident_assignment_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rid uuid := COALESCE(NEW.resident_id, OLD.resident_id); uid uuid;
BEGIN
  SELECT a.user_id INTO uid FROM public.client_assignments a WHERE a.resident_id = rid LIMIT 1;
  UPDATE public.residents r SET contact_user_id = uid, handler_user_id = uid WHERE r.id = rid;
  RETURN NULL;
END; $$;
UPDATE public.residents r SET contact_user_id = a.user_id, handler_user_id = a.user_id
  FROM public.client_assignments a WHERE a.resident_id = r.id;

CREATE OR REPLACE FUNCTION public.is_resident_handler(_resident_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.resident_id=_resident_id AND a.user_id=_user_id)
    OR EXISTS (SELECT 1 FROM public.residents r WHERE r.id=_resident_id AND (r.handler_user_id=_user_id OR r.contact_user_id=_user_id)))
$$;
CREATE OR REPLACE FUNCTION public.is_resident_contact(_resident_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_resident_handler(_resident_id, _user_id)
$$;

CREATE OR REPLACE FUNCTION public.set_client_pay(_resident_id uuid, _retainer_ugx integer, _people jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE total integer := 0; p jsonb; amt integer;
BEGIN
  IF NOT public.can_see_finance(auth.uid()) THEN RAISE EXCEPTION 'Not allowed.' USING ERRCODE='42501'; END IF;
  IF _retainer_ugx < 0 THEN RAISE EXCEPTION 'The retainer cannot be negative.' USING ERRCODE='22004'; END IF;
  IF jsonb_array_length(COALESCE(_people,'[]'::jsonb)) > 1 THEN
    RAISE EXCEPTION 'A client has one Handler only.' USING ERRCODE='22004'; END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(COALESCE(_people,'[]'::jsonb)) LOOP
    amt := COALESCE(NULLIF(p->>'share_amount_ugx','')::int,
      ROUND(_retainer_ugx * COALESCE(NULLIF(p->>'share_percent','')::numeric,0)/100.0)::int);
    total := total + GREATEST(amt,0);
  END LOOP;
  IF total > _retainer_ugx THEN RAISE EXCEPTION 'The share adds up to more than the retainer.' USING ERRCODE='22004'; END IF;
  UPDATE public.residents SET retainer_ugx=_retainer_ugx WHERE id=_resident_id;
  DELETE FROM public.client_assignments a WHERE a.resident_id=_resident_id
    AND a.user_id NOT IN (SELECT (x->>'user_id')::uuid FROM jsonb_array_elements(COALESCE(_people,'[]'::jsonb)) x);
  INSERT INTO public.client_assignments (resident_id,user_id,kind,share_amount_ugx,share_percent,created_by)
  SELECT _resident_id,(x->>'user_id')::uuid,'contact',NULLIF(x->>'share_amount_ugx','')::int,NULLIF(x->>'share_percent','')::numeric,auth.uid()
  FROM jsonb_array_elements(COALESCE(_people,'[]'::jsonb)) x
  ON CONFLICT (resident_id,user_id) DO UPDATE SET kind='contact',
    share_amount_ugx=EXCLUDED.share_amount_ugx, share_percent=EXCLUDED.share_percent;
END; $$;

-- 2. KPI manager helper
CREATE OR REPLACE FUNCTION public.is_kpi_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_any_role(_user_id, ARRAY['founder','managing_director','operations_manager','hr','finance_ops']::public.app_role[])
$$;

-- 3. Tables
CREATE TABLE public.staff_pay (
  user_id uuid PRIMARY KEY,
  base_salary_ugx integer NOT NULL DEFAULT 0,
  is_head boolean NOT NULL DEFAULT false,
  head_bonus_ugx integer NOT NULL DEFAULT 0,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_pay TO authenticated;
GRANT ALL ON public.staff_pay TO service_role;
ALTER TABLE public.staff_pay ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or manager read pay" ON public.staff_pay FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_kpi_manager(auth.uid()));
CREATE POLICY "managers write pay" ON public.staff_pay FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));

CREATE TABLE public.kpi_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  hit_bonus_pct numeric NOT NULL DEFAULT 30,
  head_bonus_pct numeric NOT NULL DEFAULT 15,
  miss_penalty_pct numeric NOT NULL DEFAULT 30,
  contract_end_pct numeric NOT NULL DEFAULT 10,
  renewal_pct numeric NOT NULL DEFAULT 5,
  weights jsonb NOT NULL DEFAULT '{"work_done":30,"work_missed":15,"todo_done":10,"content":20,"numbers":15,"approvals":10}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kpi_settings TO authenticated;
GRANT ALL ON public.kpi_settings TO service_role;
ALTER TABLE public.kpi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read kpi settings" ON public.kpi_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write kpi settings" ON public.kpi_settings FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));
INSERT INTO public.kpi_settings (id) VALUES (true);

CREATE TABLE public.kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month date NOT NULL,
  metric text NOT NULL,
  label text,
  target_value numeric NOT NULL DEFAULT 0,
  approval_state text NOT NULL DEFAULT 'approved',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approval_state IN ('pending','approved','rejected'))
);
CREATE INDEX kpi_targets_user_month ON public.kpi_targets(user_id, month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_targets TO authenticated;
GRANT ALL ON public.kpi_targets TO service_role;
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or manager read targets" ON public.kpi_targets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_kpi_manager(auth.uid()));
CREATE POLICY "managers write targets" ON public.kpi_targets FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.kpi_target_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE head boolean;
BEGIN
  SELECT is_head INTO head FROM public.staff_pay WHERE user_id = NEW.user_id;
  IF COALESCE(head,false) THEN
    IF TG_OP='INSERT' OR NEW.target_value IS DISTINCT FROM OLD.target_value OR NEW.metric IS DISTINCT FROM OLD.metric THEN
      IF NOT public.is_founder(auth.uid()) THEN NEW.approval_state := 'pending'; NEW.approved_by := NULL; NEW.approved_at := NULL; END IF;
    END IF;
    IF NEW.approval_state <> 'pending' AND (TG_OP='INSERT' OR OLD.approval_state IS DISTINCT FROM NEW.approval_state) THEN
      IF NOT public.is_founder(auth.uid()) THEN RAISE EXCEPTION 'Only Founders approve head of department targets.' USING ERRCODE='42501'; END IF;
      NEW.approved_by := auth.uid(); NEW.approved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER kpi_targets_guard BEFORE INSERT OR UPDATE ON public.kpi_targets FOR EACH ROW EXECUTE FUNCTION public.kpi_target_guard();

CREATE TABLE public.kpi_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month date NOT NULL,
  data_ugx integer NOT NULL DEFAULT 0,
  transport_ugx integer NOT NULL DEFAULT 0,
  shoot_days integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_allowances TO authenticated;
GRANT ALL ON public.kpi_allowances TO service_role;
ALTER TABLE public.kpi_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or manager read allowances" ON public.kpi_allowances FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_kpi_manager(auth.uid()));
CREATE POLICY "managers write allowances" ON public.kpi_allowances FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));

CREATE TABLE public.kpi_contract_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  contract_id uuid,
  kind text NOT NULL CHECK (kind IN ('end','renewal')),
  contract_value_ugx integer NOT NULL DEFAULT 0,
  percent numeric NOT NULL,
  amount_ugx integer NOT NULL DEFAULT 0,
  month date NOT NULL,
  confirmed_by uuid DEFAULT auth.uid(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_contract_bonuses TO authenticated;
GRANT ALL ON public.kpi_contract_bonuses TO service_role;
ALTER TABLE public.kpi_contract_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or manager read contract bonuses" ON public.kpi_contract_bonuses FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_kpi_manager(auth.uid()));
CREATE POLICY "managers write contract bonuses" ON public.kpi_contract_bonuses FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));

CREATE TABLE public.kpi_month_close (
  month date PRIMARY KEY,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_month_close TO authenticated;
GRANT ALL ON public.kpi_month_close TO service_role;
ALTER TABLE public.kpi_month_close ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage month close" ON public.kpi_month_close FOR ALL TO authenticated USING (public.is_kpi_manager(auth.uid())) WITH CHECK (public.is_kpi_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.kpi_touch() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER t_staff_pay BEFORE UPDATE ON public.staff_pay FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
CREATE TRIGGER t_kpi_settings BEFORE UPDATE ON public.kpi_settings FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
CREATE TRIGGER t_kpi_targets BEFORE UPDATE ON public.kpi_targets FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
CREATE TRIGGER t_kpi_allowances BEFORE UPDATE ON public.kpi_allowances FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
CREATE TRIGGER t_kpi_contract_bonuses BEFORE UPDATE ON public.kpi_contract_bonuses FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
CREATE TRIGGER t_kpi_month_close BEFORE UPDATE ON public.kpi_month_close FOR EACH ROW EXECUTE FUNCTION public.kpi_touch();
