
CREATE TABLE IF NOT EXISTS public.document_sequences (
  code text NOT NULL, yy int NOT NULL, letter char(1) NOT NULL DEFAULT 'A', n int NOT NULL DEFAULT 0,
  PRIMARY KEY (code, yy));
GRANT ALL ON public.document_sequences TO service_role;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_doc_number(_code text, _on date DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE y int := (extract(year FROM COALESCE(_on, (now() AT TIME ZONE 'Africa/Kampala')::date))::int % 100);
  l char(1); v int;
BEGIN
  IF _code !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Bad document code'; END IF;
  INSERT INTO public.document_sequences (code, yy, letter, n) VALUES (_code, y, 'A', 1)
  ON CONFLICT (code, yy) DO UPDATE SET
    letter = CASE WHEN document_sequences.n >= 999 THEN chr(ascii(document_sequences.letter) + 1)::char(1) ELSE document_sequences.letter END,
    n = CASE WHEN document_sequences.n >= 999 THEN 1 ELSE document_sequences.n + 1 END
  RETURNING letter, n INTO l, v;
  IF l > 'Z' THEN RAISE EXCEPTION 'Number series % exhausted', _code; END IF;
  RETURN 'S99' || lpad(y::text, 2, '0') || _code || l || lpad(v::text, 3, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_doc_number(text, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_number(text, date) TO authenticated, service_role;

-- Invoices: new format going forward, old number kept
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS legacy_number text;
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.next_doc_number('INV') $$;

-- Accounts
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#64748b';
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS opening_balance_ugx bigint NOT NULL DEFAULT 0;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS opening_date date NOT NULL DEFAULT '2026-11-01';
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_production_fund boolean NOT NULL DEFAULT false;

-- Cashbook
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS doc_number text;
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS charge_ugx integer NOT NULL DEFAULT 0;
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS charge_for_id uuid;
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS tid text;
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
ALTER TABLE public.cashbook_entries ADD COLUMN IF NOT EXISTS reconciled_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS cashbook_entries_doc_number_key ON public.cashbook_entries(doc_number);

CREATE OR REPLACE FUNCTION public.cashbook_assign_doc_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.doc_number IS NULL THEN
    NEW.doc_number := public.next_doc_number(
      CASE WHEN NEW.transfer_group_id IS NOT NULL THEN 'TRF'
           WHEN NEW.direction = 'in' THEN 'RCT' ELSE 'EXP' END, NEW.entry_date);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cashbook_doc_number_trg ON public.cashbook_entries;
CREATE TRIGGER cashbook_doc_number_trg BEFORE INSERT ON public.cashbook_entries
FOR EACH ROW EXECUTE FUNCTION public.cashbook_assign_doc_number();

-- Full entry with charges + TID
CREATE OR REPLACE FUNCTION public.record_cash_entry(
  _wallet_id uuid, _direction text, _amount integer, _entry_date date, _category text,
  _counterparty_name text, _note text DEFAULT NULL, _reference text DEFAULT NULL,
  _tid text DEFAULT NULL, _charge integer DEFAULT 0, _resident_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; k text;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _direction NOT IN ('in','out') OR COALESCE(_amount,0) <= 0 THEN RAISE EXCEPTION 'Enter a direction and an amount above zero'; END IF;
  SELECT kind INTO k FROM public.wallets WHERE id = _wallet_id;
  IF k = 'mobile_money' AND COALESCE(trim(_tid),'') = '' THEN RAISE EXCEPTION 'Mobile money needs a transaction ID (TID)'; END IF;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name,
    counterparty_kind, resident_id, note, reference, tid, charge_ugx, created_by)
  VALUES (_wallet_id, _direction, _amount, COALESCE(_entry_date, (now() AT TIME ZONE 'Africa/Kampala')::date),
    COALESCE(_category,'general'), COALESCE(_counterparty_name,''), 'other', _resident_id, _note, _reference,
    NULLIF(trim(_tid),''), COALESCE(_charge,0), auth.uid())
  RETURNING id INTO _id;
  IF COALESCE(_charge,0) > 0 THEN
    INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name,
      counterparty_kind, note, tid, charge_for_id, created_by)
    VALUES (_wallet_id, 'out', _charge, COALESCE(_entry_date, (now() AT TIME ZONE 'Africa/Kampala')::date),
      CASE WHEN k = 'mobile_money' THEN 'mobile_money_charges' ELSE 'bank_charges' END,
      CASE WHEN k = 'mobile_money' THEN 'Mobile money charges' ELSE 'Bank charges' END, 'other',
      'Charge on ' || COALESCE(_counterparty_name,''), NULLIF(trim(_tid),''), _id, auth.uid());
  END IF;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_cash_entry(uuid,text,integer,date,text,text,text,text,text,integer,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
  _from uuid, _to uuid, _amount integer, _entry_date date, _note text DEFAULT NULL,
  _tid text DEFAULT NULL, _charge integer DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid := gen_random_uuid(); kf text; kt text; nf text; nt text; d date; num text; oid uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _from = _to OR COALESCE(_amount,0) <= 0 THEN RAISE EXCEPTION 'Pick two different accounts and an amount'; END IF;
  SELECT kind, name INTO kf, nf FROM public.wallets WHERE id = _from;
  SELECT kind, name INTO kt, nt FROM public.wallets WHERE id = _to;
  IF (kf = 'mobile_money' OR kt = 'mobile_money') AND COALESCE(trim(_tid),'') = '' THEN
    RAISE EXCEPTION 'Mobile money needs a transaction ID (TID)'; END IF;
  d := COALESCE(_entry_date, (now() AT TIME ZONE 'Africa/Kampala')::date);
  num := public.next_doc_number('TRF', d);
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name, counterparty_kind, note, tid, charge_ugx, transfer_group_id, doc_number, created_by)
  VALUES (_from, 'out', _amount, d, 'transfer', 'To ' || nt, 'other', _note, NULLIF(trim(_tid),''), COALESCE(_charge,0), g, num || '-OUT', auth.uid()) RETURNING id INTO oid;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name, counterparty_kind, note, tid, transfer_group_id, doc_number, created_by)
  VALUES (_to, 'in', _amount, d, 'transfer', 'From ' || nf, 'other', _note, NULLIF(trim(_tid),''), g, num || '-IN', auth.uid());
  IF COALESCE(_charge,0) > 0 THEN
    INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name, counterparty_kind, note, tid, charge_for_id, created_by)
    VALUES (_from, 'out', _charge, d, CASE WHEN kf = 'mobile_money' THEN 'mobile_money_charges' ELSE 'bank_charges' END,
      CASE WHEN kf = 'mobile_money' THEN 'Mobile money charges' ELSE 'Bank charges' END, 'other', 'Charge on transfer ' || num, NULLIF(trim(_tid),''), oid, auth.uid());
  END IF;
  RETURN g;
END $$;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid,uuid,integer,date,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_finance_account(_id uuid, _name text, _kind text, _color text, _opening bigint, _opening_date date, _account_number text, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _kind NOT IN ('bank','mobile_money','cash','payroll','production_fund','other') THEN RAISE EXCEPTION 'Bad account type'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.wallets (name, kind, color, opening_balance_ugx, opening_date, account_number, active, is_production_fund, sort)
    VALUES (trim(_name), _kind, COALESCE(_color,'#64748b'), COALESCE(_opening,0), COALESCE(_opening_date,'2026-11-01'), _account_number, COALESCE(_active,true), _kind='production_fund',
      COALESCE((SELECT max(sort)+1 FROM public.wallets),0)) RETURNING id INTO r;
  ELSE
    UPDATE public.wallets SET name=trim(_name), kind=_kind, color=COALESCE(_color,color), opening_balance_ugx=COALESCE(_opening,0),
      opening_date=COALESCE(_opening_date,opening_date), account_number=_account_number, active=COALESCE(_active,active),
      is_production_fund=(_kind='production_fund'), updated_at=now() WHERE id=_id RETURNING id INTO r;
  END IF;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.save_finance_account(uuid,text,text,text,bigint,date,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_entry_reconciled(_id uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.cashbook_entries SET reconciled_at = CASE WHEN _on THEN now() END, reconciled_by = CASE WHEN _on THEN auth.uid() END WHERE id=_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_entry_reconciled(uuid,boolean) TO authenticated;

-- Old sheet archive
CREATE TABLE IF NOT EXISTS public.legacy_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'finance_master_sheet',
  row_no int NOT NULL,
  entry_date date,
  original_id text,
  system_id text,
  description text,
  sheet_type text,
  money_in bigint NOT NULL DEFAULT 0,
  money_out bigint NOT NULL DEFAULT 0,
  sheet_balance bigint,
  corrected_category text,
  corrected_direction text,
  flags text[] NOT NULL DEFAULT '{}',
  flag_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, row_no));
GRANT SELECT ON public.legacy_ledger TO authenticated;
GRANT ALL ON public.legacy_ledger TO service_role;
ALTER TABLE public.legacy_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance reads old sheet" ON public.legacy_ledger FOR SELECT TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));

-- Production fund
CREATE OR REPLACE FUNCTION public.can_request_production_fund(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_any_role(_u, ARRAY['creative_director','strategist','admin']::public.app_role[]) $$;

CREATE TABLE IF NOT EXISTS public.production_fund_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  estimate_ugx bigint NOT NULL DEFAULT 0,
  estimate_note text,
  approved_limit_ugx bigint,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','declined')),
  submitted_by uuid, submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid, decided_at timestamptz, decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.production_fund_budgets TO authenticated;
GRANT ALL ON public.production_fund_budgets TO service_role;
ALTER TABLE public.production_fund_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fund budgets visible to fund people" ON public.production_fund_budgets FOR SELECT TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()) OR public.can_request_production_fund(auth.uid()));

CREATE TABLE IF NOT EXISTS public.production_fund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.production_fund_budgets(id) ON DELETE CASCADE,
  doc_number text UNIQUE,
  amount_ugx bigint NOT NULL CHECK (amount_ugx > 0),
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','transferred','declined')),
  requested_by uuid, requested_at timestamptz NOT NULL DEFAULT now(),
  transfer_group_id uuid, transferred_by uuid, transferred_at timestamptz, decline_reason text);
GRANT SELECT ON public.production_fund_requests TO authenticated;
GRANT ALL ON public.production_fund_requests TO service_role;
ALTER TABLE public.production_fund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fund requests visible to fund people" ON public.production_fund_requests FOR SELECT TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()) OR public.can_request_production_fund(auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_production_estimate(_month date, _estimate bigint, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m date := date_trunc('month', _month)::date; r uuid; s text;
BEGIN
  IF NOT public.can_request_production_fund(auth.uid()) THEN RAISE EXCEPTION 'Only the Head of Content Creation and Strategy or System Admin can send the estimate'; END IF;
  SELECT id, status INTO r, s FROM public.production_fund_budgets WHERE month = m;
  IF s = 'approved' THEN RAISE EXCEPTION 'This month is already approved'; END IF;
  INSERT INTO public.production_fund_budgets (month, estimate_ugx, estimate_note, submitted_by, status)
  VALUES (m, _estimate, _note, auth.uid(), 'submitted')
  ON CONFLICT (month) DO UPDATE SET estimate_ugx=EXCLUDED.estimate_ugx, estimate_note=EXCLUDED.estimate_note,
    submitted_by=auth.uid(), submitted_at=now(), status='submitted', updated_at=now()
  RETURNING id INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_production_estimate(date,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_production_estimate(_id uuid, _approve boolean, _limit bigint, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_founder(auth.uid()) THEN RAISE EXCEPTION 'Only a Co-founder can approve the production fund'; END IF;
  UPDATE public.production_fund_budgets SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
    approved_limit_ugx = CASE WHEN _approve THEN COALESCE(_limit, estimate_ugx) END,
    decided_by=auth.uid(), decided_at=now(), decision_note=_note, updated_at=now() WHERE id=_id;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_production_estimate(uuid,boolean,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_production_funds(_budget uuid, _amount bigint, _purpose text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lim bigint; used bigint; st text; r uuid;
BEGIN
  IF NOT public.can_request_production_fund(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT approved_limit_ugx, status INTO lim, st FROM public.production_fund_budgets WHERE id=_budget FOR UPDATE;
  IF st IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'This month has no approved limit yet'; END IF;
  SELECT COALESCE(sum(amount_ugx),0) INTO used FROM public.production_fund_requests WHERE budget_id=_budget AND status <> 'declined';
  IF used + _amount > lim THEN RAISE EXCEPTION 'Only UGX % left to request this month', to_char(lim-used,'FM999,999,999,999'); END IF;
  INSERT INTO public.production_fund_requests (budget_id, amount_ugx, purpose, requested_by, doc_number)
  VALUES (_budget, _amount, trim(_purpose), auth.uid(), public.next_doc_number('PRF')) RETURNING id INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.request_production_funds(uuid,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_production_funds(_id uuid, _from uuid, _tid text, _charge integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE fund uuid; a bigint; s text; num text; g uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT amount_ugx, status, doc_number INTO a, s, num FROM public.production_fund_requests WHERE id=_id FOR UPDATE;
  IF s <> 'requested' THEN RAISE EXCEPTION 'Already handled'; END IF;
  SELECT id INTO fund FROM public.wallets WHERE is_production_fund AND active ORDER BY sort LIMIT 1;
  IF fund IS NULL THEN RAISE EXCEPTION 'Add a Production fund account in Finance accounts first'; END IF;
  g := public.transfer_between_accounts(_from, fund, a::int, NULL, 'Production fund ' || num, _tid, _charge);
  UPDATE public.production_fund_requests SET status='transferred', transfer_group_id=g, transferred_by=auth.uid(), transferred_at=now() WHERE id=_id;
END $$;
GRANT EXECUTE ON FUNCTION public.release_production_funds(uuid,uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_production_request(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.production_fund_requests SET status='declined', decline_reason=_reason WHERE id=_id AND status='requested';
END $$;
GRANT EXECUTE ON FUNCTION public.decline_production_request(uuid,text) TO authenticated;
