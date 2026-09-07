ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';

ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_theme_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_theme_check CHECK (theme IN ('dark','light','system'));

GRANT UPDATE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

CREATE OR REPLACE FUNCTION public.team_members_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only an admin can change the account, email or owner of a team record';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_self_update_guard ON public.team_members;
CREATE TRIGGER team_members_self_update_guard
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.team_members_self_update_guard();

DROP POLICY IF EXISTS "Members update their own record" ON public.team_members;
CREATE POLICY "Members update their own record"
ON public.team_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage team members" ON public.team_members;
CREATE POLICY "Admins manage team members"
ON public.team_members
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));