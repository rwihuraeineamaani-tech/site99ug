
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS momo_number TEXT,
  ADD COLUMN IF NOT EXISTS airtel_number TEXT;
