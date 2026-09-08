DROP POLICY IF EXISTS "Leadership writes client logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins write client logos" ON storage.objects;
CREATE POLICY "Admins write client logos" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));