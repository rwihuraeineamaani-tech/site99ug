ALTER TABLE public.shoot_days
  ADD COLUMN IF NOT EXISTS brief_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS brief_sent_by uuid;