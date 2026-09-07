-- residents: who owns the relationship
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS contact_user_id uuid,
  ADD COLUMN IF NOT EXISTS handler_user_id uuid;

-- content_items: production flow fields
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS crew_notes text,
  ADD COLUMN IF NOT EXISTS shoot_at date,
  ADD COLUMN IF NOT EXISTS edit_file_url text,
  ADD COLUMN IF NOT EXISTS sent_direct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editor_done_at timestamptz,
  ADD COLUMN IF NOT EXISTS founder_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caption_suggestions text,
  ADD COLUMN IF NOT EXISTS posted_links text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS posted_from timestamptz,
  ADD COLUMN IF NOT EXISTS posted_to timestamptz,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metrics_due_at date,
  ADD COLUMN IF NOT EXISTS metrics_filled_at timestamptz;

-- crew slots
CREATE TABLE IF NOT EXISTS public.content_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  role text NOT NULL,
  user_id uuid,
  note text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_crew TO authenticated;
GRANT ALL ON public.content_crew TO service_role;

ALTER TABLE public.content_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Content team can view crew"
  ON public.content_crew FOR SELECT TO authenticated
  USING (public.can_view_content(auth.uid()));

CREATE POLICY "Content team can add crew"
  ON public.content_crew FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_content(auth.uid()));

CREATE POLICY "Content team can edit crew"
  ON public.content_crew FOR UPDATE TO authenticated
  USING (public.can_edit_content(auth.uid()))
  WITH CHECK (public.can_edit_content(auth.uid()));

CREATE POLICY "Content team can remove crew"
  ON public.content_crew FOR DELETE TO authenticated
  USING (public.can_edit_content(auth.uid()));

DROP TRIGGER IF EXISTS content_crew_set_updated_at ON public.content_crew;
CREATE TRIGGER content_crew_set_updated_at
  BEFORE UPDATE ON public.content_crew
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS content_crew_content_idx ON public.content_crew(content_id);
CREATE INDEX IF NOT EXISTS content_crew_user_idx ON public.content_crew(user_id);
CREATE INDEX IF NOT EXISTS content_items_stage_idx2 ON public.content_items(stage);

-- who may move an item from one stage to the next
CREATE OR REPLACE FUNCTION public.content_stage_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_founder boolean;
  contact uuid;
  handler uuid;
  is_editor boolean;
  ok boolean := false;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  -- server-side / unauthenticated contexts are trusted
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  is_founder := public.has_any_role(uid, ARRAY['admin','founder','managing_director','creative_director']::app_role[]);

  SELECT r.contact_user_id, r.handler_user_id INTO contact, handler
  FROM public.residents r WHERE r.id = NEW.resident_id;

  SELECT EXISTS (
    SELECT 1 FROM public.content_crew c
    WHERE c.content_id = NEW.id AND c.user_id = uid AND lower(c.role) LIKE '%edit%'
  ) INTO is_editor;

  IF NEW.stage = 'Rejected' THEN
    ok := is_founder;
  ELSIF OLD.stage = 'Idea' AND NEW.stage = 'Approved' THEN
    ok := is_founder;
  ELSIF OLD.stage = 'Approved' AND NEW.stage = 'Crewed' THEN
    ok := is_founder OR uid = contact;
  ELSIF OLD.stage = 'Crewed' AND NEW.stage = 'Scheduled' THEN
    ok := is_founder OR uid = contact;
  ELSIF OLD.stage = 'Scheduled' AND NEW.stage = 'Shooting' THEN
    ok := is_founder OR uid = contact;
  ELSIF OLD.stage = 'Shooting' AND NEW.stage = 'Editing' THEN
    ok := is_founder OR uid = contact;
  ELSIF OLD.stage = 'Editing' AND NEW.stage = 'Review' THEN
    ok := is_founder OR is_editor;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Handover' THEN
    ok := is_founder;
  ELSIF OLD.stage = 'Review' AND NEW.stage = 'Editing' THEN
    ok := is_founder;
  ELSIF OLD.stage = 'Handover' AND NEW.stage = 'Posted' THEN
    ok := is_founder OR uid = handler;
  ELSIF OLD.stage = 'Posted' AND NEW.stage = 'Archived' THEN
    ok := is_founder OR uid = handler;
  ELSIF OLD.stage = 'Rejected' AND NEW.stage = 'Idea' THEN
    ok := is_founder;
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'You cannot move this item from % to %.', OLD.stage, NEW.stage
      USING ERRCODE = '42501';
  END IF;

  IF NEW.stage = 'Posted' THEN
    NEW.posted_at := COALESCE(NEW.posted_at, now());
    NEW.metrics_due_at := (COALESCE(NEW.posted_at, now()) + interval '10 days')::date;
  END IF;
  IF NEW.stage = 'Approved' THEN
    NEW.approved_by := COALESCE(NEW.approved_by, uid);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  IF NEW.stage = 'Review' THEN
    NEW.editor_done_at := COALESCE(NEW.editor_done_at, now());
  END IF;
  IF NEW.stage = 'Handover' THEN
    NEW.founder_approved_at := COALESCE(NEW.founder_approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_items_stage_guard ON public.content_items;
CREATE TRIGGER content_items_stage_guard
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.content_stage_guard();