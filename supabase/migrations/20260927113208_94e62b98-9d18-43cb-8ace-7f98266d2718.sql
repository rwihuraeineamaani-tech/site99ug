-- 1. projects: nothing public reads this table (only Admin and staff app pages),
-- so the internet-wide read rule is replaced with a signed-in-only one.
DROP POLICY "Public can view projects" ON public.projects;
CREATE POLICY "Staff can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

-- 2. access_requests: public submissions stay open (it is the website's access form),
-- but rows must now be real: a name, a plausible email and sane field lengths.
DROP POLICY "Anyone can submit access requests" ON public.access_requests;
CREATE POLICY "Anyone can submit access requests" ON public.access_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 200
    AND length(trim(brand)) BETWEEN 1 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 320
    AND length(territory) <= 200
    AND length(brief) <= 5000
  );

-- 3. ai_leads: same treatment for the public AI lead form.
DROP POLICY "Anyone can submit an AI demo request" ON public.ai_leads;
CREATE POLICY "Anyone can submit an AI demo request" ON public.ai_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 320
    AND (company IS NULL OR length(company) <= 200)
    AND (message IS NULL OR length(message) <= 5000)
  );