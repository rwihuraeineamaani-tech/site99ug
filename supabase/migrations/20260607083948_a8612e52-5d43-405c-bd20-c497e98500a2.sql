DROP VIEW IF EXISTS public.public_residents;

CREATE VIEW public.public_residents
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  territory,
  since,
  status,
  display_order,
  avatar_url,
  visible
FROM public.residents
WHERE visible = true;

GRANT SELECT ON public.public_residents TO anon, authenticated;