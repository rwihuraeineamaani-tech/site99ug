-- A client invoice's paid amount now follows the cashbook money linked to it
-- (money in minus reversals), so linking, unlinking or reversing a payment
-- updates the invoice, contract balance and client portal together.
CREATE OR REPLACE FUNCTION public.recompute_invoice_paid(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.invoices%ROWTYPE; _paid bigint; _status text;
BEGIN
  IF _invoice_id IS NULL THEN RETURN; END IF;
  SELECT * INTO r FROM public.invoices WHERE id = _invoice_id;
  IF r.id IS NULL OR r.direction <> 'out' OR r.status = 'void' THEN RETURN; END IF;
  SELECT greatest(coalesce(sum(CASE WHEN c.direction = 'in' THEN c.amount_ugx ELSE -c.amount_ugx END), 0), 0)
    INTO _paid FROM public.cashbook_entries c WHERE c.invoice_id = _invoice_id;
  _status := r.status;
  IF r.status <> 'draft' THEN
    IF _paid >= r.total_ugx AND r.total_ugx > 0 THEN _status := 'paid';
    ELSIF _paid > 0 THEN _status := 'part_paid';
    ELSIF r.status IN ('paid','part_paid') THEN _status := 'sent';
    END IF;
  END IF;
  IF _paid IS DISTINCT FROM r.amount_paid_ugx::bigint OR _status IS DISTINCT FROM r.status THEN
    UPDATE public.invoices SET amount_paid_ugx = _paid, status = _status WHERE id = _invoice_id;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_paid(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cashbook_invoice_paid_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN PERFORM public.recompute_invoice_paid(OLD.invoice_id); END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND (TG_OP = 'INSERT' OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
       OR NEW.amount_ugx IS DISTINCT FROM OLD.amount_ugx OR NEW.direction IS DISTINCT FROM OLD.direction) THEN
    PERFORM public.recompute_invoice_paid(NEW.invoice_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS cashbook_invoice_paid_sync_trg ON public.cashbook_entries;
CREATE TRIGGER cashbook_invoice_paid_sync_trg
AFTER INSERT OR DELETE OR UPDATE OF invoice_id, amount_ugx, direction ON public.cashbook_entries
FOR EACH ROW EXECUTE FUNCTION public.cashbook_invoice_paid_sync();

-- settle_invoice no longer adds to the invoice itself; the cashbook trigger does,
-- so a settlement is never counted twice.
CREATE OR REPLACE FUNCTION public.settle_invoice(_invoice_id uuid, _wallet_id uuid, _amount integer, _reference text, _paid_on date DEFAULT CURRENT_DATE, _note text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); r public.invoices%ROWTYPE; entry uuid;
BEGIN
  IF NOT (public.can_see_finance(uid) OR public.is_leadership(uid)) THEN
    RAISE EXCEPTION 'Only finance can record money in.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.invoices WHERE id = _invoice_id AND direction = 'out';
  IF r.id IS NULL THEN RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = '22004'; END IF;
  IF _wallet_id IS NULL THEN RAISE EXCEPTION 'Say which account the money landed in.' USING ERRCODE = '22004'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter the amount received.' USING ERRCODE = '22004'; END IF;
  IF coalesce(btrim(_reference), '') = '' THEN RAISE EXCEPTION 'A transaction ID is required.' USING ERRCODE = '22004'; END IF;

  INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category,
    counterparty_name, counterparty_kind, resident_id, note, reference, created_by, invoice_id, resident_contract_id)
  VALUES (_wallet_id, 'in', _amount, coalesce(_paid_on, CURRENT_DATE),
    CASE WHEN r.category IN ('client_payment','retainer','event_sales','project_fee','refund','other')
         THEN r.category ELSE 'client_payment' END,
    r.party_name, r.party_kind, r.resident_id,
    coalesce(_note, 'Invoice ' || coalesce(r.number, '')), _reference, uid, r.id, r.resident_contract_id)
  RETURNING id INTO entry;
  RETURN entry;
END $function$;

-- Backfill every client invoice that already has linked cashbook money.
SELECT public.recompute_invoice_paid(i.id)
  FROM public.invoices i
 WHERE i.direction = 'out' AND EXISTS (SELECT 1 FROM public.cashbook_entries c WHERE c.invoice_id = i.id);