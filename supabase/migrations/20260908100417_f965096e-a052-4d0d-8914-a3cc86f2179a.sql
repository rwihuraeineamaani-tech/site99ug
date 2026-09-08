ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'strategist';

CREATE OR REPLACE FUNCTION public.is_strategy_team(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text IN ('strategist','creative_director','sales_head','founder','managing_director','admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_strategy_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_strategy_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_approve_strategy(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text IN ('founder','managing_director','admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_approve_strategy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_strategy(uuid) TO authenticated;

ALTER TABLE public.client_goals
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.client_targets
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.strategy_maps
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE TABLE public.client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL UNIQUE REFERENCES public.residents(id) ON DELETE CASCADE,
  owner_user_id uuid,
  summary text,
  review_state text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  review_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_plans TO authenticated;
GRANT ALL ON public.client_plans TO service_role;
ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read client plans" ON public.client_plans
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Strategy team writes client plans" ON public.client_plans
FOR ALL TO authenticated
USING (public.is_strategy_team(auth.uid()))
WITH CHECK (public.is_strategy_team(auth.uid()));

CREATE TRIGGER client_plans_updated_at
BEFORE UPDATE ON public.client_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.strategy_map_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  map_id uuid REFERENCES public.strategy_maps(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT 'Strategy map',
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  review_state text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  review_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_map_versions TO authenticated;
GRANT ALL ON public.strategy_map_versions TO service_role;
ALTER TABLE public.strategy_map_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read map versions" ON public.strategy_map_versions
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Strategy team writes map versions" ON public.strategy_map_versions
FOR ALL TO authenticated
USING (public.is_strategy_team(auth.uid()))
WITH CHECK (public.is_strategy_team(auth.uid()));

CREATE TRIGGER strategy_map_versions_updated_at
BEFORE UPDATE ON public.strategy_map_versions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX strategy_map_versions_resident_idx ON public.strategy_map_versions(resident_id, version DESC);

CREATE OR REPLACE FUNCTION public.strategy_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_state NOT IN ('draft','submitted','approved','changes_requested') THEN
    RAISE EXCEPTION 'Unknown review state %', NEW.review_state;
  END IF;

  IF NEW.review_state = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.review_state IS DISTINCT FROM 'approved') THEN
    IF NOT public.can_approve_strategy(auth.uid()) THEN
      RAISE EXCEPTION 'Only a founder, MD or admin can approve strategy';
    END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  IF NEW.review_state = 'changes_requested'
     AND (TG_OP = 'INSERT' OR OLD.review_state IS DISTINCT FROM 'changes_requested') THEN
    IF NOT public.can_approve_strategy(auth.uid()) THEN
      RAISE EXCEPTION 'Only a founder, MD or admin can send strategy back';
    END IF;
  END IF;

  IF NEW.review_state = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.review_state IS DISTINCT FROM 'submitted') THEN
    NEW.submitted_by := auth.uid();
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER client_goals_review_guard BEFORE INSERT OR UPDATE ON public.client_goals
FOR EACH ROW EXECUTE FUNCTION public.strategy_review_guard();
CREATE TRIGGER client_targets_review_guard BEFORE INSERT OR UPDATE ON public.client_targets
FOR EACH ROW EXECUTE FUNCTION public.strategy_review_guard();
CREATE TRIGGER strategy_maps_review_guard BEFORE INSERT OR UPDATE ON public.strategy_maps
FOR EACH ROW EXECUTE FUNCTION public.strategy_review_guard();
CREATE TRIGGER client_plans_review_guard BEFORE INSERT OR UPDATE ON public.client_plans
FOR EACH ROW EXECUTE FUNCTION public.strategy_review_guard();
CREATE TRIGGER strategy_map_versions_review_guard BEFORE INSERT OR UPDATE ON public.strategy_map_versions
FOR EACH ROW EXECUTE FUNCTION public.strategy_review_guard();