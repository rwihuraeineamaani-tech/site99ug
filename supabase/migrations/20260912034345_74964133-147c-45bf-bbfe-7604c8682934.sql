CREATE OR REPLACE FUNCTION public.approval_instance_visible(_instance_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.approval_instances i WHERE i.id = _instance_id AND (i.requester_id = _user_id OR public.is_system_admin(_user_id)))
      OR EXISTS (SELECT 1 FROM public.approval_tasks t WHERE t.instance_id = _instance_id AND (t.assigned_user_id = _user_id OR (t.assigned_role IS NOT NULL AND public.has_role(_user_id, t.assigned_role))));
$$;
REVOKE ALL ON FUNCTION public.approval_instance_visible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_instance_visible(uuid, uuid) TO authenticated, service_role;

DROP POLICY "People view relevant approval instances" ON public.approval_instances;
CREATE POLICY "People view relevant approval instances" ON public.approval_instances FOR SELECT TO authenticated
USING (public.approval_instance_visible(id, auth.uid()));

DROP POLICY "People view relevant approval tasks" ON public.approval_tasks;
CREATE POLICY "People view relevant approval tasks" ON public.approval_tasks FOR SELECT TO authenticated
USING (public.can_act_approval_task(approval_tasks.*, auth.uid()) OR public.is_system_admin(auth.uid()) OR public.approval_instance_visible(instance_id, auth.uid()));