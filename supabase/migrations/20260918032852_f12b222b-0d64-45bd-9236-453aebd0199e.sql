DROP VIEW IF EXISTS public.public_residents;

CREATE OR REPLACE FUNCTION public.list_public_residents()
RETURNS TABLE (
  id uuid,
  name text,
  territory text,
  since text,
  status text,
  display_order integer,
  avatar_url text,
  visible boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name::text, r.territory::text, r.since::text, r.status::text,
         r.display_order, r.avatar_url::text, r.visible
  FROM public.residents r
  WHERE r.visible = true
  ORDER BY r.display_order NULLS LAST, r.name
$$;

REVOKE ALL ON FUNCTION public.list_public_residents() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_residents() TO anon, authenticated;