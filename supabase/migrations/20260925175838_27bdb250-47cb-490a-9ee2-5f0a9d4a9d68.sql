CREATE TABLE public.access_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  actor_id uuid,
  before_roles public.app_role[] NOT NULL DEFAULT '{}',
  after_roles public.app_role[] NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_change_history TO authenticated;
GRANT ALL ON public.access_change_history TO service_role;
ALTER TABLE public.access_change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admin reads access history"
ON public.access_change_history FOR SELECT TO authenticated
USING (public.is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'team_member','admin','founder','managing_director','operations_manager',
        'finance_ops','legal','sales_head','strategist','creative','talent',
        'communications','designer','event_manager','site_editor','scanner','viewer',
        'creative_director'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.is_staff(_user_id) $$;

CREATE OR REPLACE FUNCTION public.can_edit_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY[
    'admin','founder','managing_director','creative','strategist','communications','designer'
  ]::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_see_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY[
    'admin','founder','managing_director','finance_ops'
  ]::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_leadership(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY[
    'admin','founder','managing_director','operations_manager'
  ]::public.app_role[])
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_content(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_content(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_leadership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_content(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_content(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_leadership(uuid) TO authenticated, service_role;