DROP FUNCTION IF EXISTS public.resident_options();

CREATE FUNCTION public.resident_options()
RETURNS TABLE(id uuid, name text, territory text, contact_user_id uuid, handler_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.territory, r.contact_user_id, r.handler_user_id
  FROM public.residents r
  WHERE public.is_staff(auth.uid())
  ORDER BY r.display_order, r.name
$$;

REVOKE ALL ON FUNCTION public.resident_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_options() TO authenticated;