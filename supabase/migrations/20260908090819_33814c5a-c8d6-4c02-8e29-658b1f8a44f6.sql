CREATE TABLE public.client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  title text NOT NULL,
  metric text NOT NULL DEFAULT 'custom',
  start_value numeric,
  target_value numeric,
  unit text,
  due_on date,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  sort integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_goals TO authenticated;
GRANT ALL ON public.client_goals TO service_role;
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read client goals" ON public.client_goals
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Assigned staff manage client goals" ON public.client_goals
FOR ALL TO authenticated
USING (public.is_leadership(auth.uid()) OR public.can_touch_resident_accounts(resident_id))
WITH CHECK (public.is_leadership(auth.uid()) OR public.can_touch_resident_accounts(resident_id));

CREATE TRIGGER client_goals_updated_at BEFORE UPDATE ON public.client_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.client_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  user_id uuid,
  month date NOT NULL,
  metric text NOT NULL,
  target_value numeric NOT NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_targets_owner_ck CHECK (resident_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX client_targets_resident_uq ON public.client_targets (resident_id, month, metric) WHERE resident_id IS NOT NULL;
CREATE UNIQUE INDEX client_targets_user_uq ON public.client_targets (user_id, month, metric) WHERE user_id IS NOT NULL AND resident_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_targets TO authenticated;
GRANT ALL ON public.client_targets TO service_role;
ALTER TABLE public.client_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read targets" ON public.client_targets
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Leadership manage targets" ON public.client_targets
FOR ALL TO authenticated
USING (public.is_leadership(auth.uid()) OR (resident_id IS NOT NULL AND public.can_touch_resident_accounts(resident_id)))
WITH CHECK (public.is_leadership(auth.uid()) OR (resident_id IS NOT NULL AND public.can_touch_resident_accounts(resident_id)));

CREATE TRIGGER client_targets_updated_at BEFORE UPDATE ON public.client_targets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.strategy_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Strategy map',
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_maps TO authenticated;
GRANT ALL ON public.strategy_maps TO service_role;
ALTER TABLE public.strategy_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read strategy maps" ON public.strategy_maps
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Assigned staff manage strategy maps" ON public.strategy_maps
FOR ALL TO authenticated
USING (public.is_leadership(auth.uid()) OR public.can_touch_resident_accounts(resident_id))
WITH CHECK (public.is_leadership(auth.uid()) OR public.can_touch_resident_accounts(resident_id));

CREATE TRIGGER strategy_maps_updated_at BEFORE UPDATE ON public.strategy_maps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();