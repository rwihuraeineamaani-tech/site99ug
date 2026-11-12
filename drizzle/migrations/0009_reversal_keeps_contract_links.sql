CREATE OR REPLACE FUNCTION public.reverse_cashbook_entry(_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    reverses_id, created_by, invoice_id, resident_contract_id)
  VALUES (r.wallet_id, CASE WHEN r.direction = 'in' THEN 'out' ELSE 'in' END, r.amount_ugx,
    (now() AT TIME ZONE 'utc')::date, r.category, r.counterparty_name, r.counterparty_kind,
    r.resident_id, r.project_id, r.event_id, COALESCE(_reason,'Reversal'), r.reference, r.id, auth.uid(),
    r.invoice_id, r.resident_contract_id)
  RETURNING id INTO _new;
  RETURN _new;
END $function$;

-- Backfill: existing reversals inherit the contract/invoice link of the entry they reverse.
UPDATE public.cashbook_entries rev
   SET invoice_id = COALESCE(rev.invoice_id, o.invoice_id),
       resident_contract_id = COALESCE(rev.resident_contract_id, o.resident_contract_id)
  FROM public.cashbook_entries o
 WHERE rev.reverses_id = o.id
   AND (o.invoice_id IS NOT NULL OR o.resident_contract_id IS NOT NULL)
   AND (rev.invoice_id IS NULL OR rev.resident_contract_id IS NULL);

-- Links set on an original later (e.g. via link_cashbook_entry) flow to its reversal too.
CREATE OR REPLACE FUNCTION public.cashbook_sync_reversal_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.cashbook_entries
     SET invoice_id = NEW.invoice_id, resident_contract_id = NEW.resident_contract_id
   WHERE reverses_id = NEW.id
     AND (invoice_id IS DISTINCT FROM NEW.invoice_id OR resident_contract_id IS DISTINCT FROM NEW.resident_contract_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cashbook_sync_reversal_links_trg ON public.cashbook_entries;
CREATE TRIGGER cashbook_sync_reversal_links_trg AFTER UPDATE OF invoice_id, resident_contract_id
  ON public.cashbook_entries FOR EACH ROW
  WHEN (NEW.reverses_id IS NULL)
  EXECUTE FUNCTION public.cashbook_sync_reversal_links();