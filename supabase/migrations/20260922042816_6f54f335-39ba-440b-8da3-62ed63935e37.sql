
CREATE POLICY "Portal users read own contract files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id IN ('resident-contracts', 'legal-files', 'finance-files')
  AND public.my_resident_id(auth.uid()) IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.resident_contracts rc WHERE rc.file_path = storage.objects.name AND rc.resident_id = public.my_resident_id(auth.uid()))
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.file_path = storage.objects.name AND c.resident_id = public.my_resident_id(auth.uid()))
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.file_path = storage.objects.name AND i.resident_id = public.my_resident_id(auth.uid()) AND i.direction = 'out')
  )
);
