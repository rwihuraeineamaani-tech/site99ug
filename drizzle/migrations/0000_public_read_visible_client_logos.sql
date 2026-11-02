CREATE POLICY "Public reads visible client logos" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'client-logos'
  AND EXISTS (SELECT 1 FROM public.residents r WHERE r.visible = true AND r.avatar_url = storage.objects.name)
);