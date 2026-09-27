CREATE POLICY "staff avatars read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'staff-docs' AND storage.filename(name) LIKE 'avatar-%' AND public.is_staff(auth.uid()));