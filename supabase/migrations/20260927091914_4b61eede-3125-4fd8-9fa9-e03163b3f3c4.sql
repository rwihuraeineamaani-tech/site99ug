ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  kind text not null default 'call',
  summary text not null,
  happened_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
CREATE TABLE public.client_followups (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  title text not null,
  due_date date,
  assigned_to uuid,
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
CREATE TABLE public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  rating int not null default 3,
  kind text not null default 'feedback',
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_interactions, public.client_followups, public.client_feedback TO authenticated;
GRANT ALL ON public.client_interactions, public.client_followups, public.client_feedback TO service_role;
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read interactions" ON public.client_interactions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add interactions" ON public.client_interactions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Author or leadership removes interactions" ON public.client_interactions FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_leadership(auth.uid()));
CREATE POLICY "Staff read followups" ON public.client_followups FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add followups" ON public.client_followups FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff update followups" ON public.client_followups FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_leadership(auth.uid()));
CREATE POLICY "Author or leadership removes followups" ON public.client_followups FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_leadership(auth.uid()));
CREATE POLICY "Staff read feedback" ON public.client_feedback FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add feedback" ON public.client_feedback FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Author or leadership removes feedback" ON public.client_feedback FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_leadership(auth.uid()));

CREATE OR REPLACE FUNCTION public.archive_resident(_id uuid, _archive boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only leadership can archive clients';
  END IF;
  UPDATE public.residents SET archived_at = CASE WHEN _archive THEN now() ELSE NULL END WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_resident(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only Founders or the System Administrator can delete a client';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices i JOIN public.resident_contracts c ON c.id = i.resident_contract_id WHERE c.resident_id = _id) THEN
    RAISE EXCEPTION 'This client has invoices. Archive them instead so the money history stays.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.resident_contracts WHERE resident_id = _id AND status = 'signed') THEN
    RAISE EXCEPTION 'This client has a signed contract. Archive them instead.';
  END IF;
  DELETE FROM public.residents WHERE id = _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.archive_resident(uuid, boolean), public.delete_resident(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_resident(uuid, boolean), public.delete_resident(uuid) TO authenticated;