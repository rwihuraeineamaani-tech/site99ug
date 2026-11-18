-- A browser has one push token. When a different person signs in on the same device
-- (a staff member checking a client account, or a shared office laptop), the token
-- moves to whoever is signed in now, so alerts never reach the previous person.
CREATE OR REPLACE FUNCTION public.register_push_device(_token text, _label text, _platform text, _user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF coalesce(trim(_token), '') = '' THEN RAISE EXCEPTION 'Missing device token'; END IF;
  INSERT INTO public.push_devices (user_id, token, device_label, platform, user_agent, active, last_seen_at, updated_at)
  VALUES (auth.uid(), _token, left(coalesce(_label, 'This device'), 120), left(_platform, 120), left(_user_agent, 500), true, now(), now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = auth.uid(), device_label = excluded.device_label, platform = excluded.platform,
        user_agent = excluded.user_agent, active = true, last_seen_at = now(), updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.register_push_device(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, text) TO authenticated;