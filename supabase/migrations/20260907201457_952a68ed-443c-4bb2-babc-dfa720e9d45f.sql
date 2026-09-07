CREATE POLICY "Finance reads cashbook receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cashbook-receipts' AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())));
CREATE POLICY "Finance uploads cashbook receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cashbook-receipts' AND (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())));
CREATE POLICY "Finance updates cashbook receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cashbook-receipts' AND (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())))
  WITH CHECK (bucket_id = 'cashbook-receipts' AND (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())));
CREATE POLICY "Finance deletes cashbook receipts" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cashbook-receipts' AND (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())));