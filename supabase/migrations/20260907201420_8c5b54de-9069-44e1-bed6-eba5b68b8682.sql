-- WALLETS
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'mobile_money',
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read wallets" ON public.wallets FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance manages wallets" ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE POLICY "Finance updates wallets" ON public.wallets FOR UPDATE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.wallets (name, kind, sort) VALUES
  ('MTN MoMo', 'mobile_money', 1),
  ('Airtel Money', 'mobile_money', 2),
  ('Bank', 'bank', 3),
  ('Cash', 'cash', 4);

-- CASHBOOK
CREATE TABLE public.cashbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount_ugx integer NOT NULL CHECK (amount_ugx > 0),
  entry_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  category text NOT NULL DEFAULT 'general',
  counterparty_name text NOT NULL DEFAULT '',
  counterparty_kind text NOT NULL DEFAULT 'other',
  resident_id uuid REFERENCES public.residents(id),
  project_id uuid REFERENCES public.projects(id),
  event_id uuid REFERENCES public.events(id),
  note text,
  reference text,
  attachment_path text,
  transaction_id uuid REFERENCES public.transactions(id),
  transfer_group_id uuid,
  reverses_id uuid REFERENCES public.cashbook_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cashbook_entries TO authenticated;
GRANT ALL ON public.cashbook_entries TO service_role;
ALTER TABLE public.cashbook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read cashbook" ON public.cashbook_entries FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance writes cashbook" ON public.cashbook_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE POLICY "Finance edits cashbook notes" ON public.cashbook_entries FOR UPDATE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE INDEX cashbook_entries_date_idx ON public.cashbook_entries (entry_date DESC);
CREATE INDEX cashbook_entries_wallet_idx ON public.cashbook_entries (wallet_id);
CREATE INDEX cashbook_entries_resident_idx ON public.cashbook_entries (resident_id);
CREATE TRIGGER cashbook_entries_updated_at BEFORE UPDATE ON public.cashbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BUDGETS
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  category text NOT NULL,
  cap_ugx integer NOT NULL CHECK (cap_ugx >= 0),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read budgets" ON public.budgets FOR SELECT TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()));
CREATE POLICY "Finance writes budgets" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE POLICY "Finance updates budgets" ON public.budgets FOR UPDATE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE POLICY "Finance deletes budgets" ON public.budgets FOR DELETE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- HELPERS
CREATE OR REPLACE FUNCTION public.log_cashbook_entry(
  _wallet_id uuid,
  _direction text,
  _amount integer,
  _entry_date date,
  _category text,
  _counterparty_name text,
  _counterparty_kind text DEFAULT 'other',
  _resident_id uuid DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _event_id uuid DEFAULT NULL,
  _note text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _attachment_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _direction NOT IN ('in','out') THEN RAISE EXCEPTION 'Bad direction'; END IF;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, resident_id, project_id, event_id, note, reference,
    attachment_path, created_by)
  VALUES (_wallet_id, _direction, _amount, COALESCE(_entry_date, (now() AT TIME ZONE 'utc')::date),
    COALESCE(_category,'general'), COALESCE(_counterparty_name,''), COALESCE(_counterparty_kind,'other'),
    _resident_id, _project_id, _event_id, _note, _reference, _attachment_path, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_cashbook_entry(uuid,text,integer,date,text,text,text,uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_cashbook_entry(uuid,text,integer,date,text,text,text,uuid,uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_between_wallets(
  _from uuid, _to uuid, _amount integer, _entry_date date, _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _grp uuid := gen_random_uuid();
  _from_name text; _to_name text; _d date := COALESCE(_entry_date, (now() AT TIME ZONE 'utc')::date);
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _from = _to THEN RAISE EXCEPTION 'Pick two different wallets'; END IF;
  SELECT name INTO _from_name FROM public.wallets WHERE id = _from;
  SELECT name INTO _to_name FROM public.wallets WHERE id = _to;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, note, transfer_group_id, created_by)
  VALUES (_from, 'out', _amount, _d, 'transfer', _to_name, 'wallet', _note, _grp, auth.uid()),
         (_to, 'in', _amount, _d, 'transfer', _from_name, 'wallet', _note, _grp, auth.uid());
  RETURN _grp;
END $$;
REVOKE EXECUTE ON FUNCTION public.transfer_between_wallets(uuid,uuid,integer,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_between_wallets(uuid,uuid,integer,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_cashbook_entry(_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.cashbook_entries%ROWTYPE; _new uuid;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO r FROM public.cashbook_entries WHERE id = _id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE reverses_id = _id) THEN
    RAISE EXCEPTION 'Already reversed';
  END IF;
  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, resident_id, project_id, event_id, note, reference,
    reverses_id, created_by)
  VALUES (r.wallet_id, CASE WHEN r.direction = 'in' THEN 'out' ELSE 'in' END, r.amount_ugx,
    (now() AT TIME ZONE 'utc')::date, r.category, r.counterparty_name, r.counterparty_kind,
    r.resident_id, r.project_id, r.event_id, COALESCE(_reason,'Reversal'), r.reference, r.id, auth.uid())
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE EXECUTE ON FUNCTION public.reverse_cashbook_entry(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_cashbook_entry(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.wallet_balances()
RETURNS TABLE(wallet_id uuid, wallet_name text, kind text, active boolean, sort integer,
  money_in bigint, money_out bigint, balance bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.name, w.kind, w.active, w.sort,
    COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'in'), 0)::bigint,
    COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'out'), 0)::bigint,
    (COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'in'), 0)
      - COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'out'), 0))::bigint
  FROM public.wallets w
  LEFT JOIN public.cashbook_entries c ON c.wallet_id = w.id
  WHERE public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())
  GROUP BY w.id, w.name, w.kind, w.active, w.sort
  ORDER BY w.sort, w.name
$$;
REVOKE EXECUTE ON FUNCTION public.wallet_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_balances() TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_month_summary(_month date)
RETURNS TABLE(category text, money_in bigint, money_out bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.category,
    COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'in'), 0)::bigint,
    COALESCE(SUM(c.amount_ugx) FILTER (WHERE c.direction = 'out'), 0)::bigint
  FROM public.cashbook_entries c
  WHERE (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()))
    AND c.entry_date >= date_trunc('month', _month)::date
    AND c.entry_date < (date_trunc('month', _month) + interval '1 month')::date
  GROUP BY c.category
  ORDER BY 3 DESC
$$;
REVOKE EXECUTE ON FUNCTION public.finance_month_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_month_summary(date) TO authenticated;

-- Every recorded payment lands in the cashbook automatically
CREATE OR REPLACE FUNCTION public.transactions_to_cashbook()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wallet uuid;
BEGIN
  SELECT id INTO _wallet FROM public.wallets
  WHERE lower(name) = lower(COALESCE(NEW.method, ''))
     OR (lower(COALESCE(NEW.method,'')) IN ('bank transfer','bank','card') AND lower(name) = 'bank')
  ORDER BY sort LIMIT 1;
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
CREATE TRIGGER transactions_to_cashbook AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_to_cashbook();