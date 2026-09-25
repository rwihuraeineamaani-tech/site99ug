CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder','creative_director','managing_director','operations_manager','sales_head','finance_ops','creative','strategist','legal','talent','communications','designer','hr','event_manager','scanner','viewer','site_editor','team_member']::public.app_role[])
$$;