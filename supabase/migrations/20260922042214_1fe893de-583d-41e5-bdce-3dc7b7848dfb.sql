DROP POLICY IF EXISTS "Editors manage announcements" ON public.announcements;
CREATE POLICY "Leadership manage announcements" ON public.announcements FOR ALL TO authenticated
USING (public.is_leadership(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'site_editor'::app_role]))
WITH CHECK (public.is_leadership(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'site_editor'::app_role]));