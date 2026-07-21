
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS organizer_socials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_template_url text,
  ADD COLUMN IF NOT EXISTS ticket_template_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_from_name text NOT NULL DEFAULT 'Site 99 Tickets',
  ADD COLUMN IF NOT EXISTS sender_from_email text NOT NULL DEFAULT 'office@site99ug.com';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tickets_emailed_at timestamptz;
