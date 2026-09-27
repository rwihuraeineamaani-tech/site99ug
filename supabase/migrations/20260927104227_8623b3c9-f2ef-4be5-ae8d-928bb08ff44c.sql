ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS nav_density text DEFAULT 'comfortable';

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_nav_density_check
  CHECK (nav_density IS NULL OR nav_density IN ('comfortable', 'compact'));