ALTER TABLE public.resident_contracts
  ADD COLUMN IF NOT EXISTS paid_before_system_ugx bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_before_note text,
  ADD COLUMN IF NOT EXISTS paid_before_set_by uuid,
  ADD COLUMN IF NOT EXISTS paid_before_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.contract_money(_contract_id uuid)
 RETURNS TABLE(value_ugx bigint, invoiced_ugx bigint, paid_ugx bigint, outstanding_ugx bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH c AS (SELECT coalesce(value_ugx,0)::bigint v, coalesce(paid_before_system_ugx,0)::bigint prior FROM resident_contracts WHERE id = _contract_id),
  i AS (SELECT coalesce(sum(total_ugx) FILTER (WHERE status NOT IN ('draft','void')),0)::bigint inv,
               coalesce(sum(amount_paid_ugx) FILTER (WHERE status <> 'void'),0)::bigint paid
        FROM invoices WHERE resident_contract_id = _contract_id AND direction = 'out')
  SELECT c.v, i.inv + c.prior, i.paid + c.prior, greatest(greatest(c.v, i.inv + c.prior) - (i.paid + c.prior), 0) FROM c, i
$function$;

CREATE OR REPLACE FUNCTION public.set_contract_prior_payment(_id uuid, _amount bigint, _note text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rid uuid;
BEGIN
  IF NOT (public.is_founder(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['legal','managing_director','finance_ops']::app_role[])) THEN
    RAISE EXCEPTION 'Only Legal, Finance, the MD or a Founder can record earlier payments' USING ERRCODE = '42501';
  END IF;
  IF _amount IS NULL OR _amount < 0 THEN RAISE EXCEPTION 'Enter an amount of zero or more' USING ERRCODE = '22023'; END IF;
  UPDATE public.resident_contracts SET paid_before_system_ugx = _amount, paid_before_note = nullif(trim(coalesce(_note,'')),''),
    paid_before_set_by = auth.uid(), paid_before_set_at = now()
  WHERE id = _id RETURNING resident_id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  PERFORM public.recompute_resident_lifecycle(rid);
END $function$;
REVOKE EXECUTE ON FUNCTION public.set_contract_prior_payment(uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_contract_prior_payment(uuid, bigint, text) TO authenticated;