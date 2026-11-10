CREATE OR REPLACE FUNCTION public.contract_cashbook(_contract_id uuid)
RETURNS TABLE(id uuid, entry_date date, amount_ugx integer, direction text, reference text, note text, wallet_name text, invoice_number text, attachment_path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()) OR public.has_role(auth.uid(),'legal')) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.entry_date, c.amount_ugx, c.direction, c.reference, c.note, w.name, i.number, c.attachment_path
    FROM public.cashbook_entries c
    LEFT JOIN public.wallets w ON w.id = c.wallet_id
    LEFT JOIN public.invoices i ON i.id = c.invoice_id
   WHERE c.resident_contract_id = _contract_id
      OR c.invoice_id IN (SELECT x.id FROM public.invoices x WHERE x.resident_contract_id = _contract_id)
   ORDER BY c.entry_date DESC, c.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.contract_cashbook(uuid) TO authenticated;