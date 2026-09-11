REVOKE ALL ON FUNCTION public.purge_activity_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_activity_log() TO service_role;
REVOKE ALL ON FUNCTION public.touch_presence(text, text) FROM PUBLIC, anon;