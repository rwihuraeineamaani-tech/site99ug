-- 1. Residents email exposure: drop public SELECT, add admin SELECT, expose a safe public view

DROP POLICY IF EXISTS "Public can view residents" ON public.residents;

CREATE POLICY "Admins view all residents"
  ON public.residents
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.public_residents AS
SELECT
  id,
  name,
  territory,
  since,
  status,
  display_order,
  avatar_url,
  visible,
  created_at
FROM public.residents
WHERE visible = true;

GRANT SELECT ON public.public_residents TO anon, authenticated;

-- 2. Project-images bucket: remove broad listing policy. Direct public URLs still work
--    because the bucket itself is public; this only prevents enumerating objects.

DROP POLICY IF EXISTS "Public read project images" ON storage.objects;

-- 3. SECURITY DEFINER functions: restrict EXECUTE to signed-in users only.

REVOKE EXECUTE ON FUNCTION public.accept_resident_invite() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_resident_invite() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;