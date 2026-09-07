-- Access helper functions -------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','founder','creative_director','managing_director',
                   'sales_head','finance_ops','creative','legal',
                   'event_manager','viewer','site_editor','scanner')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_leadership(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','founder','managing_director')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_see_finance(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','founder','managing_director','finance_ops')
  )
$$;

-- Clients -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  contact_email text,
  contact_phone text,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can create clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Leadership can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (public.is_leadership(auth.uid()));

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Client logins --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_users TO authenticated;
GRANT ALL ON public.client_users TO service_role;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view client logins" ON public.client_users
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Client can view own link" ON public.client_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Leadership can invite client logins" ON public.client_users
  FOR INSERT TO authenticated WITH CHECK (public.is_leadership(auth.uid()));
CREATE POLICY "Leadership can update client logins" ON public.client_users
  FOR UPDATE TO authenticated USING (public.is_leadership(auth.uid())) WITH CHECK (public.is_leadership(auth.uid()));
CREATE POLICY "Leadership can remove client logins" ON public.client_users
  FOR DELETE TO authenticated USING (public.is_leadership(auth.uid()));

CREATE TRIGGER client_users_updated_at BEFORE UPDATE ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.client_users WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "Staff can view clients" ON public.clients
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Clients can view their own record" ON public.clients
  FOR SELECT TO authenticated USING (id = public.my_client_id());

-- Invited client claims their login on first sign-in -------------------------

CREATE OR REPLACE FUNCTION public.accept_client_invite()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  verified boolean := coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
  row_id uuid;
BEGIN
  IF uid IS NULL OR mail = '' OR NOT verified THEN RETURN false; END IF;

  SELECT id INTO row_id FROM public.client_users WHERE lower(email) = mail LIMIT 1;
  IF row_id IS NULL THEN RETURN false; END IF;

  UPDATE public.client_users
     SET user_id = uid, accepted_at = coalesce(accepted_at, now())
   WHERE id = row_id AND (user_id IS NULL OR user_id = uid);

  INSERT INTO public.user_roles(user_id, role)
  VALUES (uid, 'client'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_leadership(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_client_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_client_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_leadership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_client_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_client_invite() TO authenticated, service_role;