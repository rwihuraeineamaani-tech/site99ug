CREATE TABLE public.calendar_reminder_reads (
  calendar_item_id uuid NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  occurrence_date date NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (calendar_item_id, occurrence_date)
);
GRANT SELECT, INSERT, DELETE ON public.calendar_reminder_reads TO authenticated;
GRANT ALL ON public.calendar_reminder_reads TO service_role;
ALTER TABLE public.calendar_reminder_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read reminder dismissals" ON public.calendar_reminder_reads
FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owners dismiss reminders" ON public.calendar_reminder_reads
FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners clear reminder dismissals" ON public.calendar_reminder_reads
FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.calendar_reminder_read_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage reminders'; END IF;
  NEW.owner_user_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.calendar_items i
    WHERE i.id = NEW.calendar_item_id AND i.owner_user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'You can only dismiss your own reminders'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_reminder_read_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_reminder_read_guard() TO authenticated, service_role;
CREATE TRIGGER calendar_reminder_read_guard BEFORE INSERT OR UPDATE ON public.calendar_reminder_reads
FOR EACH ROW EXECUTE FUNCTION public.calendar_reminder_read_guard();
CREATE INDEX calendar_reminder_reads_owner_idx ON public.calendar_reminder_reads (owner_user_id, occurrence_date);