CREATE TABLE public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  platform text NOT NULL,
  handle text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_accounts TO authenticated;
GRANT ALL ON public.client_accounts TO service_role;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX client_accounts_resident_idx ON public.client_accounts (resident_id);

CREATE OR REPLACE FUNCTION public.can_touch_resident_accounts(_resident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = _resident_id
        AND (r.contact_user_id = auth.uid() OR r.handler_user_id = auth.uid())
    )
$$;

CREATE OR REPLACE FUNCTION public.can_touch_account(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_accounts a
    WHERE a.id = _account_id
      AND public.can_touch_resident_accounts(a.resident_id)
  )
$$;

REVOKE ALL ON FUNCTION public.can_touch_resident_accounts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_touch_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_touch_resident_accounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_touch_account(uuid) TO authenticated;

CREATE POLICY "Team can view accounts they handle"
  ON public.client_accounts FOR SELECT TO authenticated
  USING (public.can_touch_resident_accounts(resident_id));

CREATE POLICY "Leadership can add accounts"
  ON public.client_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership(auth.uid()));

CREATE POLICY "Leadership can edit accounts"
  ON public.client_accounts FOR UPDATE TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));

CREATE POLICY "Leadership can remove accounts"
  ON public.client_accounts FOR DELETE TO authenticated
  USING (public.is_leadership(auth.uid()));

CREATE TRIGGER client_accounts_set_updated_at
  BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.account_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  followers integer,
  profile_visits integer,
  reach integer,
  impressions integer,
  posts integer,
  link_clicks integer,
  filled_by uuid,
  filled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_metrics TO authenticated;
GRANT ALL ON public.account_metrics TO service_role;
ALTER TABLE public.account_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX account_metrics_account_week_idx ON public.account_metrics (account_id, week_start DESC);

CREATE POLICY "Team can view numbers for their accounts"
  ON public.account_metrics FOR SELECT TO authenticated
  USING (public.can_touch_account(account_id));

CREATE POLICY "Team can add numbers for their accounts"
  ON public.account_metrics FOR INSERT TO authenticated
  WITH CHECK (public.can_touch_account(account_id));

CREATE POLICY "Team can edit numbers for their accounts"
  ON public.account_metrics FOR UPDATE TO authenticated
  USING (public.can_touch_account(account_id))
  WITH CHECK (public.can_touch_account(account_id));

CREATE POLICY "Leadership can remove numbers"
  ON public.account_metrics FOR DELETE TO authenticated
  USING (public.is_leadership(auth.uid()));

CREATE TRIGGER account_metrics_set_updated_at
  BEFORE UPDATE ON public.account_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.my_pending_account_weeks()
RETURNS TABLE(account_id uuid, resident_id uuid, resident_name text, platform text, handle text, week_start date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, r.id, r.name, a.platform, a.handle,
         (date_trunc('week', now())::date - 7) AS week_start
  FROM public.client_accounts a
  JOIN public.residents r ON r.id = a.resident_id
  WHERE a.active
    AND (r.contact_user_id = auth.uid() OR r.handler_user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.account_metrics m
      WHERE m.account_id = a.id
        AND m.week_start = (date_trunc('week', now())::date - 7)
    )
  ORDER BY r.name, a.sort, a.platform
$$;

REVOKE ALL ON FUNCTION public.my_pending_account_weeks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_account_weeks() TO authenticated;