CREATE OR REPLACE FUNCTION public.prepare_due_push_reminders(_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _inserted integer := 0;
BEGIN
  INSERT INTO public.push_outbox(recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
  SELECT ci.owner_user_id, NULL, 'tasks', 'calendar_reminder', 'calendar_item', ci.id,
    'Calendar reminder', left(ci.title || CASE WHEN ci.start_time IS NOT NULL THEN ' · ' || to_char(ci.start_time, 'HH24:MI') ELSE '' END, 240),
    COALESCE(NULLIF(ci.work_path,''), '/app/calendar'),
    'calendar-reminder:' || ci.id::text || ':' || ci.start_date::text,
    COALESCE(ci.reminder_at, ((ci.start_date::text || ' ' || COALESCE(ci.start_time::text,'09:00'))::timestamp AT TIME ZONE ci.timezone) - make_interval(mins => COALESCE(ci.reminder_minutes, 0)))
  FROM public.calendar_items ci
  WHERE ci.reminder_minutes IS NOT NULL
    AND ci.reminder_dismissed_at IS NULL
    AND ci.freq = 'none'
    AND COALESCE(ci.reminder_at, ((ci.start_date::text || ' ' || COALESCE(ci.start_time::text,'09:00'))::timestamp AT TIME ZONE ci.timezone) - make_interval(mins => COALESCE(ci.reminder_minutes, 0))) <= _now
    AND ((ci.start_date::text || ' ' || COALESCE(ci.start_time::text,'23:59'))::timestamp AT TIME ZONE ci.timezone) >= _now - interval '12 hours'
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS _count = ROW_COUNT;

  INSERT INTO public.push_outbox(recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
  SELECT sf.assigned_user_id, NULL, 'tasks', 'sales_followup', 'sales_followup', sf.id,
    'Sales follow-up due', left(sf.title, 240),
    '/app/sales?tab=opportunities&opportunity=' || sf.opportunity_id::text,
    'sales-followup:' || sf.id::text,
    sf.due_at
  FROM public.sales_followups sf
  WHERE sf.status = 'open' AND sf.due_at <= _now AND sf.due_at >= _now - interval '24 hours'
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  _count := _count + _inserted;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_due_push_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_due_push_reminders(timestamptz) TO service_role;