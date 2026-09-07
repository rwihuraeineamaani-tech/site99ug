CREATE POLICY "Team uploads finance files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Finance and leadership read finance files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-files'
    AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()) OR owner = auth.uid()));

CREATE POLICY "Finance updates finance files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-files' AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())));

CREATE POLICY "Finance removes finance files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance-files' AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())));