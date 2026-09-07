-- helpers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_md(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder','managing_director']::app_role[])
$$;
REVOKE EXECUTE ON FUNCTION public.is_md(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_md(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_founder(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder']::app_role[])
$$;
REVOKE EXECUTE ON FUNCTION public.is_founder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_founder(uuid) TO authenticated;

-- audit ---------------------------------------------------------------------
CREATE TABLE public.finance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  action text NOT NULL,
  actor uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_audit TO authenticated;
GRANT ALL ON public.finance_audit TO service_role;
ALTER TABLE public.finance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read the audit trail" ON public.finance_audit
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE INDEX finance_audit_row_idx ON public.finance_audit (table_name, row_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.finance_audit_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.finance_audit (table_name, row_id, action, actor, before, after)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$;

-- cash requests --------------------------------------------------------------
CREATE TABLE public.cash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL DEFAULT auth.uid(),
  amount_ugx integer NOT NULL CHECK (amount_ugx > 0),
  purpose text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  needed_on date,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE SET NULL,
  attachment_path text,
  status text NOT NULL DEFAULT 'submitted',
  md_approved_by uuid,
  md_approved_at timestamptz,
  founder_approved_by uuid,
  founder_approved_at timestamptz,
  declined_by uuid,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cash_requests TO authenticated;
GRANT ALL ON public.cash_requests TO service_role;
ALTER TABLE public.cash_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See your own requests, approvers and finance see all" ON public.cash_requests
  FOR SELECT TO authenticated
  USING (requester = auth.uid() OR public.is_md(auth.uid()) OR public.can_see_finance(auth.uid()));
CREATE POLICY "Staff raise their own cash requests" ON public.cash_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "Requester edits while still submitted" ON public.cash_requests
  FOR UPDATE TO authenticated
  USING (requester = auth.uid() AND status = 'submitted')
  WITH CHECK (requester = auth.uid());
CREATE TRIGGER cash_requests_updated_at BEFORE UPDATE ON public.cash_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cash_requests_audit AFTER INSERT OR UPDATE OR DELETE ON public.cash_requests
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

-- recurring payments ---------------------------------------------------------
CREATE TABLE public.recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_name text NOT NULL,
  payee_kind text NOT NULL DEFAULT 'external',
  payee_user_id uuid,
  amount_ugx integer NOT NULL CHECK (amount_ugx >= 0),
  category text NOT NULL DEFAULT 'general',
  day_of_month integer NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_payments TO authenticated;
GRANT ALL ON public.recurring_payments TO service_role;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read recurring payments" ON public.recurring_payments
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance manages recurring payments" ON public.recurring_payments
  FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()));
CREATE TRIGGER recurring_payments_updated_at BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER recurring_payments_audit AFTER INSERT OR UPDATE OR DELETE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

-- payment runs ---------------------------------------------------------------
CREATE TABLE public.payment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  built_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_runs TO authenticated;
GRANT ALL ON public.payment_runs TO service_role;
ALTER TABLE public.payment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read payment runs" ON public.payment_runs
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance manages payment runs" ON public.payment_runs
  FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()));
CREATE TRIGGER payment_runs_updated_at BEFORE UPDATE ON public.payment_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_runs_audit AFTER INSERT OR UPDATE OR DELETE ON public.payment_runs
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

CREATE TABLE public.payment_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payment_runs(id) ON DELETE CASCADE,
  recurring_id uuid REFERENCES public.recurring_payments(id) ON DELETE SET NULL,
  payee_name text NOT NULL,
  payee_kind text NOT NULL DEFAULT 'external',
  payee_user_id uuid,
  amount_ugx integer NOT NULL CHECK (amount_ugx >= 0),
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_run_lines TO authenticated;
GRANT ALL ON public.payment_run_lines TO service_role;
ALTER TABLE public.payment_run_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read run lines" ON public.payment_run_lines
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance manages run lines" ON public.payment_run_lines
  FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()));
CREATE INDEX payment_run_lines_run_idx ON public.payment_run_lines (run_id);
CREATE TRIGGER payment_run_lines_updated_at BEFORE UPDATE ON public.payment_run_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_run_lines_audit AFTER INSERT OR UPDATE OR DELETE ON public.payment_run_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

-- transactions ---------------------------------------------------------------
CREATE TABLE public.txn_counters (
  period text PRIMARY KEY,
  n integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.txn_counters TO service_role;
ALTER TABLE public.txn_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_ref text NOT NULL UNIQUE,
  amount_ugx integer NOT NULL,
  direction text NOT NULL DEFAULT 'out',
  source_kind text NOT NULL,
  source_id uuid,
  payee_name text NOT NULL,
  payee_kind text NOT NULL DEFAULT 'external',
  payee_user_id uuid,
  category text NOT NULL DEFAULT 'general',
  method text,
  method_reference text,
  invoice_no text,
  invoice_path text,
  note text,
  paid_by uuid DEFAULT auth.uid(),
  paid_at timestamptz NOT NULL DEFAULT now(),
  reverses_txn_id uuid REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())
         OR payee_user_id = auth.uid());
CREATE INDEX transactions_paid_at_idx ON public.transactions (paid_at DESC);
CREATE INDEX transactions_payee_trgm ON public.transactions USING gin (payee_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.transactions_set_ref()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  period text := to_char(COALESCE(NEW.paid_at, now()), 'YYMM');
  seq integer;
BEGIN
  INSERT INTO public.txn_counters (period, n) VALUES (period, 1)
  ON CONFLICT (period) DO UPDATE SET n = public.txn_counters.n + 1
  RETURNING n INTO seq;
  NEW.txn_ref := 'TXN-' || period || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER transactions_set_ref BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_set_ref();

CREATE OR REPLACE FUNCTION public.transactions_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Transactions cannot be changed or removed. Record a reversal instead.'
    USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER transactions_immutable BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_immutable();
CREATE TRIGGER transactions_audit AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

-- loans ----------------------------------------------------------------------
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_kind text NOT NULL DEFAULT 'staff',
  counterparty_user_id uuid,
  counterparty_name text NOT NULL,
  direction text NOT NULL DEFAULT 'lent',
  principal_ugx integer NOT NULL CHECK (principal_ugx > 0),
  agreed_total_ugx integer,
  purpose text,
  start_on date NOT NULL DEFAULT current_date,
  schedule_note text,
  status text NOT NULL DEFAULT 'pending_approval',
  md_approved_by uuid,
  md_approved_at timestamptz,
  founder_approved_by uuid,
  founder_approved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See your own loans, finance and leadership see all" ON public.loans
  FOR SELECT TO authenticated
  USING (counterparty_user_id = auth.uid() OR public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance and leadership manage loans" ON public.loans
  FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loans_audit AFTER INSERT OR UPDATE OR DELETE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount_ugx integer NOT NULL CHECK (amount_ugx > 0),
  due_on date,
  paid_on date,
  transaction_id uuid REFERENCES public.transactions(id),
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loan_repayments TO authenticated;
GRANT ALL ON public.loan_repayments TO service_role;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See repayments on loans you can see" ON public.loan_repayments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id
    AND (l.counterparty_user_id = auth.uid() OR public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))));
CREATE POLICY "Finance and leadership manage repayments" ON public.loan_repayments
  FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE INDEX loan_repayments_loan_idx ON public.loan_repayments (loan_id);
CREATE TRIGGER loan_repayments_updated_at BEFORE UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_repayments_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_write();

-- actions --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_cash_request(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  st text;
BEGIN
  SELECT status INTO st FROM public.cash_requests WHERE id = _id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'That request no longer exists.' USING ERRCODE = '22004'; END IF;

  IF st = 'submitted' THEN
    IF NOT public.has_any_role(uid, ARRAY['admin','managing_director']::app_role[])
       AND NOT public.is_founder(uid) THEN
      RAISE EXCEPTION 'Only the Managing Director can give the first approval.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.cash_requests
       SET status = 'md_approved', md_approved_by = uid, md_approved_at = now()
     WHERE id = _id;
    RETURN 'md_approved';
  ELSIF st = 'md_approved' THEN
    IF NOT public.is_founder(uid) THEN
      RAISE EXCEPTION 'Only a founder can give the final approval.' USING ERRCODE = '42501';
    END IF;
    IF (SELECT md_approved_by FROM public.cash_requests WHERE id = _id) = uid
       AND NOT public.has_role(uid, 'admin') THEN
      RAISE EXCEPTION 'The same person cannot give both approvals.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.cash_requests
       SET status = 'approved', founder_approved_by = uid, founder_approved_at = now()
     WHERE id = _id;
    RETURN 'approved';
  END IF;
  RAISE EXCEPTION 'This request is not waiting for approval.' USING ERRCODE = '22004';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_cash_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_cash_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_cash_request(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT public.is_md(uid) THEN
    RAISE EXCEPTION 'Only the Managing Director or a founder can decline a request.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Give a reason so the person knows what to fix.' USING ERRCODE = '22004';
  END IF;
  UPDATE public.cash_requests
     SET status = 'declined', declined_by = uid, decline_reason = _reason
   WHERE id = _id AND status IN ('submitted','md_approved');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.decline_cash_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_cash_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.build_payment_run(_month date DEFAULT date_trunc('month', now())::date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m date := date_trunc('month', _month)::date;
  run uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO run FROM public.payment_runs WHERE month = m;
  IF run IS NULL THEN
    INSERT INTO public.payment_runs (month) VALUES (m) RETURNING id INTO run;
  END IF;

  INSERT INTO public.payment_run_lines (run_id, recurring_id, payee_name, payee_kind, payee_user_id, amount_ugx, category)
  SELECT run, r.id, r.payee_name, r.payee_kind, r.payee_user_id, r.amount_ugx, r.category
  FROM public.recurring_payments r
  WHERE r.active
    AND NOT EXISTS (
      SELECT 1 FROM public.payment_run_lines l WHERE l.run_id = run AND l.recurring_id = r.id
    );

  RETURN run;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.build_payment_run(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_payment_run(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_payment_run(_run_id uuid, _line_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT public.is_founder(uid) THEN
    RAISE EXCEPTION 'Only a founder can approve the monthly payments.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.payment_run_lines
     SET status = 'approved'
   WHERE run_id = _run_id AND status IN ('pending','held')
     AND (_line_ids IS NULL OR id = ANY(_line_ids));
  UPDATE public.payment_runs
     SET status = 'approved', approved_by = uid, approved_at = now()
   WHERE id = _run_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_payment_run(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_run(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.hold_payment_line(_line_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_founder(auth.uid()) THEN
    RAISE EXCEPTION 'Only a founder can hold a payment.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.payment_run_lines SET status = 'held' WHERE id = _line_id AND status <> 'paid';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.hold_payment_line(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hold_payment_line(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_payment(
  _source_kind text,
  _source_id uuid,
  _method text,
  _method_reference text DEFAULT NULL,
  _invoice_no text DEFAULT NULL,
  _invoice_path text DEFAULT NULL,
  _note text DEFAULT NULL,
  _paid_on date DEFAULT current_date
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  amt integer;
  payee text;
  kind text := 'external';
  puid uuid;
  cat text := 'general';
  ref text;
BEGIN
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance can record a payment.' USING ERRCODE = '42501';
  END IF;

  IF _source_kind = 'cash_request' THEN
    SELECT c.amount_ugx, coalesce(t.display_name, t.email, 'Team member'), 'internal', c.requester, c.category
      INTO amt, payee, kind, puid, cat
    FROM public.cash_requests c
    LEFT JOIN public.team_members t ON t.user_id = c.requester
    WHERE c.id = _source_id AND c.status = 'approved';
    IF amt IS NULL THEN RAISE EXCEPTION 'That request is not approved for payment yet.' USING ERRCODE = '22004'; END IF;
    UPDATE public.cash_requests SET status = 'paid' WHERE id = _source_id;

  ELSIF _source_kind = 'run_line' THEN
    SELECT l.amount_ugx, l.payee_name, l.payee_kind, l.payee_user_id, l.category
      INTO amt, payee, kind, puid, cat
    FROM public.payment_run_lines l
    WHERE l.id = _source_id AND l.status = 'approved';
    IF amt IS NULL THEN RAISE EXCEPTION 'That line is not approved for payment yet.' USING ERRCODE = '22004'; END IF;
    UPDATE public.payment_run_lines SET status = 'paid' WHERE id = _source_id;

  ELSIF _source_kind = 'loan_disbursement' THEN
    SELECT l.principal_ugx, l.counterparty_name, l.counterparty_kind, l.counterparty_user_id, 'loan'
      INTO amt, payee, kind, puid, cat
    FROM public.loans l WHERE l.id = _source_id AND l.status IN ('pending_approval','active');
    IF amt IS NULL THEN RAISE EXCEPTION 'That loan cannot be paid out.' USING ERRCODE = '22004'; END IF;
    IF (SELECT founder_approved_at FROM public.loans WHERE id = _source_id) IS NULL THEN
      RAISE EXCEPTION 'A founder has to approve this loan first.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.loans SET status = 'active' WHERE id = _source_id;
    kind := CASE WHEN kind = 'staff' THEN 'internal' ELSE 'external' END;
  ELSE
    RAISE EXCEPTION 'Unknown payment source.' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.transactions
    (amount_ugx, direction, source_kind, source_id, payee_name, payee_kind, payee_user_id,
     category, method, method_reference, invoice_no, invoice_path, note, paid_by, paid_at)
  VALUES
    (amt, 'out', _source_kind, _source_id, payee, kind, puid,
     cat, _method, _method_reference, _invoice_no, _invoice_path, _note, uid,
     (_paid_on::timestamptz + (now() - date_trunc('day', now()))))
  RETURNING txn_ref INTO ref;

  RETURN ref;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_payment(text, uuid, text, text, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(text, uuid, text, text, text, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_loan_repayment(
  _loan_id uuid, _amount integer, _paid_on date DEFAULT current_date,
  _method text DEFAULT NULL, _method_reference text DEFAULT NULL, _note text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l public.loans%ROWTYPE;
  txn uuid;
  ref text;
  paid integer;
BEGIN
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance can record a repayment.' USING ERRCODE = '42501';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount above zero.' USING ERRCODE = '22004';
  END IF;
  SELECT * INTO l FROM public.loans WHERE id = _loan_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'That loan no longer exists.' USING ERRCODE = '22004'; END IF;

  INSERT INTO public.transactions
    (amount_ugx, direction, source_kind, source_id, payee_name, payee_kind, payee_user_id,
     category, method, method_reference, note, paid_by, paid_at)
  VALUES
    (_amount, CASE WHEN l.direction = 'lent' THEN 'in' ELSE 'out' END, 'loan_repayment', l.id,
     l.counterparty_name, CASE WHEN l.counterparty_kind = 'staff' THEN 'internal' ELSE 'external' END,
     l.counterparty_user_id, 'loan', _method, _method_reference, _note, uid,
     (_paid_on::timestamptz + (now() - date_trunc('day', now()))))
  RETURNING id, txn_ref INTO txn, ref;

  INSERT INTO public.loan_repayments (loan_id, amount_ugx, paid_on, transaction_id, note)
  VALUES (l.id, _amount, _paid_on, txn, _note);

  SELECT COALESCE(sum(amount_ugx), 0) INTO paid FROM public.loan_repayments WHERE loan_id = l.id;
  IF paid >= COALESCE(l.agreed_total_ugx, l.principal_ugx) THEN
    UPDATE public.loans SET status = 'settled' WHERE id = l.id;
  END IF;

  RETURN ref;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_loan_repayment(uuid, integer, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment(uuid, integer, date, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_transaction(_txn_id uuid, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.transactions%ROWTYPE; ref text;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Give a reason for the reversal.' USING ERRCODE = '22004';
  END IF;
  SELECT * INTO t FROM public.transactions WHERE id = _txn_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'That transaction does not exist.' USING ERRCODE = '22004'; END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE reverses_txn_id = _txn_id) THEN
    RAISE EXCEPTION 'That transaction has already been reversed.' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.transactions
    (amount_ugx, direction, source_kind, source_id, payee_name, payee_kind, payee_user_id,
     category, method, note, paid_by, reverses_txn_id)
  VALUES
    (t.amount_ugx, CASE WHEN t.direction = 'out' THEN 'in' ELSE 'out' END, 'reversal', t.id,
     t.payee_name, t.payee_kind, t.payee_user_id, t.category, t.method, _reason, auth.uid(), t.id)
  RETURNING txn_ref INTO ref;
  RETURN ref;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reverse_transaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_transaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_lookup(_q text, _limit integer DEFAULT 30)
RETURNS TABLE(
  id uuid, txn_ref text, amount_ugx integer, direction text, source_kind text, source_id uuid,
  payee_name text, payee_kind text, category text, method text, method_reference text,
  invoice_no text, paid_at timestamptz, reverses_txn_id uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.txn_ref, t.amount_ugx, t.direction, t.source_kind, t.source_id,
         t.payee_name, t.payee_kind, t.category, t.method, t.method_reference,
         t.invoice_no, t.paid_at, t.reverses_txn_id
  FROM public.transactions t
  WHERE (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
    AND (
      t.txn_ref ILIKE '%'||_q||'%'
      OR t.payee_name ILIKE '%'||_q||'%'
      OR coalesce(t.invoice_no,'') ILIKE '%'||_q||'%'
      OR coalesce(t.method_reference,'') ILIKE '%'||_q||'%'
      OR (_q ~ '^[0-9]+$' AND t.amount_ugx = _q::bigint)
    )
  ORDER BY t.paid_at DESC
  LIMIT _limit;
$$;
REVOKE EXECUTE ON FUNCTION public.finance_lookup(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_lookup(text, integer) TO authenticated;