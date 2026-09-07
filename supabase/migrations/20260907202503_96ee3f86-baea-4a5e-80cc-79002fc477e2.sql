CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_kind text NOT NULL DEFAULT 'client',
  party_name text NOT NULL,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  contract_type text NOT NULL DEFAULT 'service',
  starts_on date,
  ends_on date,
  value_ugx integer,
  status text NOT NULL DEFAULT 'draft',
  owner_user_id uuid,
  file_path text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "contracts write" ON public.contracts FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()));
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX contracts_ends_on_idx ON public.contracts (ends_on);

CREATE TABLE public.partnerships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  partner_contact text,
  terms text,
  split_kind text NOT NULL DEFAULT 'percent',
  split_value numeric,
  starts_on date,
  ends_on date,
  status text NOT NULL DEFAULT 'active',
  owner_user_id uuid,
  notes text,
  file_path text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnerships TO authenticated;
GRANT ALL ON public.partnerships TO service_role;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partnerships read" ON public.partnerships FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "partnerships write" ON public.partnerships FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()));
CREATE TRIGGER partnerships_updated_at BEFORE UPDATE ON public.partnerships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'template',
  version text,
  file_path text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal docs read" ON public.legal_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "legal docs write" ON public.legal_documents FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()));
CREATE TRIGGER legal_documents_updated_at BEFORE UPDATE ON public.legal_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.compliance_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  authority text,
  reference_no text,
  renews_on date,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_items TO authenticated;
GRANT ALL ON public.compliance_items TO service_role;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance read" ON public.compliance_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance write" ON public.compliance_items FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal') OR public.can_see_finance(auth.uid()));
CREATE TRIGGER compliance_items_updated_at BEFORE UPDATE ON public.compliance_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  body text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly reports read" ON public.weekly_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "weekly reports write" ON public.weekly_reports FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid())) WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER weekly_reports_updated_at BEFORE UPDATE ON public.weekly_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ops_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT jsonb_build_object(
    'residents_active', (SELECT count(*) FROM public.residents WHERE status = 'active'),
    'residents_total', (SELECT count(*) FROM public.residents),
    'contracts_active', (SELECT count(*) FROM public.contracts WHERE status = 'active'),
    'contracts_expiring', (SELECT count(*) FROM public.contracts WHERE ends_on IS NOT NULL AND ends_on BETWEEN current_date AND current_date + 60),
    'team_size', (SELECT count(*) FROM public.team_members),
    'shoots_month', (SELECT count(*) FROM public.shoot_days WHERE shoot_date >= date_trunc('month', current_date)::date),
    'shoots_upcoming', (SELECT count(*) FROM public.shoot_days WHERE shoot_date >= current_date AND status <> 'wrapped'),
    'content_by_stage', (SELECT coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) FROM (SELECT stage, count(*) AS n FROM public.content_items GROUP BY stage) s),
    'content_month', (SELECT count(*) FROM public.content_items WHERE added_on >= date_trunc('month', current_date)::date),
    'metrics_overdue', (SELECT count(*) FROM public.content_items WHERE metrics_due_at IS NOT NULL AND metrics_due_at < current_date AND metrics_filled_at IS NULL)
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ops_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_overview() TO authenticated;