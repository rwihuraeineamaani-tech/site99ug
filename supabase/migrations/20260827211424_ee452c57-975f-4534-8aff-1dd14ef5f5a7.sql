CREATE TABLE public.ai_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.ai_leads TO anon;
GRANT SELECT, INSERT ON public.ai_leads TO authenticated;
GRANT ALL ON public.ai_leads TO service_role;

ALTER TABLE public.ai_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an AI demo request"
ON public.ai_leads FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Staff can read AI demo requests"
ON public.ai_leads FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','site_editor']::app_role[]));