
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restrict has_role execution to authenticated only (still works inside RLS for anon since policies are bypassed)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
