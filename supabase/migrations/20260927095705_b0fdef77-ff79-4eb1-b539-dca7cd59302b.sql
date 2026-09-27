
-- helpers
CREATE OR REPLACE FUNCTION public.is_talent_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder','managing_director','operations_manager','talent_director']::app_role[])
$$;

-- talent
CREATE TABLE public.talent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'freelance' CHECK (kind IN ('roster','freelance')),
  category text,
  phone text,
  email text,
  handles jsonb NOT NULL DEFAULT '[]'::jsonb,
  followers_total integer NOT NULL DEFAULT 0,
  day_rate_ugx integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.talent_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES public.talent(id) ON DELETE CASCADE,
  user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.my_talent_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT talent_id FROM public.talent_users WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  objective text,
  budget_ugx integer NOT NULL DEFAULT 0,
  starts_on date,
  ends_on date,
  platforms text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','live','done','cancelled')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_talent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES public.talent(id) ON DELETE CASCADE,
  fee_ugx integer NOT NULL DEFAULT 0,
  posts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, talent_id)
);
CREATE TABLE public.talent_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES public.talent(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE SET NULL,
  booked_on date NOT NULL DEFAULT CURRENT_DATE,
  fee_ugx integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','done','cancelled','paid')),
  brief text,
  paid_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.talent_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES public.talent(id) ON DELETE CASCADE,
  title text NOT NULL,
  usage_terms text,
  territory text,
  starts_on date,
  ends_on date,
  file_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed','ended','cancelled')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  talent_id uuid REFERENCES public.talent(id) ON DELETE SET NULL,
  platform text,
  reach integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  engagements integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  revenue_ugx integer NOT NULL DEFAULT 0,
  recorded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent, public.talent_users, public.campaigns, public.campaign_talent, public.talent_bookings, public.talent_contracts, public.campaign_results, public.campaign_forecasts TO authenticated;
GRANT ALL ON public.talent, public.talent_users, public.campaigns, public.campaign_talent, public.talent_bookings, public.talent_contracts, public.campaign_results, public.campaign_forecasts TO service_role;

ALTER TABLE public.talent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_talent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talent managers manage talent" ON public.talent FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Staff read talent" ON public.talent FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Talent read own profile" ON public.talent FOR SELECT TO authenticated USING (id = public.my_talent_id());

CREATE POLICY "Talent managers manage logins" ON public.talent_users FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Talent read own login" ON public.talent_users FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Talent managers manage campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Staff read campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Talent read own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.campaign_talent ct WHERE ct.campaign_id = campaigns.id AND ct.talent_id = public.my_talent_id()));

CREATE POLICY "Talent managers manage campaign talent" ON public.campaign_talent FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Staff read campaign talent" ON public.campaign_talent FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Talent read own campaign slots" ON public.campaign_talent FOR SELECT TO authenticated USING (talent_id = public.my_talent_id());

CREATE POLICY "Talent managers manage bookings" ON public.talent_bookings FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Staff read bookings" ON public.talent_bookings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Talent read own bookings" ON public.talent_bookings FOR SELECT TO authenticated USING (talent_id = public.my_talent_id());

CREATE POLICY "Talent managers manage talent contracts" ON public.talent_contracts FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid()) OR public.has_role(auth.uid(),'legal')) WITH CHECK (public.is_talent_manager(auth.uid()) OR public.has_role(auth.uid(),'legal'));
CREATE POLICY "Talent read own contracts" ON public.talent_contracts FOR SELECT TO authenticated USING (talent_id = public.my_talent_id());

CREATE POLICY "Talent managers manage results" ON public.campaign_results FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));
CREATE POLICY "Staff read results" ON public.campaign_results FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Talent read results of own campaigns" ON public.campaign_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.campaign_talent ct WHERE ct.campaign_id = campaign_results.campaign_id AND ct.talent_id = public.my_talent_id()));

CREATE POLICY "Talent managers manage forecasts" ON public.campaign_forecasts FOR ALL TO authenticated USING (public.is_talent_manager(auth.uid())) WITH CHECK (public.is_talent_manager(auth.uid()));

CREATE TRIGGER talent_touch BEFORE UPDATE ON public.talent FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER talent_bookings_touch BEFORE UPDATE ON public.talent_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER talent_contracts_touch BEFORE UPDATE ON public.talent_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- talent fees go through the bill path
ALTER TABLE public.invoices ADD COLUMN talent_booking_id uuid UNIQUE REFERENCES public.talent_bookings(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.raise_bill_for_source(_kind text, _id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE inv uuid; num text; amt int; payee text; pk text; cat text; what text; rid uuid;
BEGIN
  IF _kind = 'cash_request' THEN
    SELECT id INTO inv FROM public.invoices WHERE cash_request_id = _id;
    IF inv IS NOT NULL THEN RETURN inv; END IF;
    SELECT c.amount_ugx, coalesce(t.display_name, t.email, 'Team member'), 'team', c.category, c.purpose, c.resident_id
      INTO amt, payee, pk, cat, what, rid
    FROM public.cash_requests c LEFT JOIN public.team_members t ON t.user_id = c.requester WHERE c.id = _id;
  ELSIF _kind = 'talent_booking' THEN
    SELECT id INTO inv FROM public.invoices WHERE talent_booking_id = _id;
    IF inv IS NOT NULL THEN RETURN inv; END IF;
    SELECT b.fee_ugx, t.name, 'supplier', 'talent', 'Talent fee · ' || to_char(b.booked_on, 'DD Mon YYYY'), b.resident_id
      INTO amt, payee, pk, cat, what, rid
    FROM public.talent_bookings b JOIN public.talent t ON t.id = b.talent_id WHERE b.id = _id;
    IF coalesce(amt,0) <= 0 THEN RETURN NULL; END IF;
  ELSE
    SELECT id INTO inv FROM public.invoices WHERE payment_run_line_id = _id;
    IF inv IS NOT NULL THEN RETURN inv; END IF;
    SELECT l.amount_ugx, l.payee_name, CASE WHEN l.payee_kind = 'internal' THEN 'team' ELSE 'supplier' END, l.category, 'Monthly ' || l.category, NULL
      INTO amt, payee, pk, cat, what, rid
    FROM public.payment_run_lines l WHERE l.id = _id;
  END IF;
  IF amt IS NULL THEN RETURN NULL; END IF;
  num := public.next_invoice_number();
  INSERT INTO public.invoices (direction, status, number, party_kind, party_name, resident_id, category,
    subtotal_ugx, total_ugx, note, approved_at, cash_request_id, payment_run_line_id, talent_booking_id)
  VALUES ('in', 'approved', num, pk, payee, rid, coalesce(cat, 'general'), amt, amt, what, now(),
    CASE WHEN _kind = 'cash_request' THEN _id END, CASE WHEN _kind = 'run_line' THEN _id END,
    CASE WHEN _kind = 'talent_booking' THEN _id END)
  RETURNING id INTO inv;
  RETURN inv;
END $function$;

CREATE OR REPLACE FUNCTION public.talent_booking_bill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('confirmed','done') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('confirmed','done','paid')) THEN
    PERFORM public.raise_bill_for_source('talent_booking', NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER talent_booking_bill AFTER INSERT OR UPDATE OF status ON public.talent_bookings FOR EACH ROW EXECUTE FUNCTION public.talent_booking_bill();

CREATE OR REPLACE FUNCTION public.bill_paid_sync()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NEW.cash_request_id IS NOT NULL THEN UPDATE public.cash_requests SET status = 'paid' WHERE id = NEW.cash_request_id AND status <> 'paid'; END IF;
    IF NEW.payment_run_line_id IS NOT NULL THEN UPDATE public.payment_run_lines SET status = 'paid' WHERE id = NEW.payment_run_line_id AND status <> 'paid'; END IF;
    IF NEW.talent_booking_id IS NOT NULL THEN UPDATE public.talent_bookings SET status = 'paid', paid_at = now() WHERE id = NEW.talent_booking_id AND status <> 'paid'; END IF;
  END IF;
  RETURN NEW;
END $function$;

-- onboarding
ALTER TABLE public.resident_onboarding_steps
  ADD COLUMN requires_md_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN sort integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.onboarding_step_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.onboarding_approve', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Only the MD or a Founder can sign off this step';
  END IF;
  IF NEW.requires_md_approval AND NEW.status = 'complete' AND NEW.approved_at IS NULL THEN
    RAISE EXCEPTION 'This step needs the MD''s sign-off before it can be completed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER onboarding_step_guard BEFORE INSERT OR UPDATE ON public.resident_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.onboarding_step_guard();

CREATE OR REPLACE FUNCTION public.can_run_onboarding(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder','managing_director','operations_manager','communications','client_relations']::app_role[])
$$;

CREATE POLICY "Onboarding team manages steps" ON public.resident_onboarding_steps FOR ALL TO authenticated
  USING (public.can_run_onboarding(auth.uid())) WITH CHECK (public.can_run_onboarding(auth.uid()));

CREATE OR REPLACE FUNCTION public.start_resident_onboarding(_id uuid, _established boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE comms uuid; n integer := 0; s record; has_portal boolean;
BEGIN
  IF NOT public.can_run_onboarding(auth.uid()) THEN RAISE EXCEPTION 'Only Communications, Client Relations or leadership can start onboarding'; END IF;
  SELECT user_id INTO comms FROM public.user_roles WHERE role = 'communications' ORDER BY user_id LIMIT 1;
  has_portal := EXISTS (SELECT 1 FROM public.resident_users WHERE resident_id = _id);
  FOR s IN SELECT * FROM (VALUES
    (1,'portal','Create the portal account','Client Relations',false),
    (2,'legal','Draft and sign the contract','Legal',true),
    (3,'brand','Collect brand guidelines and logo','Brand',false),
    (4,'socials','Link social accounts','Content',false),
    (5,'handler','Assign a Handler','Management',false),
    (6,'strategy','Strategy kick-off','Strategy',false),
    (7,'content_plan','First content plan','Content',false),
    (8,'first_invoice','Raise the first invoice','Finance',false),
    (9,'handover','Handover and final sign-off','Management',true)
  ) AS v(sort, key, title, dept, md) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.resident_onboarding_steps WHERE resident_id = _id AND step_key = s.key) THEN
      INSERT INTO public.resident_onboarding_steps(resident_id, step_key, title, department, owner_user_id, status, due_on, requires_md_approval, sort, completed_by, completed_at, note)
      VALUES (_id, s.key, s.title, s.dept, comms,
        CASE WHEN (_established AND s.key <> 'handover' AND NOT s.md) OR (s.key = 'portal' AND has_portal) THEN 'complete'
             WHEN _established AND s.md AND s.key <> 'handover' THEN 'pending' ELSE 'pending' END,
        (CURRENT_DATE + (s.sort * 3)), s.md, s.sort,
        CASE WHEN _established AND NOT s.md THEN auth.uid() END,
        CASE WHEN _established AND NOT s.md THEN now() END,
        CASE WHEN _established THEN 'Established client — done before this checklist' END);
      n := n + 1;
    ELSE
      UPDATE public.resident_onboarding_steps SET requires_md_approval = s.md, sort = s.sort WHERE resident_id = _id AND step_key = s.key;
    END IF;
  END LOOP;
  UPDATE public.residents SET onboarding_status = 'in_progress' WHERE id = _id AND coalesce(onboarding_status,'') <> 'complete';
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.approve_onboarding_step(_step_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.resident_onboarding_steps;
BEGIN
  IF NOT (public.has_any_role(auth.uid(), ARRAY['admin','founder','managing_director']::app_role[])) THEN
    RAISE EXCEPTION 'Only the MD or a Founder can sign off onboarding steps';
  END IF;
  SELECT * INTO st FROM public.resident_onboarding_steps WHERE id = _step_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step not found'; END IF;
  IF st.step_key = 'handover' AND EXISTS (SELECT 1 FROM public.resident_onboarding_steps WHERE resident_id = st.resident_id AND id <> st.id AND status NOT IN ('complete','not_needed')) THEN
    RAISE EXCEPTION 'Finish every other step before the handover sign-off';
  END IF;
  PERFORM set_config('app.onboarding_approve','on',true);
  UPDATE public.resident_onboarding_steps SET approved_by = auth.uid(), approved_at = now(), status = 'complete',
    completed_by = coalesce(completed_by, auth.uid()), completed_at = coalesce(completed_at, now()), updated_at = now()
  WHERE id = _step_id;
  PERFORM set_config('app.onboarding_approve','off',true);
  IF st.step_key = 'handover' THEN
    UPDATE public.residents SET onboarding_status = 'complete' WHERE id = st.resident_id;
    PERFORM public.recompute_resident_lifecycle(st.resident_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_portal_done()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.resident_onboarding_steps SET status = 'complete', completed_at = now(), completed_by = NEW.invited_by
  WHERE resident_id = NEW.resident_id AND step_key = 'portal' AND status <> 'complete';
  RETURN NEW;
END $$;
CREATE TRIGGER onboarding_portal_done AFTER INSERT OR UPDATE OF resident_id ON public.resident_users FOR EACH ROW EXECUTE FUNCTION public.onboarding_portal_done();
