ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.resident_records()
RETURNS TABLE (
  id uuid,
  name text,
  territory text,
  since text,
  status text,
  email text,
  user_id uuid,
  avatar_url text,
  visible boolean,
  contact_user_id uuid,
  handler_user_id uuid,
  notes text,
  invited_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.territory, r.since, r.status, r.email, r.user_id, r.avatar_url,
         r.visible, r.contact_user_id, r.handler_user_id, r.notes, r.invited_at, r.created_at
  FROM public.residents r
  WHERE public.is_staff(auth.uid())
  ORDER BY r.name;
$$;

REVOKE EXECUTE ON FUNCTION public.resident_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_records() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_resident_notes(_resident_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_leadership(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.residents SET notes = _notes, updated_at = now() WHERE id = _resident_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_resident_notes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_resident_notes(uuid, text) TO authenticated;