CREATE POLICY "Contract files readable by leadership, finance, legal"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resident-contracts'
  AND (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'))
);

CREATE POLICY "Contract files writable by leadership, finance, legal"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resident-contracts'
  AND (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'))
);

CREATE POLICY "Contract files updatable by leadership, finance, legal"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resident-contracts'
  AND (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'))
);

CREATE POLICY "Contract files deletable by leadership, finance, legal"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resident-contracts'
  AND (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'))
);