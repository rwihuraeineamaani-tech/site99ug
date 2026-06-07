ALTER VIEW public.public_residents SET (security_invoker = false);
GRANT SELECT ON public.public_residents TO anon, authenticated;