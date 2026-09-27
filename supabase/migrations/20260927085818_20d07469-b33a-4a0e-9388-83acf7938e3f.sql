ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cash_request_id uuid UNIQUE REFERENCES public.cash_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_run_line_id uuid UNIQUE REFERENCES public.payment_run_lines(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.raise_bill_for_source(_kind text, _id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv uuid; num text; amt int; payee text; pk text; cat text; what text; rid uuid;
BEGIN
  IF _kind = 'cash_request' THEN
    SELECT id INTO inv FROM public.invoices WHERE cash_request_id = _id;
    IF inv IS NOT NULL THEN RETURN inv; END IF;
    SELECT c.amount_ugx, coalesce(t.display_name, t.email, 'Team member'), 'team', c.category, c.purpose, c.resident_id
      INTO amt, payee, pk, cat, what, rid
    FROM public.cash_requests c LEFT JOIN public.team_members t ON t.user_id = c.requester WHERE c.id = _id;
  ELSE
    SELECT id INTO inv FROM public.invoices WHERE payment_run_line_id = _id;
    IF inv IS NOT NULL THEN RETURN inv; END IF;
    SELECT l.amount_ugx, l.payee_name, CASE WHEN l.payee_kind = 'internal' THEN 'team' ELSE 'supplier' END, l.category, 'Monthly ' || l.category, NULL
      INTO amt, payee, pk, cat, what, rid
    FROM public.payment_run_lines l WHERE l.id = _id;
  END IF;
  IF amt IS NULL THEN RETURN NULL; END IF;
  num := public.next_invoice_number();
  INSERT INTO public.invoices (direction, status, number, party_kind, party_name, resident_id, category,
    subtotal_ugx, total_ugx, note, approved_at, cash_request_id, payment_run_line_id)
  VALUES ('in', 'approved', num, pk, payee, rid, coalesce(cat, 'general'), amt, amt, what, now(),
    CASE WHEN _kind = 'cash_request' THEN _id END, CASE WHEN _kind = 'run_line' THEN _id END)
  RETURNING id INTO inv;
  RETURN inv;
END $$;
REVOKE ALL ON FUNCTION public.raise_bill_for_source(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bill_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.raise_bill_for_source(CASE WHEN TG_TABLE_NAME = 'cash_requests' THEN 'cash_request' ELSE 'run_line' END, NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cash_requests_raise_bill ON public.cash_requests;
CREATE TRIGGER cash_requests_raise_bill AFTER UPDATE OF status ON public.cash_requests FOR EACH ROW EXECUTE FUNCTION public.bill_on_approval();
DROP TRIGGER IF EXISTS run_lines_raise_bill ON public.payment_run_lines;
CREATE TRIGGER run_lines_raise_bill AFTER UPDATE OF status ON public.payment_run_lines FOR EACH ROW EXECUTE FUNCTION public.bill_on_approval();

CREATE OR REPLACE FUNCTION public.bill_paid_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NEW.cash_request_id IS NOT NULL THEN UPDATE public.cash_requests SET status = 'paid' WHERE id = NEW.cash_request_id AND status <> 'paid'; END IF;
    IF NEW.payment_run_line_id IS NOT NULL THEN UPDATE public.payment_run_lines SET status = 'paid' WHERE id = NEW.payment_run_line_id AND status <> 'paid'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoices_paid_sync ON public.invoices;
CREATE TRIGGER invoices_paid_sync AFTER UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.bill_paid_sync();

CREATE OR REPLACE FUNCTION public.transactions_require_bill()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_kind IN ('cash_request', 'run_line') THEN
    RAISE EXCEPTION 'Pay this through its bill on the payment board.' USING ERRCODE = '22004';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transactions_require_bill ON public.transactions;
CREATE TRIGGER transactions_require_bill BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.transactions_require_bill();

CREATE OR REPLACE FUNCTION public.contracts_no_client()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.party_kind IN ('client', 'resident') THEN
    RAISE EXCEPTION 'Client contracts are added under the client (client contracts).' USING ERRCODE = '22004';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contracts_no_client ON public.contracts;
CREATE TRIGGER contracts_no_client BEFORE INSERT ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contracts_no_client();

SELECT public.raise_bill_for_source('cash_request', id) FROM public.cash_requests WHERE status = 'approved';
SELECT public.raise_bill_for_source('run_line', id) FROM public.payment_run_lines WHERE status = 'approved';

UPDATE public.client_assignments SET share_amount_ugx = NULL, share_percent = NULL;

CREATE OR REPLACE FUNCTION public.set_client_handler(_resident_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_kpi_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.client_assignments WHERE resident_id = _resident_id AND (_user_id IS NULL OR user_id <> _user_id);
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.client_assignments (resident_id, user_id, kind, created_by)
    VALUES (_resident_id, _user_id, 'contact', auth.uid())
    ON CONFLICT (resident_id, user_id) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_client_handler(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_client_handler(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.my_retainer_shares() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_client_pay(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_assignments FROM authenticated;