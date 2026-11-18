DROP POLICY IF EXISTS "Signed-in users read document details" ON public.document_profile;

CREATE POLICY "Finance and founders read document details"
ON public.document_profile
FOR SELECT
TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));

-- Only the details printed on invoices and receipts, for staff and the client's own portal.
CREATE OR REPLACE FUNCTION public.document_letterhead()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_staff(auth.uid()) OR public.my_resident_id(auth.uid()) IS NOT NULL) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT jsonb_build_object(
    'company_name', company_name, 'tin', tin, 'address', address, 'phone', phone, 'email', email,
    'website', website, 'reg_number', reg_number,
    'bank_name', bank_name, 'bank_account_name', bank_account_name, 'bank_account_number', bank_account_number,
    'bank_branch', bank_branch, 'bank_swift', bank_swift,
    'momo_name', momo_name, 'momo_code', momo_code, 'momo_network', momo_network,
    'invoice_terms', invoice_terms, 'receipt_note', receipt_note,
    'signatory_name', signatory_name, 'signatory_title', signatory_title,
    'vat_registered', vat_registered, 'default_vat_rate', default_vat_rate, 'invoice_due_days', invoice_due_days
  ) INTO out
  FROM public.document_profile WHERE id = 1;
  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.document_letterhead() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_letterhead() TO authenticated;