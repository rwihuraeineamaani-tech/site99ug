REVOKE EXECUTE ON FUNCTION public.sync_calendar_busy_slot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calendar_slot_occurs_on(public.calendar_busy_slots, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_calendar_busy_slot() TO service_role;
GRANT EXECUTE ON FUNCTION public.calendar_slot_occurs_on(public.calendar_busy_slots, date) TO service_role;