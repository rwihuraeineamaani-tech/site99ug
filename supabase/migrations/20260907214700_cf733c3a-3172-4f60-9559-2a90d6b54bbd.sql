-- Cash requests: requesters may edit details, never approval state.
CREATE OR REPLACE FUNCTION public.cash_request_approval_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_md(auth.uid()) OR public.is_founder(auth.uid()) OR public.can_see_finance(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.md_approved_by IS DISTINCT FROM OLD.md_approved_by
     OR NEW.md_approved_at IS DISTINCT FROM OLD.md_approved_at
     OR NEW.founder_approved_by IS DISTINCT FROM OLD.founder_approved_by
     OR NEW.founder_approved_at IS DISTINCT FROM OLD.founder_approved_at
     OR NEW.declined_by IS DISTINCT FROM OLD.declined_by
     OR NEW.decline_reason IS DISTINCT FROM OLD.decline_reason
  THEN
    RAISE EXCEPTION 'Only an approver can change the status of a cash request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_request_approval_guard ON public.cash_requests;
CREATE TRIGGER cash_request_approval_guard
BEFORE UPDATE ON public.cash_requests
FOR EACH ROW EXECUTE FUNCTION public.cash_request_approval_guard();

-- Content: crew may move their work along, never forge sign-off or posting.
CREATE OR REPLACE FUNCTION public.content_approval_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.can_edit_content(auth.uid()) THEN
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
$$;

DROP TRIGGER IF EXISTS content_approval_guard ON public.content_items;
CREATE TRIGGER content_approval_guard
BEFORE UPDATE ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.content_approval_guard();

REVOKE EXECUTE ON FUNCTION public.cash_request_approval_guard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.content_approval_guard() FROM PUBLIC, anon;