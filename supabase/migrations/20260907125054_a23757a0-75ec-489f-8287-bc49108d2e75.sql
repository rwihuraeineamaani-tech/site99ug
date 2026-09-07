ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_items_resident_id_idx ON public.content_items(resident_id);

CREATE OR REPLACE FUNCTION public.resident_options()
RETURNS TABLE(id uuid, name text, territory text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.territory
  FROM public.residents r
  WHERE public.is_staff(auth.uid())
  ORDER BY r.display_order, r.name
$$;

REVOKE ALL ON FUNCTION public.resident_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_options() TO authenticated;