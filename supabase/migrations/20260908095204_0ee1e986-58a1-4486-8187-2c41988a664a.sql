CREATE POLICY "Staff read client logos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'client-logos' AND public.is_staff(auth.uid()));

CREATE POLICY "Admins write client logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-logos' AND (public.has_role(auth.uid(), 'admin') OR public.is_leadership(auth.uid())));

CREATE POLICY "Admins update client logos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'client-logos' AND (public.has_role(auth.uid(), 'admin') OR public.is_leadership(auth.uid())))
WITH CHECK (bucket_id = 'client-logos' AND (public.has_role(auth.uid(), 'admin') OR public.is_leadership(auth.uid())));

CREATE POLICY "Admins delete client logos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'client-logos' AND (public.has_role(auth.uid(), 'admin') OR public.is_leadership(auth.uid())));

CREATE POLICY "Staff read brand files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'brand-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff write brand files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update brand files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'brand-files' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'brand-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete brand files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'brand-files' AND public.is_staff(auth.uid()));