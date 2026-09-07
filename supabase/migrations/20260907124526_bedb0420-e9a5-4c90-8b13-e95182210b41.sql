CREATE SEQUENCE IF NOT EXISTS public.content_items_ref_seq;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS ref_no bigint,
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS added_on date;

-- backfill existing rows in creation order
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.content_items
  WHERE ref_no IS NULL
)
UPDATE public.content_items c
SET ref_no = o.rn
FROM ordered o
WHERE c.id = o.id;

SELECT setval('public.content_items_ref_seq', GREATEST((SELECT COALESCE(MAX(ref_no), 0) FROM public.content_items), 1), true);

UPDATE public.content_items SET added_by = created_by WHERE added_by IS NULL;
UPDATE public.content_items SET added_on = created_at::date WHERE added_on IS NULL;

ALTER TABLE public.content_items
  ALTER COLUMN ref_no SET DEFAULT nextval('public.content_items_ref_seq'),
  ALTER COLUMN ref_no SET NOT NULL,
  ALTER COLUMN added_by SET DEFAULT auth.uid(),
  ALTER COLUMN added_on SET DEFAULT current_date,
  ALTER COLUMN added_on SET NOT NULL;

ALTER SEQUENCE public.content_items_ref_seq OWNED BY public.content_items.ref_no;

CREATE UNIQUE INDEX IF NOT EXISTS content_items_ref_no_key ON public.content_items(ref_no);

CREATE OR REPLACE FUNCTION public.content_items_lock_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ref_no := OLD.ref_no;
  NEW.added_by := OLD.added_by;
  NEW.added_on := OLD.added_on;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_items_lock_provenance ON public.content_items;
CREATE TRIGGER content_items_lock_provenance
BEFORE UPDATE ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.content_items_lock_provenance();