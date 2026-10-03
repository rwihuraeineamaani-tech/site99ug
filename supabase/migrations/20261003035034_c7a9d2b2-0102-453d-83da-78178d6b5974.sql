ALTER TABLE public.resident_contracts
  ALTER COLUMN value_ugx TYPE bigint,
  ADD COLUMN IF NOT EXISTS monthly_retainer_ugx bigint,
  ADD COLUMN IF NOT EXISTS months integer,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS invoice_day integer,
  ADD COLUMN IF NOT EXISTS due_days integer,
  ADD COLUMN IF NOT EXISTS notice_days integer,
  ADD COLUMN IF NOT EXISTS renewal_terms text,
  ADD COLUMN IF NOT EXISTS client_signatory text,
  ADD COLUMN IF NOT EXISTS site99_signatory text,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_note text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Existing contracts were already signed off, keep them approved.
UPDATE public.resident_contracts SET approval_state = 'approved', approved_at = COALESCE(approved_at, created_at);

CREATE OR REPLACE FUNCTION public.contract_months(_s date, _e date)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _s IS NULL OR _e IS NULL OR _e < _s THEN NULL ELSE
    GREATEST(1, (extract(year from age(_e + 1, _s))::int * 12 + extract(month from age(_e + 1, _s))::int
      + CASE WHEN extract(day from age(_e + 1, _s)) >= 15 THEN 1 ELSE 0 END)) END
$$;

CREATE OR REPLACE FUNCTION public.resident_contract_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF NOT founder THEN
      NEW.approval_state := 'draft'; NEW.approved_by := NULL; NEW.approved_at := NULL;
      IF NEW.status NOT IN ('draft','cancelled') THEN NEW.status := 'draft'; END IF;
    END IF;
    NEW.updated_by := uid;
    RETURN NEW;
  END IF;

  -- Approval fields only move through the RPCs (or by a Founder).
  IF NOT founder AND current_setting('app.contract_rpc', true) IS DISTINCT FROM 'on' THEN
    IF NEW.approval_state IS DISTINCT FROM OLD.approval_state AND NEW.approval_state = 'approved' THEN
      RAISE EXCEPTION 'Only a Founder can approve a contract' USING ERRCODE = '42501';
    END IF;
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
    -- Editing the terms of an approved contract reopens approval.
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
END $$;

DROP TRIGGER IF EXISTS resident_contract_guard ON public.resident_contracts;
CREATE TRIGGER resident_contract_guard BEFORE INSERT OR UPDATE ON public.resident_contracts
  FOR EACH ROW EXECUTE FUNCTION public.resident_contract_guard();

CREATE OR REPLACE FUNCTION public.submit_contract_for_approval(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_md(auth.uid()) OR public.has_role(auth.uid(),'legal')) THEN
    RAISE EXCEPTION 'Only Legal can submit contracts' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('app.contract_rpc','on', true);
  UPDATE public.resident_contracts SET approval_state = 'submitted', submitted_by = auth.uid(), submitted_at = now(), return_note = NULL
   WHERE id = _id AND approval_state IN ('draft','returned');
END $$;

CREATE OR REPLACE FUNCTION public.approve_contract(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_founder(auth.uid()) THEN RAISE EXCEPTION 'Only a Founder can approve' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('app.contract_rpc','on', true);
  UPDATE public.resident_contracts SET approval_state = 'approved', approved_by = auth.uid(), approved_at = now(), return_note = NULL,
    status = CASE WHEN status = 'draft' THEN 'signed' ELSE status END
   WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.return_contract(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_founder(auth.uid()) THEN RAISE EXCEPTION 'Only a Founder can send a contract back' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('app.contract_rpc','on', true);
  UPDATE public.resident_contracts SET approval_state = 'returned', return_note = _note WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_contract_for_approval(uuid), public.approve_contract(uuid), public.return_contract(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.contract_finance_summary(uuid);
CREATE FUNCTION public.contract_finance_summary(_resident_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(contract_id uuid, resident_id uuid, title text, status text, starts_on date, ends_on date, renewal_due_on date, monthly_retainer_ugx bigint, months integer, value_ugx bigint, invoiced_ugx bigint, paid_ugx bigint, outstanding_ugx bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.resident_id, c.title, c.status, c.starts_on, c.ends_on, c.renewal_due_on, c.monthly_retainer_ugx, c.months, m.value_ugx, m.invoiced_ugx, m.paid_ugx, m.outstanding_ugx
  FROM resident_contracts c CROSS JOIN LATERAL public.contract_money(c.id) m
  WHERE (_resident_id IS NULL OR c.resident_id = _resident_id)
    AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()) OR public.is_resident_handler(c.resident_id, auth.uid()))
  ORDER BY c.ends_on NULLS LAST
$function$;
GRANT EXECUTE ON FUNCTION public.contract_finance_summary(uuid) TO authenticated;

-- System Admin counts as Founder.
CREATE OR REPLACE FUNCTION public.is_kpi_manager(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.has_any_role(_user_id, ARRAY['admin','founder','managing_director','operations_manager','hr','finance_ops']::public.app_role[]) $$;

-- Content approvals switched off for now (flip to true to restore).
CREATE OR REPLACE FUNCTION public.content_approvals_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION public.content_skip_idea_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.content_approvals_enabled() AND NEW.stage = 'Idea' THEN
    NEW.stage := 'Approved';
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_skip_idea_approval ON public.content_items;
CREATE TRIGGER content_skip_idea_approval BEFORE INSERT ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.content_skip_idea_approval();

CREATE OR REPLACE FUNCTION public.content_stage_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_founder boolean; is_contact boolean; is_handler boolean; is_editor boolean; is_crew boolean;
  open_flow boolean := NOT public.content_approvals_enabled();
  ok boolean := false;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  IF uid IS NULL OR current_setting('app.shoot_sync', true) = 'on' THEN RETURN NEW; END IF;
  is_founder := public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[]);
  is_contact := NEW.resident_id IS NOT NULL AND public.is_resident_contact(NEW.resident_id, uid);
  is_handler := NEW.resident_id IS NOT NULL AND public.is_resident_handler(NEW.resident_id, uid);
  SELECT EXISTS (SELECT 1 FROM public.content_crew c WHERE c.content_id = NEW.id AND c.user_id = uid AND lower(c.role) LIKE '%edit%') INTO is_editor;
  SELECT EXISTS (SELECT 1 FROM public.content_crew c WHERE c.content_id = NEW.id AND c.user_id = uid) INTO is_crew;
  IF NEW.stage = 'Rejected' THEN ok := is_founder;
  ELSIF OLD.stage = 'Idea' AND NEW.stage = 'Approved' THEN ok := is_founder OR (open_flow AND (public.can_edit_content(uid) OR is_contact));
  ELSIF OLD.stage = 'Approved' AND NEW.stage = 'Crewed' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Crewed' AND NEW.stage = 'Scheduled' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Scheduled' AND NEW.stage = 'Shooting' THEN ok := is_founder OR is_contact OR is_crew;
  ELSIF OLD.stage IN ('Scheduled','Shooting') AND NEW.stage = 'Editing' THEN ok := is_founder OR is_contact OR is_crew;
  ELSIF OLD.stage = 'Editing' AND NEW.stage = 'Review' THEN ok := is_founder OR is_editor OR is_crew;
  ELSIF OLD.stage = 'Editing' AND NEW.stage = 'Handover' THEN ok := open_flow AND (is_founder OR is_editor OR is_crew OR is_contact);
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Handover' THEN ok := is_founder OR (open_flow AND (is_editor OR is_crew OR is_contact));
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Editing' THEN ok := is_founder OR (open_flow AND (is_editor OR is_contact));
  ELSIF OLD.stage = 'Handover' AND NEW.stage = 'Posted' THEN ok := is_founder OR is_handler;
  ELSIF OLD.stage = 'Posted' AND NEW.stage = 'Archived' THEN ok := is_founder OR is_handler;
  ELSIF OLD.stage = 'Rejected' AND NEW.stage = 'Idea' THEN ok := is_founder;
  END IF;
  IF NOT ok THEN
    RAISE EXCEPTION 'You cannot move this item from % to %.', OLD.stage, NEW.stage USING ERRCODE = '42501';
  END IF;
  IF NEW.stage = 'Posted' THEN
    NEW.posted_at := COALESCE(NEW.posted_at, now());
    NEW.metrics_due_at := (COALESCE(NEW.posted_at, now()) + interval '10 days')::date;
  END IF;
  IF NEW.stage = 'Approved' THEN
    NEW.approved_by := COALESCE(NEW.approved_by, uid);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  IF NEW.stage = 'Review' THEN NEW.editor_done_at := COALESCE(NEW.editor_done_at, now()); END IF;
  IF NEW.stage = 'Handover' THEN NEW.founder_approved_at := COALESCE(NEW.founder_approved_at, now()); END IF;
  RETURN NEW;
END;
$function$;