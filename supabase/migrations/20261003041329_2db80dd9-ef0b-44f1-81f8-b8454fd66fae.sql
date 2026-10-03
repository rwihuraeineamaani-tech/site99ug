ALTER TABLE public.resident_contracts ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.resident_contract_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); founder boolean := public.is_founder(auth.uid());
BEGIN
  IF NEW.starts_on IS NOT NULL AND NEW.ends_on IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.months IS NOT DISTINCT FROM OLD.months OR NEW.months IS NULL) THEN
    IF TG_OP = 'INSERT' OR NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on OR NEW.months IS NULL THEN
      NEW.months := COALESCE(public.contract_months(NEW.starts_on, NEW.ends_on), NEW.months);
    END IF;
  END IF;
  IF NEW.monthly_retainer_ugx IS NOT NULL THEN
    NEW.value_ugx := NEW.monthly_retainer_ugx * COALESCE(NEW.months, 1);
  END IF;

  IF uid IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_historical THEN
      IF NOT (founder OR public.has_any_role(uid, ARRAY['legal','managing_director']::app_role[])) THEN
        RAISE EXCEPTION 'Only Legal, the MD or a Founder can record previous contracts' USING ERRCODE = '42501';
      END IF;
      IF NEW.ends_on IS NULL OR NEW.ends_on >= (now() AT TIME ZONE 'Africa/Kampala')::date THEN
        RAISE EXCEPTION 'A previous contract must have an end date in the past' USING ERRCODE = '22023';
      END IF;
      NEW.status := 'archived'; NEW.approval_state := 'approved'; NEW.approved_by := uid; NEW.approved_at := now();
      NEW.updated_by := uid;
      RETURN NEW;
    END IF;
    IF NOT founder THEN
      NEW.approval_state := 'draft'; NEW.approved_by := NULL; NEW.approved_at := NULL;
      IF NEW.status NOT IN ('draft','cancelled') THEN NEW.status := 'draft'; END IF;
    END IF;
    NEW.updated_by := uid;
    RETURN NEW;
  END IF;

  IF OLD.is_historical THEN
    NEW.is_historical := true; NEW.status := 'archived'; NEW.approval_state := 'approved';
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
    NEW.updated_by := uid;
    RETURN NEW;
  END IF;

  IF NOT founder AND current_setting('app.contract_rpc', true) IS DISTINCT FROM 'on' THEN
    IF NEW.approval_state IS DISTINCT FROM OLD.approval_state AND NEW.approval_state = 'approved' THEN
      RAISE EXCEPTION 'Only a Founder can approve a contract' USING ERRCODE = '42501';
    END IF;
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
    IF OLD.approval_state = 'approved' AND (
      NEW.title IS DISTINCT FROM OLD.title OR NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
      OR NEW.monthly_retainer_ugx IS DISTINCT FROM OLD.monthly_retainer_ugx OR NEW.months IS DISTINCT FROM OLD.months
      OR NEW.services IS DISTINCT FROM OLD.services OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
      OR NEW.contract_type IS DISTINCT FROM OLD.contract_type OR NEW.notice_days IS DISTINCT FROM OLD.notice_days
      OR NEW.renewal_terms IS DISTINCT FROM OLD.renewal_terms) THEN
      NEW.approval_state := 'submitted'; NEW.submitted_by := uid; NEW.submitted_at := now();
      NEW.approved_by := NULL; NEW.approved_at := NULL;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'signed' AND NEW.approval_state <> 'approved' THEN
      RAISE EXCEPTION 'A contract must be approved by a Founder before it can be signed' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_by := uid;
  RETURN NEW;
END $function$;