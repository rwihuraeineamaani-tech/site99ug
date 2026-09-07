ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS retainer_ugx integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('contact','handler')),
  share_amount_ugx integer,
  share_percent numeric(5,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resident_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_assignments_one_contact
  ON public.client_assignments (resident_id) WHERE kind = 'contact';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_assignments TO authenticated;
GRANT ALL ON public.client_assignments TO service_role;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership and finance manage assignments"
  ON public.client_assignments FOR ALL TO authenticated
  USING (public.can_see_finance(auth.uid()))
  WITH CHECK (public.can_see_finance(auth.uid()));

CREATE POLICY "Staff read their own assignment"
  ON public.client_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER client_assignments_set_updated_at
  BEFORE UPDATE ON public.client_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- keep the legacy single-column pointers in sync so existing logic keeps working
CREATE OR REPLACE FUNCTION public.sync_resident_assignment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rid uuid := COALESCE(NEW.resident_id, OLD.resident_id);
BEGIN
  UPDATE public.residents r SET
    contact_user_id = (SELECT a.user_id FROM public.client_assignments a WHERE a.resident_id = rid AND a.kind = 'contact' LIMIT 1),
    handler_user_id = (SELECT a.user_id FROM public.client_assignments a WHERE a.resident_id = rid AND a.kind = 'handler' ORDER BY a.created_at LIMIT 1)
  WHERE r.id = rid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER client_assignments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.client_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_resident_assignment_columns();

-- seed assignments from the existing single columns
INSERT INTO public.client_assignments (resident_id, user_id, kind)
SELECT r.id, r.contact_user_id, 'contact' FROM public.residents r WHERE r.contact_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.client_assignments (resident_id, user_id, kind)
SELECT r.id, r.handler_user_id, 'handler' FROM public.residents r
WHERE r.handler_user_id IS NOT NULL AND r.handler_user_id <> COALESCE(r.contact_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_resident_handler(_resident_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.resident_id = _resident_id AND a.user_id = _user_id AND a.kind = 'handler')
    OR EXISTS (SELECT 1 FROM public.residents r WHERE r.id = _resident_id AND r.handler_user_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_resident_contact(_resident_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.resident_id = _resident_id AND a.user_id = _user_id AND a.kind = 'contact')
    OR EXISTS (SELECT 1 FROM public.residents r WHERE r.id = _resident_id AND r.contact_user_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_touch_resident_accounts(_resident_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_leadership(auth.uid())
    OR public.is_resident_contact(_resident_id, auth.uid())
    OR public.is_resident_handler(_resident_id, auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.my_pending_account_weeks()
RETURNS TABLE(account_id uuid, resident_id uuid, resident_name text, platform text, handle text, week_start date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, r.id, r.name, a.platform, a.handle,
         (date_trunc('week', now())::date - 7) AS week_start
  FROM public.client_accounts a
  JOIN public.residents r ON r.id = a.resident_id
  WHERE a.active
    AND (public.is_resident_contact(r.id, auth.uid()) OR public.is_resident_handler(r.id, auth.uid()))
    AND NOT EXISTS (
      SELECT 1 FROM public.account_metrics m
      WHERE m.account_id = a.id AND m.week_start = (date_trunc('week', now())::date - 7)
    )
  ORDER BY r.name, a.sort, a.platform
$$;

CREATE OR REPLACE FUNCTION public.content_stage_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  is_founder boolean;
  is_contact boolean;
  is_handler boolean;
  is_editor boolean;
  ok boolean := false;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  IF uid IS NULL THEN RETURN NEW; END IF;

  is_founder := public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[]);
  is_contact := NEW.resident_id IS NOT NULL AND public.is_resident_contact(NEW.resident_id, uid);
  is_handler := NEW.resident_id IS NOT NULL AND public.is_resident_handler(NEW.resident_id, uid);

  SELECT EXISTS (
    SELECT 1 FROM public.content_crew c
    WHERE c.content_id = NEW.id AND c.user_id = uid AND lower(c.role) LIKE '%edit%'
  ) INTO is_editor;

  IF NEW.stage = 'Rejected' THEN ok := is_founder;
  ELSIF OLD.stage = 'Idea' AND NEW.stage = 'Approved' THEN ok := is_founder;
  ELSIF OLD.stage = 'Approved' AND NEW.stage = 'Crewed' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Crewed' AND NEW.stage = 'Scheduled' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Scheduled' AND NEW.stage = 'Shooting' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Shooting' AND NEW.stage = 'Editing' THEN ok := is_founder OR is_contact;
  ELSIF OLD.stage = 'Editing' AND NEW.stage = 'Review' THEN ok := is_founder OR is_editor;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Handover' THEN ok := is_founder;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Editing' THEN ok := is_founder;
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
$$;

-- full pay picture: leadership and finance only
CREATE OR REPLACE FUNCTION public.client_pay_overview()
RETURNS TABLE(resident_id uuid, resident_name text, retainer_ugx integer, user_id uuid, kind text,
              share_amount_ugx integer, share_percent numeric, computed_ugx integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.retainer_ugx, a.user_id, a.kind, a.share_amount_ugx, a.share_percent,
         COALESCE(a.share_amount_ugx, ROUND(r.retainer_ugx * COALESCE(a.share_percent,0) / 100.0))::int
  FROM public.residents r
  LEFT JOIN public.client_assignments a ON a.resident_id = r.id
  WHERE public.can_see_finance(auth.uid())
  ORDER BY r.name, a.kind DESC
$$;

-- personal line only
CREATE OR REPLACE FUNCTION public.my_retainer_shares()
RETURNS TABLE(resident_id uuid, resident_name text, kind text, computed_ugx integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, a.kind,
         COALESCE(a.share_amount_ugx, ROUND(r.retainer_ugx * COALESCE(a.share_percent,0) / 100.0))::int
  FROM public.client_assignments a
  JOIN public.residents r ON r.id = a.resident_id
  WHERE a.user_id = auth.uid()
  ORDER BY r.name
$$;