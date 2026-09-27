CREATE TABLE public.sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  title text NOT NULL,
  summary text,
  owner_role text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version int NOT NULL DEFAULT 0,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort int NOT NULL DEFAULT 0,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sops TO authenticated;
GRANT ALL ON public.sops TO service_role;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sops read" ON public.sops FOR SELECT TO authenticated
  USING ((status='published' AND public.is_staff(auth.uid())) OR public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()));
CREATE POLICY "sops write" ON public.sops FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()));
CREATE TRIGGER sops_touch BEFORE UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sop_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  version int NOT NULL,
  title text NOT NULL,
  summary text,
  owner_role text,
  sections jsonb NOT NULL,
  change_note text,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, version)
);
GRANT SELECT ON public.sop_versions TO authenticated;
GRANT ALL ON public.sop_versions TO service_role;
ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop versions read" ON public.sop_versions FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()) OR public.is_leadership(auth.uid()));

CREATE TABLE public.sop_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version int NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, user_id, version)
);
GRANT SELECT, INSERT ON public.sop_reads TO authenticated;
GRANT ALL ON public.sop_reads TO service_role;
ALTER TABLE public.sop_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop reads own insert" ON public.sop_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "sop reads view" ON public.sop_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_leadership(auth.uid()) OR public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid()));

-- Publishing snapshots a new version
CREATE OR REPLACE FUNCTION public.publish_sop(_id uuid, _note text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.sops; v int;
BEGIN
  IF NOT (public.is_system_admin(auth.uid()) OR public.is_founder(auth.uid())) THEN
    RAISE EXCEPTION 'Only the System Admin or a Founder can publish SOPs';
  END IF;
  SELECT * INTO s FROM public.sops WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOP not found'; END IF;
  v := s.version + 1;
  INSERT INTO public.sop_versions(sop_id,version,title,summary,owner_role,sections,change_note,edited_by)
    VALUES (s.id,v,s.title,s.summary,s.owner_role,s.sections,_note,auth.uid());
  UPDATE public.sops SET version=v, status='published', published_at=now(), updated_by=auth.uid() WHERE id=_id;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.publish_sop(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_sop(uuid,text) TO authenticated;