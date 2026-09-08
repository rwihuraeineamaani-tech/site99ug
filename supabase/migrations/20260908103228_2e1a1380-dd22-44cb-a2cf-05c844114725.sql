ALTER TABLE public.shoot_days
  ADD COLUMN IF NOT EXISTS budget_ugx integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_note text;