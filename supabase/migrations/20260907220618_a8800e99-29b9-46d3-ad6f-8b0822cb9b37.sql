CREATE OR REPLACE FUNCTION public.cash_requests_requester_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Approvers go through the approve/decline functions; they may change anything.
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
     OR NEW.requester IS DISTINCT FROM OLD.requester THEN
    RAISE EXCEPTION 'Only a managing director, founder or finance can approve or decline a request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_requests_requester_guard ON public.cash_requests;
CREATE TRIGGER cash_requests_requester_guard
  BEFORE UPDATE ON public.cash_requests
  FOR EACH ROW EXECUTE FUNCTION public.cash_requests_requester_guard();

DROP POLICY IF EXISTS "Requester edits while still submitted" ON public.cash_requests;
CREATE POLICY "Requester edits while still submitted"
  ON public.cash_requests FOR UPDATE TO authenticated
  USING (requester = auth.uid() AND status = 'submitted')
  WITH CHECK (requester = auth.uid() AND status = 'submitted');

REVOKE EXECUTE ON FUNCTION public.cash_requests_requester_guard() FROM anon, public;