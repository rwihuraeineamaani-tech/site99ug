CREATE OR REPLACE FUNCTION public.is_public_client_logo(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.residents WHERE visible = true AND avatar_url = _path)
$$;
GRANT EXECUTE ON FUNCTION public.is_public_client_logo(text) TO anon, authenticated;
DROP POLICY IF EXISTS "Public reads visible client logos" ON storage.objects;
CREATE POLICY "Public reads visible client logos" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'client-logos' AND public.is_public_client_logo(name));