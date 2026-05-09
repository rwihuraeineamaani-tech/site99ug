-- Residents table for admin CRUD
CREATE TABLE public.residents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  territory TEXT NOT NULL,
  since TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view residents" ON public.residents FOR SELECT USING (true);
CREATE POLICY "Admins insert residents" ON public.residents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update residents" ON public.residents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete residents" ON public.residents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER residents_updated_at BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed with current hardcoded list
INSERT INTO public.residents (name, territory, since, status, display_order) VALUES
  ('Kweli Creatives', 'Global · Art Gallery', '2022', 'Active', 0),
  ('Rolex Guy Uganda', 'Kampala · Fast Food', '2023', 'Active', 1),
  ('Uganda Youth Forum', 'Kampala · NGO', '2023', 'Active', 2),
  ('The Lawns Restaurant', 'Kololo · Fine Dining', '2023', 'Active', 3),
  ('Montana International School', 'Muyenga · Education', '2024', 'Active', 4),
  ('Nehemiah Consultants', 'Kampala · Advisory', '2024', 'Active', 5);

-- Access requests table to log form submissions
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  email TEXT NOT NULL,
  territory TEXT NOT NULL,
  brief TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public form)
CREATE POLICY "Anyone can submit access requests" ON public.access_requests FOR INSERT WITH CHECK (true);
-- Only admins can view
CREATE POLICY "Admins view access requests" ON public.access_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));