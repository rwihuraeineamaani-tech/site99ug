CREATE TABLE public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('role','user')),
  role public.app_role,
  user_id uuid,
  panels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layouts_target CHECK (
    (scope = 'role' AND role IS NOT NULL AND user_id IS NULL)
    OR (scope = 'user' AND user_id IS NOT NULL AND role IS NULL)
  )
);

CREATE UNIQUE INDEX dashboard_layouts_role_key ON public.dashboard_layouts (role) WHERE scope = 'role';
CREATE UNIQUE INDEX dashboard_layouts_user_key ON public.dashboard_layouts (user_id) WHERE scope = 'user';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read dashboard layouts"
ON public.dashboard_layouts FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "System admin manages dashboard layouts"
ON public.dashboard_layouts FOR ALL TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE TRIGGER dashboard_layouts_updated_at
BEFORE UPDATE ON public.dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();