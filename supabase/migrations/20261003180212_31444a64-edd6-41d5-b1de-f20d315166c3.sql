ALTER TABLE public.staff_pay ADD COLUMN IF NOT EXISTS kpi_weights jsonb;

CREATE OR REPLACE FUNCTION public.guard_staff_kpi_weights() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.kpi_weights IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.kpi_weights IS DISTINCT FROM OLD.kpi_weights) THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only the System Admin can change how a person''s KPI is built.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_staff_kpi_weights() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS guard_staff_kpi_weights ON public.staff_pay;
CREATE TRIGGER guard_staff_kpi_weights BEFORE INSERT OR UPDATE ON public.staff_pay FOR EACH ROW EXECUTE FUNCTION public.guard_staff_kpi_weights();