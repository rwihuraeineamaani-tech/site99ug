ALTER TABLE public.cashbook_entries
  ADD COLUMN IF NOT EXISTS resident_contract_id uuid REFERENCES public.resident_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cashbook_entries_contract_idx ON public.cashbook_entries(resident_contract_id);
CREATE INDEX IF NOT EXISTS cashbook_entries_invoice_idx ON public.cashbook_entries(invoice_id);

CREATE OR REPLACE FUNCTION public.cashbook_fill_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv record;
BEGIN
  IF NEW.invoice_id IS NULL AND NEW.transaction_id IS NOT NULL THEN
    SELECT invoice_id INTO NEW.invoice_id FROM public.transactions WHERE id = NEW.transaction_id;
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT resident_contract_id, resident_id INTO inv FROM public.invoices WHERE id = NEW.invoice_id;
    IF NEW.resident_contract_id IS NULL THEN NEW.resident_contract_id := inv.resident_contract_id; END IF;
    IF NEW.resident_id IS NULL THEN NEW.resident_id := inv.resident_id; END IF;
  END IF;
  IF NEW.resident_contract_id IS NOT NULL AND NEW.resident_id IS NULL THEN
    SELECT resident_id INTO NEW.resident_id FROM public.resident_contracts WHERE id = NEW.resident_contract_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cashbook_fill_links_trg ON public.cashbook_entries;
CREATE TRIGGER cashbook_fill_links_trg BEFORE INSERT OR UPDATE OF invoice_id, resident_contract_id, transaction_id
  ON public.cashbook_entries FOR EACH ROW EXECUTE FUNCTION public.cashbook_fill_links();

CREATE OR REPLACE FUNCTION public.settle_invoice(_invoice_id uuid, _wallet_id uuid, _amount integer, _reference text, _paid_on date DEFAULT CURRENT_DATE, _note text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); r public.invoices%ROWTYPE; entry uuid; paid integer;
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

  paid := r.amount_paid_ugx + _amount;
  UPDATE public.invoices
    SET amount_paid_ugx = paid,
        status = CASE WHEN paid >= r.total_ugx THEN 'paid' ELSE 'part_paid' END
  WHERE id = _invoice_id;
  RETURN entry;
END $function$;

CREATE OR REPLACE FUNCTION public.link_cashbook_entry(_entry_id uuid, _contract_id uuid, _invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()) OR public.has_role(auth.uid(),'managing_director')) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cashbook_entries
     SET invoice_id = _invoice_id,
         resident_contract_id = coalesce(_contract_id, (SELECT resident_contract_id FROM public.invoices WHERE id = _invoice_id))
   WHERE id = _entry_id;
END $$;
GRANT EXECUTE ON FUNCTION public.link_cashbook_entry(uuid, uuid, uuid) TO authenticated;

-- backfill: entries whose note names an invoice number
UPDATE public.cashbook_entries c SET invoice_id = i.id
  FROM public.invoices i
 WHERE c.invoice_id IS NULL AND c.direction = 'in' AND i.number IS NOT NULL
   AND c.note ILIKE '%' || i.number || '%';
UPDATE public.cashbook_entries c SET invoice_id = t.invoice_id
  FROM public.transactions t
 WHERE c.invoice_id IS NULL AND c.transaction_id = t.id AND t.invoice_id IS NOT NULL;