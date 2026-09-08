CREATE TABLE public.brand_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL UNIQUE REFERENCES public.residents(id) ON DELETE CASCADE,
  primary_font text,
  primary_font_use text,
  secondary_font text,
  secondary_font_use text,
  colours jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone text,
  dos text,
  donts text,
  notes text,
  pdf_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_guidelines TO authenticated;
GRANT ALL ON public.brand_guidelines TO service_role;
ALTER TABLE public.brand_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read brand guidelines" ON public.brand_guidelines
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Client team writes brand guidelines" ON public.brand_guidelines
FOR ALL TO authenticated
USING (
  public.is_leadership(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_resident_contact(auth.uid(), resident_id)
  OR public.is_resident_handler(auth.uid(), resident_id)
)
WITH CHECK (
  public.is_leadership(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_resident_contact(auth.uid(), resident_id)
  OR public.is_resident_handler(auth.uid(), resident_id)
);

CREATE TRIGGER brand_guidelines_updated_at
BEFORE UPDATE ON public.brand_guidelines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Logo',
  file_path text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_assets TO authenticated;
GRANT ALL ON public.brand_assets TO service_role;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read brand assets" ON public.brand_assets
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Client team writes brand assets" ON public.brand_assets
FOR ALL TO authenticated
USING (
  public.is_leadership(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_resident_contact(auth.uid(), resident_id)
  OR public.is_resident_handler(auth.uid(), resident_id)
)
WITH CHECK (
  public.is_leadership(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_resident_contact(auth.uid(), resident_id)
  OR public.is_resident_handler(auth.uid(), resident_id)
);

CREATE TRIGGER brand_assets_updated_at
BEFORE UPDATE ON public.brand_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX brand_assets_resident_idx ON public.brand_assets(resident_id, sort);

CREATE OR REPLACE FUNCTION public.set_resident_logo(_resident_id uuid, _path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a system admin can change a client logo';
  END IF;
  UPDATE public.residents SET avatar_url = _path, updated_at = now() WHERE id = _resident_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_resident_logo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_resident_logo(uuid, text) TO authenticated;