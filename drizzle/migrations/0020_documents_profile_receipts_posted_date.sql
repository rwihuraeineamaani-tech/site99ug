-- Company details printed on invoices and receipts
CREATE TABLE public.document_profile (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name text NOT NULL DEFAULT 'Site 99 UG LTD',
  tin text,
  address text DEFAULT 'Kampala, Uganda',
  phone text,
  email text DEFAULT 'office@site99ug.com',
  website text DEFAULT 'site99ug.com',
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  bank_swift text,
  momo_name text DEFAULT 'KEVIN KYOBE (HEAD FINANCE)',
  momo_code text DEFAULT '71599788',
  momo_network text DEFAULT 'MTN MoMo',
  invoice_terms text DEFAULT 'Payment is due by the date shown. Please quote the invoice number when you pay.',
  receipt_note text DEFAULT 'Thank you for your payment.',
  signatory_name text,
  signatory_title text DEFAULT 'Head of Finance',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_profile TO authenticated;
GRANT UPDATE ON public.document_profile TO authenticated;
GRANT ALL ON public.document_profile TO service_role;
ALTER TABLE public.document_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read document details" ON public.document_profile
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and founders edit document details" ON public.document_profile
  FOR UPDATE TO authenticated
  USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));
INSERT INTO public.document_profile (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Email trail on invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_emailed_to text;

-- Every payment linked to an invoice is a receipt
CREATE OR REPLACE FUNCTION public.invoice_receipts(_invoice uuid)
RETURNS TABLE (entry_id uuid, doc_number text, entry_date date, amount_ugx integer, tid text, reference text, account_name text, account_kind text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())
          OR (inv.resident_id IS NOT NULL AND inv.resident_id = public.my_resident_id(auth.uid()) AND inv.direction = 'out')) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.doc_number, c.entry_date, c.amount_ugx, c.tid, c.reference, w.name, w.kind
    FROM public.cashbook_entries c
    LEFT JOIN public.wallets w ON w.id = c.wallet_id
    WHERE c.invoice_id = _invoice AND c.direction = 'in' AND c.reverses_id IS NULL AND c.charge_for_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.cashbook_entries r WHERE r.reverses_id = c.id)
    ORDER BY c.entry_date, c.created_at;
END $$;
REVOKE ALL ON FUNCTION public.invoice_receipts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_receipts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_invoice_emailed(_invoice uuid, _to text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.invoices SET last_emailed_at = now(), last_emailed_to = _to WHERE id = _invoice;
END $$;
REVOKE ALL ON FUNCTION public.mark_invoice_emailed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_emailed(uuid, text) TO authenticated;

-- Posted date follows the day the handler picked, never the click time
CREATE OR REPLACE FUNCTION public.content_approval_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.can_edit_content(auth.uid()) OR current_setting('app.posted_fix', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.founder_approved_at IS DISTINCT FROM OLD.founder_approved_at
     OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
  THEN
    RAISE EXCEPTION 'Only a content editor can sign off or mark content as posted';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.content_posted_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'Posted' AND OLD.stage IS DISTINCT FROM 'Posted' AND NEW.posted_from IS NOT NULL THEN
    NEW.posted_at := LEAST(NEW.posted_from, now());
    NEW.metrics_due_at := ((NEW.posted_at AT TIME ZONE 'Africa/Kampala')::date + 10);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_zz_posted_day ON public.content_items;
CREATE TRIGGER content_zz_posted_day BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.content_posted_day();

CREATE OR REPLACE FUNCTION public.set_posted_date(_id uuid, _day date)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; uid uuid := auth.uid(); t time; new_at timestamptz; shift interval;
BEGIN
  SELECT * INTO r FROM public.content_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF NOT (public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[])
          OR public.can_edit_content(uid)
          OR (r.resident_id IS NOT NULL AND public.is_resident_handler(r.resident_id, uid))) THEN
    RAISE EXCEPTION 'Only the Handler or leadership can change the posted date' USING ERRCODE = '42501';
  END IF;
  IF r.stage NOT IN ('Posted','Archived') THEN RAISE EXCEPTION 'This item is not posted yet.'; END IF;
  IF _day > (now() AT TIME ZONE 'Africa/Kampala')::date THEN RAISE EXCEPTION 'The posted day cannot be in the future.'; END IF;
  t := COALESCE((r.posted_from AT TIME ZONE 'Africa/Kampala')::time, time '12:00');
  new_at := LEAST((_day + t) AT TIME ZONE 'Africa/Kampala', now());
  shift := CASE WHEN r.posted_from IS NULL THEN interval '0' ELSE ((_day - (r.posted_from AT TIME ZONE 'Africa/Kampala')::date) * interval '1 day') END;
  PERFORM set_config('app.posted_fix', 'on', true);
  UPDATE public.content_items SET
    posted_at = new_at,
    posted_from = CASE WHEN posted_from IS NULL THEN NULL ELSE posted_from + shift END,
    posted_to = CASE WHEN posted_to IS NULL THEN NULL ELSE posted_to + shift END,
    metrics_due_at = CASE WHEN metrics_filled_at IS NULL THEN _day + 10 ELSE metrics_due_at END
  WHERE id = _id;
  PERFORM set_config('app.posted_fix', 'off', true);
  RETURN new_at;
END $$;
REVOKE ALL ON FUNCTION public.set_posted_date(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_posted_date(uuid, date) TO authenticated;