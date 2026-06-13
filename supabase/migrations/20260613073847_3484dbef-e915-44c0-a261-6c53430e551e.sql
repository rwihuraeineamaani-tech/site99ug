
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT NOT NULL DEFAULT '4:5';

-- Tighten residents PII: drop broad SELECT policies; rely on public_residents view for marketing data.
DROP POLICY IF EXISTS "Anon can view visible residents" ON public.residents;
DROP POLICY IF EXISTS "Authenticated can view visible residents" ON public.residents;

REVOKE SELECT ON public.residents FROM anon;
-- Authenticated users keep table privileges so admins/resident-owner policies still work.
