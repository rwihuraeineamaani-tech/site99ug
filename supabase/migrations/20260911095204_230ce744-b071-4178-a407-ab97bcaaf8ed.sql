CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  session_started_at timestamptz NOT NULL DEFAULT now(),
  current_path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence readable by system admin" ON public.user_presence
FOR SELECT TO authenticated
USING (public.is_system_admin(auth.uid()) OR user_id = auth.uid());

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  actor_kind text NOT NULL DEFAULT 'staff',
  area text NOT NULL DEFAULT 'general',
  action text NOT NULL,
  summary text,
  path text,
  entity_type text,
  entity_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE INDEX activity_log_actor_idx ON public.activity_log (actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity insert own" ON public.activity_log
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY "activity readable by system admin" ON public.activity_log
FOR SELECT TO authenticated
USING (public.is_system_admin(auth.uid()));

CREATE TRIGGER user_presence_touch BEFORE UPDATE ON public.user_presence
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_presence(_path text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT last_seen_at INTO _last FROM public.user_presence WHERE user_id = _uid;
  IF _last IS NULL THEN
    INSERT INTO public.user_presence (user_id, last_seen_at, session_started_at, current_path, user_agent)
    VALUES (_uid, now(), now(), _path, _user_agent);
  ELSE
    UPDATE public.user_presence
    SET last_seen_at = now(),
        current_path = COALESCE(_path, current_path),
        user_agent = COALESCE(_user_agent, user_agent),
        session_started_at = CASE WHEN now() - _last > interval '30 minutes' THEN now() ELSE session_started_at END
    WHERE user_id = _uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_presence(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_activity_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.activity_log WHERE created_at < now() - interval '90 days';
$$;

SELECT cron.schedule('purge-activity-log', '17 3 * * *', $$select public.purge_activity_log();$$);