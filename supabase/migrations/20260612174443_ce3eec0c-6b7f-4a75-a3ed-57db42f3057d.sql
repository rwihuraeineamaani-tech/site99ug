
-- 1) Convert public_residents view to security_invoker so RLS applies as the caller
ALTER VIEW public.public_residents SET (security_invoker = on);
GRANT SELECT ON public.public_residents TO anon, authenticated;

-- 2) Restrict anon column access on residents (hide email, user_id, invited_at, timestamps)
REVOKE SELECT ON public.residents FROM anon;
GRANT SELECT (id, name, territory, since, status, display_order, avatar_url, visible)
  ON public.residents TO anon;

-- 3) Allow anon to read only visible residents (column grant above limits exposed fields)
DROP POLICY IF EXISTS "Anon can view visible residents" ON public.residents;
CREATE POLICY "Anon can view visible residents"
  ON public.residents
  FOR SELECT
  TO anon
  USING (visible = true);

-- 4) Allow authenticated users to also see visible residents through the directory
DROP POLICY IF EXISTS "Authenticated can view visible residents" ON public.residents;
CREATE POLICY "Authenticated can view visible residents"
  ON public.residents
  FOR SELECT
  TO authenticated
  USING (visible = true);
