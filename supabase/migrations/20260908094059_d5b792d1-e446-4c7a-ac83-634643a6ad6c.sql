CREATE OR REPLACE FUNCTION public.settle_invoice(_invoice_id uuid, _wallet_id uuid, _amount integer, _reference text, _paid_on date DEFAULT CURRENT_DATE, _note text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    counterparty_name, counterparty_kind, resident_id, note, reference, created_by)
  VALUES (_wallet_id, 'in', _amount, coalesce(_paid_on, CURRENT_DATE),
    CASE WHEN r.category IN ('client_payment','retainer','event_sales','project_fee','refund','other')
         THEN r.category ELSE 'client_payment' END,
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