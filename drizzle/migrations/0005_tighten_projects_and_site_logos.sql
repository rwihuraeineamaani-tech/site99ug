DROP POLICY IF EXISTS "Staff can view projects" ON public.projects;
CREATE POLICY "Staff can view projects" ON public.projects FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Published site logos are public" ON storage.objects;
CREATE POLICY "Admins read site-logos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'site-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));