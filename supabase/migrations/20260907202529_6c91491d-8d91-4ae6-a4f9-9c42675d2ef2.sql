CREATE POLICY "legal files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'legal-files' AND public.is_staff(auth.uid()));
CREATE POLICY "legal files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'legal-files' AND (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid())));
CREATE POLICY "legal files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'legal-files' AND (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid())));
CREATE POLICY "legal files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'legal-files' AND (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid())));