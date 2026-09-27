CREATE POLICY "sop versions editors insert" ON public.sop_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()));
GRANT INSERT ON public.sop_versions TO authenticated;
ALTER FUNCTION public.publish_sop(uuid,text) SECURITY INVOKER;