-- Helper: does the user hold ANY of the given roles?
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

-- Team directory
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read team members" ON public.team_members
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== EVENTS =====
DROP POLICY IF EXISTS "admins manage events" ON public.events;
CREATE POLICY "staff manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]));

DROP POLICY IF EXISTS "public read published events" ON public.events;
CREATE POLICY "public read published events" ON public.events
  FOR SELECT USING (
    published = true
    OR public.has_any_role(auth.uid(), ARRAY['admin','event_manager','viewer','scanner']::public.app_role[])
  );

-- ===== TICKET TIERS =====
DROP POLICY IF EXISTS "admins manage tiers" ON public.ticket_tiers;
CREATE POLICY "staff manage tiers" ON public.ticket_tiers
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]));

DROP POLICY IF EXISTS "public read tiers of published events" ON public.ticket_tiers;
CREATE POLICY "public read tiers of published events" ON public.ticket_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND (e.published = true
             OR public.has_any_role(auth.uid(), ARRAY['admin','event_manager','viewer','scanner']::public.app_role[]))
    )
  );

-- ===== ORDERS =====
DROP POLICY IF EXISTS "admins read orders" ON public.orders;
DROP POLICY IF EXISTS "admins update orders" ON public.orders;
DROP POLICY IF EXISTS "admins delete orders" ON public.orders;

CREATE POLICY "staff read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager','viewer']::public.app_role[]));

CREATE POLICY "staff update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]));

CREATE POLICY "admins delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===== TICKETS =====
DROP POLICY IF EXISTS "admins read tickets" ON public.tickets;
DROP POLICY IF EXISTS "admins update tickets" ON public.tickets;

CREATE POLICY "staff read tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager','viewer','scanner']::public.app_role[]));

CREATE POLICY "staff update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','event_manager']::public.app_role[]));

-- ===== SITE CONTENT (site_editor) =====
DROP POLICY IF EXISTS "Admins insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins delete projects" ON public.projects;
CREATE POLICY "Editors insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));
CREATE POLICY "Editors update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));
CREATE POLICY "Editors delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins insert residents" ON public.residents;
DROP POLICY IF EXISTS "Admins update residents" ON public.residents;
DROP POLICY IF EXISTS "Admins delete residents" ON public.residents;
DROP POLICY IF EXISTS "Admins view all residents" ON public.residents;
CREATE POLICY "Editors view all residents" ON public.residents
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));
CREATE POLICY "Editors insert residents" ON public.residents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));
CREATE POLICY "Editors update residents" ON public.residents
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));
CREATE POLICY "Editors delete residents" ON public.residents
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins manage briefs" ON public.briefs;
CREATE POLICY "Editors manage briefs" ON public.briefs
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Editors manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins manage messages" ON public.messages;
CREATE POLICY "Editors manage messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins manage resident_projects" ON public.resident_projects;
CREATE POLICY "Editors manage resident_projects" ON public.resident_projects
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));

DROP POLICY IF EXISTS "Admins view access requests" ON public.access_requests;
CREATE POLICY "Editors view access requests" ON public.access_requests
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::public.app_role[]));