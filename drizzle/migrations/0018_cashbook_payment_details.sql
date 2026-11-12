CREATE OR REPLACE FUNCTION public.set_entry_payment_details(_id uuid, _tid text, _charge integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.cashbook_entries; k text;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO e FROM public.cashbook_entries WHERE id=_id;
  SELECT kind INTO k FROM public.wallets WHERE id=e.wallet_id;
  IF k = 'mobile_money' AND COALESCE(trim(_tid),'') = '' THEN RAISE EXCEPTION 'Mobile money needs a transaction ID (TID)'; END IF;
  UPDATE public.cashbook_entries SET tid = NULLIF(trim(_tid),''), charge_ugx = COALESCE(_charge,0) WHERE id=_id;
  DELETE FROM public.cashbook_entries WHERE charge_for_id = _id;
  IF COALESCE(_charge,0) > 0 THEN
    INSERT INTO public.cashbook_entries (wallet_id, direction, amount_ugx, entry_date, category, counterparty_name, counterparty_kind, note, tid, charge_for_id, created_by)
    VALUES (e.wallet_id, 'out', _charge, e.entry_date, CASE WHEN k='mobile_money' THEN 'mobile_money_charges' ELSE 'bank_charges' END,
      CASE WHEN k='mobile_money' THEN 'Mobile money charges' ELSE 'Bank charges' END, 'other', 'Charge on ' || e.doc_number, NULLIF(trim(_tid),''), _id, auth.uid());
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_entry_payment_details(uuid,text,integer) TO authenticated;