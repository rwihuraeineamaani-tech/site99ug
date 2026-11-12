ALTER TABLE public.document_profile
  ADD COLUMN IF NOT EXISTS reg_number text,
  ADD COLUMN IF NOT EXISTS nssf_number text,
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_vat_rate numeric NOT NULL DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS financial_year_start date DEFAULT '2026-01-01',
  ADD COLUMN IF NOT EXISTS books_start_date date DEFAULT '2026-11-01',
  ADD COLUMN IF NOT EXISTS invoice_due_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS finance_contact_name text,
  ADD COLUMN IF NOT EXISTS finance_contact_phone text,
  ADD COLUMN IF NOT EXISTS finance_contact_email text;

CREATE TABLE public.legacy_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  run_date date,
  line_no integer NOT NULL,
  full_name text NOT NULL,
  role text,
  channel text,
  account_name text,
  account_number text,
  amount_ugx integer NOT NULL DEFAULT 0,
  charges_ugx integer NOT NULL DEFAULT 0,
  with_charges_ugx integer NOT NULL DEFAULT 0,
  contacted_by text,
  processed_by text,
  approved_by text,
  flags text[] NOT NULL DEFAULT '{}',
  flag_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legacy_payroll TO authenticated;
GRANT ALL ON public.legacy_payroll TO service_role;
ALTER TABLE public.legacy_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance reads the old payroll sheet" ON public.legacy_payroll
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));