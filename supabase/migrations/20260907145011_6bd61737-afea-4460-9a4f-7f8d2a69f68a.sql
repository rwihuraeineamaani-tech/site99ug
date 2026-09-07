CREATE TABLE public.resident_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text,
  starts_on date,
  ends_on date,
  value_ugx integer,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_contracts TO authenticated;
GRANT ALL ON public.resident_contracts TO service_role;

ALTER TABLE public.resident_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read contracts"
ON public.resident_contracts FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Leadership, finance and legal manage contracts"
ON public.resident_contracts FOR ALL TO authenticated
USING (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'))
WITH CHECK (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()) OR public.has_role(auth.uid(), 'legal'));

CREATE INDEX resident_contracts_resident_idx ON public.resident_contracts(resident_id);

CREATE TRIGGER resident_contracts_updated_at
BEFORE UPDATE ON public.resident_contracts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();