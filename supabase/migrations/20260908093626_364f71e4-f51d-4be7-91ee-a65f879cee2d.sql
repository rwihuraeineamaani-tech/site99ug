-- ============ invoices ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('out','in')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','part_paid','paid','void')),
  number text,
  party_kind text NOT NULL DEFAULT 'other' CHECK (party_kind IN ('client','resident','supplier','team','other')),
  party_name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  period_label text,
  category text NOT NULL DEFAULT 'general',
  subtotal_ugx integer NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_ugx integer NOT NULL DEFAULT 0,
  total_ugx integer NOT NULL DEFAULT 0,
  amount_paid_ugx integer NOT NULL DEFAULT 0,
  note text,
  file_path text,
  recurring boolean NOT NULL DEFAULT false,
  recur_day integer CHECK (recur_day BETWEEN 1 AND 28),
  recur_parent_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  next_run_on date,
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance sees invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance adds invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance edits invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Leadership deletes invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.is_leadership(auth.uid()));
CREATE INDEX invoices_direction_status_idx ON public.invoices (direction, status);
CREATE INDEX invoices_issue_date_idx ON public.invoices (issue_date DESC);
CREATE UNIQUE INDEX invoices_number_uidx ON public.invoices (number) WHERE number IS NOT NULL;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price_ugx integer NOT NULL DEFAULT 0,
  amount_ugx integer NOT NULL DEFAULT 0,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance sees invoice lines" ON public.invoice_lines FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance writes invoice lines" ON public.invoice_lines FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE INDEX invoice_lines_invoice_idx ON public.invoice_lines (invoice_id, sort);
CREATE TRIGGER invoice_lines_updated_at BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- invoice numbering
CREATE TABLE public.invoice_counters (
  period text PRIMARY KEY,
  n integer NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoice_counters TO service_role;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p text := to_char(now(), 'YYYY'); v integer;
BEGIN
  INSERT INTO public.invoice_counters (period, n) VALUES (p, 1)
  ON CONFLICT (period) DO UPDATE SET n = public.invoice_counters.n + 1
  RETURNING n INTO v;
  RETURN 'S99-' || p || '-' || lpad(v::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

-- ============ payment pins ============
CREATE TABLE public.payment_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- the hash column is deliberately not readable through the API
GRANT SELECT (user_id, failed_count, locked_until, created_at, updated_at) ON public.payment_pins TO authenticated;
GRANT ALL ON public.payment_pins TO service_role;
ALTER TABLE public.payment_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See my own pin state" ON public.payment_pins FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER payment_pins_updated_at BEFORE UPDATE ON public.payment_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_payment_pin(_pin text, _current_pin text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501'; END IF;
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance and leadership use a payment PIN.' USING ERRCODE = '42501';
  END IF;
  IF _pin !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'The PIN must be six digits.' USING ERRCODE = '22004'; END IF;
  SELECT pin_hash INTO existing FROM public.payment_pins WHERE user_id = uid;
  IF existing IS NOT NULL THEN
    IF _current_pin IS NULL OR existing <> extensions.crypt(_current_pin, existing) THEN
      RAISE EXCEPTION 'Your current PIN is wrong.' USING ERRCODE = '42501';
    END IF;
  END IF;
  INSERT INTO public.payment_pins (user_id, pin_hash, failed_count, locked_until)
  VALUES (uid, extensions.crypt(_pin, extensions.gen_salt('bf')), 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, failed_count = 0, locked_until = NULL, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.set_payment_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_pin(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_payment_pin(_user_id uuid, _pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.payment_pins%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.payment_pins WHERE user_id = _user_id;
  IF r.user_id IS NULL THEN
    RAISE EXCEPTION 'No payment PIN set yet — set one under Settings, Security.' USING ERRCODE = '42501';
  END IF;
  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RAISE EXCEPTION 'Too many wrong tries. Payment release is locked for a few minutes.' USING ERRCODE = '42501';
  END IF;
  IF _pin IS NULL OR r.pin_hash <> extensions.crypt(_pin, r.pin_hash) THEN
    UPDATE public.payment_pins
      SET failed_count = failed_count + 1,
          locked_until = CASE WHEN failed_count + 1 >= 3 THEN now() + interval '15 minutes' ELSE NULL END
    WHERE user_id = _user_id;
    RAISE EXCEPTION 'That PIN is wrong.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.payment_pins SET failed_count = 0, locked_until = NULL WHERE user_id = _user_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.check_payment_pin(uuid, text) FROM PUBLIC, anon, authenticated;

-- ============ finance settings ============
CREATE TABLE public.finance_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dual_pin_threshold_ugx integer NOT NULL DEFAULT 1000000,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read finance settings" ON public.finance_settings FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Founders change finance settings" ON public.finance_settings FOR UPDATE TO authenticated
  USING (public.is_founder(auth.uid())) WITH CHECK (public.is_founder(auth.uid()));
INSERT INTO public.finance_settings (id) VALUES (1);

-- ============ payments: wallet + PIN release ============
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS released_by_2 uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.transactions_to_cashbook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _wallet uuid;
BEGIN
  _wallet := NEW.wallet_id;
  IF _wallet IS NULL THEN
    SELECT id INTO _wallet FROM public.wallets
    WHERE lower(name) = lower(COALESCE(NEW.method, ''))
       OR (lower(COALESCE(NEW.method,'')) IN ('bank transfer','bank','card') AND lower(name) = 'bank')
    ORDER BY sort LIMIT 1;
  END IF;
  IF _wallet IS NULL THEN
    SELECT id INTO _wallet FROM public.wallets WHERE lower(name) = 'cash' LIMIT 1;
  END IF;
  IF _wallet IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, note, reference, transaction_id, created_by)
  VALUES (_wallet, NEW.direction, NEW.amount_ugx, (NEW.paid_at AT TIME ZONE 'utc')::date,
    NEW.category, NEW.payee_name, NEW.payee_kind, NEW.note, COALESCE(NEW.method_reference, NEW.txn_ref),
    NEW.id, NEW.paid_by);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.record_payment(
  _source_kind text,
  _source_id uuid,
  _method text,
  _method_reference text DEFAULT NULL,
  _invoice_no text DEFAULT NULL,
  _invoice_path text DEFAULT NULL,
  _note text DEFAULT NULL,
  _paid_on date DEFAULT CURRENT_DATE,
  _wallet_id uuid DEFAULT NULL,
  _pin text DEFAULT NULL,
  _second_user uuid DEFAULT NULL,
  _second_pin text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  amt integer;
  payee text;
  kind text := 'external';
  puid uuid;
  cat text := 'general';
  ref text;
  inv uuid;
  threshold integer;
BEGIN
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance can record a payment.' USING ERRCODE = '42501';
  END IF;
  IF _wallet_id IS NULL THEN
    RAISE EXCEPTION 'Say which account the money left.' USING ERRCODE = '22004';
  END IF;
  IF coalesce(btrim(_method_reference), '') = '' THEN
    RAISE EXCEPTION 'A transaction ID is required as evidence.' USING ERRCODE = '22004';
  END IF;
  PERFORM public.check_payment_pin(uid, _pin);

  IF _source_kind = 'cash_request' THEN
    SELECT c.amount_ugx, coalesce(t.display_name, t.email, 'Team member'), 'internal', c.requester, c.category
      INTO amt, payee, kind, puid, cat
    FROM public.cash_requests c
    LEFT JOIN public.team_members t ON t.user_id = c.requester
    WHERE c.id = _source_id AND c.status = 'approved';
    IF amt IS NULL THEN RAISE EXCEPTION 'That request is not approved for payment yet.' USING ERRCODE = '22004'; END IF;

  ELSIF _source_kind = 'run_line' THEN
    SELECT l.amount_ugx, l.payee_name, l.payee_kind, l.payee_user_id, l.category
      INTO amt, payee, kind, puid, cat
    FROM public.payment_run_lines l
    WHERE l.id = _source_id AND l.status = 'approved';
    IF amt IS NULL THEN RAISE EXCEPTION 'That line is not approved for payment yet.' USING ERRCODE = '22004'; END IF;

  ELSIF _source_kind = 'loan_disbursement' THEN
    SELECT l.principal_ugx, l.counterparty_name, l.counterparty_kind, l.counterparty_user_id, 'loan'
      INTO amt, payee, kind, puid, cat
    FROM public.loans l WHERE l.id = _source_id AND l.status IN ('pending_approval','active');
    IF amt IS NULL THEN RAISE EXCEPTION 'That loan cannot be paid out.' USING ERRCODE = '22004'; END IF;
    IF (SELECT founder_approved_at FROM public.loans WHERE id = _source_id) IS NULL THEN
      RAISE EXCEPTION 'A founder has to approve this loan first.' USING ERRCODE = '42501';
    END IF;
    kind := CASE WHEN kind = 'staff' THEN 'internal' ELSE 'external' END;

  ELSIF _source_kind = 'invoice' THEN
    SELECT i.total_ugx - i.amount_paid_ugx, i.party_name, 'external', NULL::uuid, i.category
      INTO amt, payee, kind, puid, cat
    FROM public.invoices i
    WHERE i.id = _source_id AND i.direction = 'in' AND i.status IN ('approved','part_paid');
    IF amt IS NULL OR amt <= 0 THEN RAISE EXCEPTION 'That bill is not approved for payment.' USING ERRCODE = '22004'; END IF;
    inv := _source_id;
  ELSE
    RAISE EXCEPTION 'Unknown payment source.' USING ERRCODE = '22004';
  END IF;

  SELECT dual_pin_threshold_ugx INTO threshold FROM public.finance_settings WHERE id = 1;
  IF amt >= coalesce(threshold, 1000000) THEN
    IF _second_user IS NULL OR _second_user = uid THEN
      RAISE EXCEPTION 'A second Founder or MD has to release a payment this size.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_md(_second_user) THEN
      RAISE EXCEPTION 'The second release has to come from a Founder or the MD.' USING ERRCODE = '42501';
    END IF;
    PERFORM public.check_payment_pin(_second_user, _second_pin);
  END IF;

  IF _source_kind = 'cash_request' THEN
    UPDATE public.cash_requests SET status = 'paid' WHERE id = _source_id;
  ELSIF _source_kind = 'run_line' THEN
    UPDATE public.payment_run_lines SET status = 'paid' WHERE id = _source_id;
  ELSIF _source_kind = 'loan_disbursement' THEN
    UPDATE public.loans SET status = 'active' WHERE id = _source_id;
  ELSIF _source_kind = 'invoice' THEN
    UPDATE public.invoices
      SET amount_paid_ugx = total_ugx, status = 'paid'
    WHERE id = _source_id;
  END IF;

  INSERT INTO public.transactions
    (amount_ugx, direction, source_kind, source_id, payee_name, payee_kind, payee_user_id,
     category, method, method_reference, invoice_no, invoice_path, note, paid_by, paid_at,
     wallet_id, released_by_2, invoice_id)
  VALUES
    (amt, 'out', _source_kind, _source_id, payee, kind, puid,
     cat, _method, _method_reference, _invoice_no, _invoice_path, _note, uid,
     (_paid_on::timestamptz + (now() - date_trunc('day', now()))),
     _wallet_id, CASE WHEN amt >= coalesce(threshold, 1000000) THEN _second_user END, inv)
  RETURNING txn_ref INTO ref;

  RETURN ref;
END $$;
REVOKE ALL ON FUNCTION public.record_payment(text, uuid, text, text, text, text, text, date, uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(text, uuid, text, text, text, text, text, date, uuid, text, uuid, text) TO authenticated;

-- money coming in against an invoice we issued
CREATE OR REPLACE FUNCTION public.settle_invoice(
  _invoice_id uuid,
  _wallet_id uuid,
  _amount integer,
  _reference text,
  _paid_on date DEFAULT CURRENT_DATE,
  _note text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); r public.invoices%ROWTYPE; entry uuid; paid integer;
BEGIN
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance can record money in.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.invoices WHERE id = _invoice_id AND direction = 'out';
  IF r.id IS NULL THEN RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = '22004'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter the amount received.' USING ERRCODE = '22004'; END IF;
  IF coalesce(btrim(_reference), '') = '' THEN RAISE EXCEPTION 'A transaction ID is required.' USING ERRCODE = '22004'; END IF;

  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, resident_id, note, reference, created_by)
  VALUES (_wallet_id, 'in', _amount, coalesce(_paid_on, CURRENT_DATE),
    CASE WHEN r.category IN ('client_fee','retainer','project_fee','tickets','other_income') THEN r.category ELSE 'client_fee' END,
    r.party_name, r.party_kind, r.resident_id,
    coalesce(_note, 'Invoice ' || coalesce(r.number, '')), _reference, uid)
  RETURNING id INTO entry;

  paid := r.amount_paid_ugx + _amount;
  UPDATE public.invoices
    SET amount_paid_ugx = paid,
        status = CASE WHEN paid >= r.total_ugx THEN 'paid' ELSE 'part_paid' END
  WHERE id = _invoice_id;
  RETURN entry;
END $$;
REVOKE ALL ON FUNCTION public.settle_invoice(uuid, uuid, integer, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_invoice(uuid, uuid, integer, text, date, text) TO authenticated;

-- raise the month's recurring bills, safe to call any time
CREATE OR REPLACE FUNCTION public.raise_recurring_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.invoices%ROWTYPE; made integer := 0; d date; child uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())) THEN
    RETURN 0;
  END IF;
  FOR r IN SELECT * FROM public.invoices WHERE recurring AND status <> 'void' AND recur_parent_id IS NULL LOOP
    d := make_date(extract(year from CURRENT_DATE)::int, extract(month from CURRENT_DATE)::int, coalesce(r.recur_day, 1));
    CONTINUE WHEN d > CURRENT_DATE;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.invoices c WHERE c.recur_parent_id = r.id AND c.issue_date = d
    );
    INSERT INTO public.invoices (direction, status, number, party_kind, party_name, client_id, resident_id,
      contract_id, issue_date, due_date, period_label, category, subtotal_ugx, vat_rate, vat_ugx, total_ugx,
      note, recurring, recur_parent_id, created_by)
    VALUES (r.direction, 'draft',
      CASE WHEN r.direction = 'out' THEN public.next_invoice_number() ELSE NULL END,
      r.party_kind, r.party_name, r.client_id, r.resident_id, r.contract_id, d, d + 14,
      to_char(d, 'Mon YYYY'), r.category, r.subtotal_ugx, r.vat_rate, r.vat_ugx, r.total_ugx,
      r.note, false, r.id, r.created_by)
    RETURNING id INTO child;
    INSERT INTO public.invoice_lines (invoice_id, description, qty, unit_price_ugx, amount_ugx, sort)
    SELECT child, description, qty, unit_price_ugx, amount_ugx, sort
    FROM public.invoice_lines WHERE invoice_id = r.id;
    made := made + 1;
  END LOOP;
  RETURN made;
END $$;
REVOKE ALL ON FUNCTION public.raise_recurring_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_recurring_invoices() TO authenticated;