
-- Residents: invite fields
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE UNIQUE INDEX IF NOT EXISTS residents_email_lower_idx
  ON public.residents (lower(email)) WHERE email IS NOT NULL;

-- Allow residents to view their own row
DROP POLICY IF EXISTS "Residents view own row" ON public.residents;
CREATE POLICY "Residents view own row" ON public.residents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- accept_resident_invite()
CREATE OR REPLACE FUNCTION public.accept_resident_invite()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  rid uuid;
BEGIN
  IF uid IS NULL OR mail = '' THEN RETURN false; END IF;

  SELECT id INTO rid FROM public.residents WHERE lower(email) = mail LIMIT 1;
  IF rid IS NULL THEN RETURN false; END IF;

  UPDATE public.residents SET user_id = uid
    WHERE id = rid AND (user_id IS NULL OR user_id <> uid);

  INSERT INTO public.user_roles(user_id, role)
  VALUES (uid, 'resident'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_resident_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_resident_invite() TO authenticated;

-- Resident <-> projects
CREATE TABLE IF NOT EXISTS public.resident_projects (
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resident_id, project_id)
);
ALTER TABLE public.resident_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage resident_projects" ON public.resident_projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Residents view own assignments" ON public.resident_projects
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid()));

-- Briefs
CREATE TABLE IF NOT EXISTS public.briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  title text NOT NULL,
  body  text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage briefs" ON public.briefs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Residents view own briefs" ON public.briefs
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid()));

CREATE TRIGGER briefs_updated_at BEFORE UPDATE ON public.briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body  text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Residents view published announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (published = true AND public.has_role(auth.uid(), 'resident'));

CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin','resident')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_resident_idx ON public.messages(resident_id, created_at);

CREATE POLICY "Admins manage messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Residents read own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid()));

CREATE POLICY "Residents send own messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'resident'
    AND resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid())
  );

-- Storage bucket for resident files
INSERT INTO storage.buckets (id, name, public)
VALUES ('resident-files', 'resident-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage resident-files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'resident-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'resident-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Residents read own resident-files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resident-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.residents WHERE user_id = auth.uid()
    )
  );
