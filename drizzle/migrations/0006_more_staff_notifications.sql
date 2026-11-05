
CREATE OR REPLACE FUNCTION public.staff_notify(_uid uuid, _cat text, _type text, _title text, _body text, _path text, _key text, _bell boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.push_outbox (recipient_user_id, category, event_type, title, body, path, event_key)
  VALUES (_uid, _cat, _type, _title, left(_body, 240), _path, _key)
  ON CONFLICT (event_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN RETURN false; END IF;
  IF _bell THEN
    INSERT INTO public.inbox_messages (kind, subject, body, author, audience, target_user, link_path)
    VALUES ('message', _title, _body, NULL, 'person', _uid, _path);
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.staff_notify(uuid,text,text,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.active_staff_ids()
RETURNS TABLE(uid uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.user_id, coalesce(t.display_name, t.email) FROM public.team_members t
  WHERE t.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.resident_users r WHERE r.user_id = t.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.talent_users x WHERE x.user_id = t.user_id)
$$;
REVOKE ALL ON FUNCTION public.active_staff_ids() FROM PUBLIC, anon, authenticated;

-- Morning brief for every staff member
CREATE OR REPLACE FUNCTION public.run_staff_morning_brief()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  _dow int := extract(isodow FROM _today);
  _s public.attendance_settings; r record; _n int := 0; _parts text[]; _short text[];
  _tasks_today int; _tasks_late int; _tasks_week int; _oldest text; _approvals int; _posts text; _post_n int; _shoots text; _cal text; _metrics int;
BEGIN
  SELECT * INTO _s FROM public.attendance_settings LIMIT 1;
  FOR r IN SELECT * FROM public.active_staff_ids() LOOP
    _parts := '{}'; _short := '{}';
    SELECT count(*) FILTER (WHERE (t.due_at AT TIME ZONE 'Africa/Kampala')::date = _today),
           count(*) FILTER (WHERE t.due_at < now()),
           count(*) FILTER (WHERE (t.due_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN _today + 1 AND _today + 7)
      INTO _tasks_today, _tasks_late, _tasks_week
      FROM public.leadership_tasks t JOIN public.leadership_task_assignees a ON a.task_id = t.id
      WHERE a.user_id = r.uid AND t.status NOT IN ('accepted','cancelled');
    SELECT t.title INTO _oldest FROM public.leadership_tasks t JOIN public.leadership_task_assignees a ON a.task_id = t.id
      WHERE a.user_id = r.uid AND t.status NOT IN ('accepted','cancelled') ORDER BY t.created_at LIMIT 1;
    SELECT count(*) INTO _approvals FROM public.approval_tasks WHERE assigned_user_id = r.uid AND status = 'pending';
    SELECT string_agg(to_char(c.scheduled_post_at AT TIME ZONE 'Africa/Kampala','HH24:MI') || ' ' || res.name || ': ' || c.title, E'\n' ORDER BY c.scheduled_post_at), count(*)
      INTO _posts, _post_n
      FROM public.content_items c JOIN public.residents res ON res.id = c.resident_id
      WHERE public.content_handler(c.resident_id) = r.uid AND c.stage NOT IN ('Posted','Archived')
        AND (c.scheduled_post_at AT TIME ZONE 'Africa/Kampala')::date = _today;
    SELECT count(*) INTO _metrics FROM public.content_items c
      WHERE public.content_handler(c.resident_id) = r.uid AND c.metrics_due_at IS NOT NULL AND c.metrics_filled_at IS NULL AND c.metrics_due_at <= _today + 1;
    SELECT string_agg(DISTINCT res.name || coalesce(' at ' || s.call_time, ''), ', ') INTO _shoots
      FROM public.shoot_days s JOIN public.residents res ON res.id = s.resident_id
      WHERE s.shoot_date = _today AND s.status <> 'cancelled' AND (
        public.content_handler(s.resident_id) = r.uid OR EXISTS (
          SELECT 1 FROM public.shoot_day_items i JOIN public.content_crew cc ON cc.content_id = i.content_id
          WHERE i.shoot_day_id = s.id AND cc.user_id = r.uid));
    SELECT string_agg(coalesce(to_char(ci.start_time,'HH24:MI') || ' ', '') || ci.title, ', ' ORDER BY ci.start_time) INTO _cal
      FROM public.calendar_items ci WHERE ci.owner_user_id = r.uid AND ci.start_date = _today AND coalesce(ci.freq,'none') IN ('none','');

    IF _post_n > 0 THEN _parts := _parts || ('Posting today:' || E'\n' || _posts); _short := _short || (_post_n || ' post(s)'); END IF;
    IF _shoots IS NOT NULL THEN _parts := _parts || ('Shoot today: ' || _shoots); _short := _short || ('shoot: ' || _shoots); END IF;
    IF _tasks_today > 0 THEN _parts := _parts || (_tasks_today || ' task(s) due today.'); _short := _short || (_tasks_today || ' due today'); END IF;
    IF _tasks_late > 0 THEN _parts := _parts || (_tasks_late || ' task(s) are overdue.'); _short := _short || (_tasks_late || ' overdue'); END IF;
    IF _approvals > 0 THEN _parts := _parts || (_approvals || ' approval(s) waiting on you.'); _short := _short || (_approvals || ' to approve'); END IF;
    IF _metrics > 0 THEN _parts := _parts || (_metrics || ' video(s) need their numbers by tomorrow.'); _short := _short || (_metrics || ' numbers due'); END IF;
    IF _cal IS NOT NULL THEN _parts := _parts || ('In your calendar: ' || _cal); END IF;
    IF coalesce(array_length(_parts,1),0) = 0 THEN
      _parts := _parts || CASE WHEN _tasks_week > 0 THEN 'A clear morning. ' || _tasks_week || ' task(s) land later this week, a head start now saves a rush later.'
        WHEN _oldest IS NOT NULL THEN 'Nothing is due today. Your oldest open task is "' || _oldest || '", today is a good day to close it.'
        ELSE 'Nothing booked for you today. Check the content pipeline for ideas that need a hand.' END;
      _short := _short || 'clear day, open your brief';
    END IF;
    IF _s.enabled AND _dow = ANY(_s.work_days) AND NOT (r.uid = ANY(coalesce(_s.exempt_user_ids,'{}'))) THEN
      _parts := _parts || ('Clock in before ' || to_char(_s.cutoff_time,'HH24:MI') || '.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE event_key = 'morning-brief:' || r.uid || ':' || _today) THEN
      INSERT INTO public.inbox_messages (kind, subject, body, author, audience, target_user, link_path)
      VALUES ('brief', 'Your day, ' || to_char(_today, 'Dy DD Mon'), array_to_string(_parts, E'\n\n'), NULL, 'person', r.uid, '/app/inbox');
      PERFORM public.staff_notify(r.uid, 'tasks', 'morning_brief', 'Your day at a glance', initcap(left(array_to_string(_short, ', '), 230)) || '.', '/app/inbox', 'morning-brief:' || r.uid || ':' || _today, false);
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.run_staff_morning_brief() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_handler_morning_brief()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.run_staff_morning_brief() $$;

-- Clock-in reminders
CREATE OR REPLACE FUNCTION public.run_attendance_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _local timestamp := now() AT TIME ZONE 'Africa/Kampala';
  _today date := _local::date; _t time := _local::time;
  _s public.attendance_settings; r record; _n int := 0; _in int; _late int; _out int; _md record;
BEGIN
  SELECT * INTO _s FROM public.attendance_settings LIMIT 1;
  IF NOT coalesce(_s.enabled,false) OR NOT (extract(isodow FROM _today)::int = ANY(_s.work_days)) THEN RETURN 0; END IF;
  FOR r IN SELECT s.* FROM public.active_staff_ids() s WHERE NOT (s.uid = ANY(coalesce(_s.exempt_user_ids,'{}'))) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.user_id = r.uid AND a.day = _today AND a.clock_in_at IS NOT NULL) THEN
      IF _t >= _s.cutoff_time - interval '15 minutes' AND _t < _s.cutoff_time THEN
        _n := _n + public.staff_notify(r.uid, 'tasks', 'clock_in_soon', 'Clock in before ' || to_char(_s.cutoff_time,'HH24:MI'), 'You have 15 minutes to clock in on time today.', '/app', 'clockin-soon:' || r.uid || ':' || _today)::int;
      ELSIF _t >= _s.cutoff_time AND _t < _s.cutoff_time + interval '3 hours' THEN
        _n := _n + public.staff_notify(r.uid, 'tasks', 'clock_in_late', 'You have not clocked in yet', 'It is past ' || to_char(_s.cutoff_time,'HH24:MI') || '. Clock in now, or tell your manager if you are away.', '/app', 'clockin-late:' || r.uid || ':' || _today)::int;
      END IF;
    ELSIF _s.require_clockout AND _t >= time '18:30' AND EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.user_id = r.uid AND a.day = _today AND a.clock_out_at IS NULL) THEN
      _n := _n + public.staff_notify(r.uid, 'tasks', 'clock_out', 'Remember to clock out', 'You are still clocked in. Clock out before you leave.', '/app', 'clockout:' || r.uid || ':' || _today)::int;
    END IF;
  END LOOP;
  IF _t >= _s.cutoff_time + make_interval(mins => coalesce(_s.grace_min,0)) + interval '5 minutes' AND _t < time '14:00' THEN
    SELECT count(*) FILTER (WHERE a.clock_in_at IS NOT NULL AND coalesce(a.late_minutes,0) = 0),
           count(*) FILTER (WHERE a.clock_in_at IS NOT NULL AND coalesce(a.late_minutes,0) > 0),
           count(*) FILTER (WHERE a.clock_in_at IS NULL)
      INTO _in, _late, _out
      FROM public.active_staff_ids() s LEFT JOIN public.attendance_records a ON a.user_id = s.uid AND a.day = _today
      WHERE NOT (s.uid = ANY(coalesce(_s.exempt_user_ids,'{}')));
    FOR _md IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'managing_director' LOOP
      PERFORM public.staff_notify(_md.user_id, 'tasks', 'attendance_summary', 'Clock-in today', _in || ' on time, ' || _late || ' late, ' || _out || ' not in yet.', '/app/attendance', 'att-summary:' || _md.user_id || ':' || _today);
    END LOOP;
  END IF;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.run_attendance_reminders() FROM PUBLIC, anon, authenticated;

-- Everyday due reminders
CREATE OR REPLACE FUNCTION public.run_due_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _local timestamp := now() AT TIME ZONE 'Africa/Kampala'; _today date := _local::date; r record; _n int := 0;
BEGIN
  -- Tasks due tomorrow (sent after 16:00) and overdue (once per day)
  FOR r IN SELECT t.id, t.title, t.due_at, a.user_id, coalesce(t.work_path,'/app/todo') p FROM public.leadership_tasks t JOIN public.leadership_task_assignees a ON a.task_id = t.id
           WHERE t.status NOT IN ('accepted','cancelled') AND t.due_at IS NOT NULL LOOP
    IF (r.due_at AT TIME ZONE 'Africa/Kampala')::date = _today + 1 AND _local::time >= time '16:00' THEN
      _n := _n + public.staff_notify(r.user_id, 'tasks', 'task_due_tomorrow', 'Due tomorrow: ' || r.title, 'This task is due tomorrow at ' || to_char(r.due_at AT TIME ZONE 'Africa/Kampala','HH24:MI') || '.', r.p, 'task-tmrw:' || r.id || ':' || r.user_id)::int;
    ELSIF r.due_at < now() AND _local::time >= time '10:00' THEN
      _n := _n + public.staff_notify(r.user_id, 'tasks', 'task_overdue', 'Overdue: ' || r.title, 'This task was due ' || to_char(r.due_at AT TIME ZONE 'Africa/Kampala','Dy DD Mon') || '. Submit it or ask for more time.', r.p, 'task-late:' || r.id || ':' || r.user_id || ':' || _today)::int;
    END IF;
  END LOOP;
  -- Calendar items in the next 30 minutes (one-off items with a time)
  FOR r IN SELECT ci.id, ci.title, ci.owner_user_id, ci.start_time, ci.location FROM public.calendar_items ci
           WHERE ci.start_date = _today AND ci.start_time IS NOT NULL AND coalesce(ci.freq,'none') IN ('none','')
             AND ci.start_time > _local::time AND ci.start_time <= _local::time + interval '30 minutes' LOOP
    _n := _n + public.staff_notify(r.owner_user_id, 'communications', 'calendar_soon', 'At ' || to_char(r.start_time,'HH24:MI') || ': ' || r.title, coalesce('Location: ' || r.location, 'Starting in under 30 minutes.'), '/app/calendar', 'cal:' || r.id || ':' || _today)::int;
  END LOOP;
  -- Shoot tomorrow, evening before (after 17:00), crew + handler
  IF _local::time >= time '17:00' THEN
    FOR r IN SELECT DISTINCT s.id, res.name, s.call_time, s.location, u.uid FROM public.shoot_days s JOIN public.residents res ON res.id = s.resident_id
             CROSS JOIN LATERAL (SELECT public.content_handler(s.resident_id) uid UNION SELECT cc.user_id FROM public.shoot_day_items i JOIN public.content_crew cc ON cc.content_id = i.content_id WHERE i.shoot_day_id = s.id) u
             WHERE s.shoot_date = _today + 1 AND s.status <> 'cancelled' AND u.uid IS NOT NULL LOOP
      _n := _n + public.staff_notify(r.uid, 'tasks', 'shoot_tomorrow', 'Shoot tomorrow: ' || r.name, concat_ws('. ', 'Call time ' || r.call_time, 'At ' || r.location, 'Charge batteries and check the brief'), '/app/shoot-days', 'shoot-tmrw:' || r.id || ':' || r.uid)::int;
    END LOOP;
  END IF;
  -- Approvals waiting over 24 hours (once a day)
  FOR r IN SELECT at.id, at.node_label, at.assigned_user_id FROM public.approval_tasks at
           WHERE at.status = 'pending' AND at.assigned_user_id IS NOT NULL AND at.created_at < now() - interval '24 hours' LOOP
    _n := _n + public.staff_notify(r.assigned_user_id, 'approvals', 'approval_waiting', 'Still waiting on you', coalesce(r.node_label,'An approval') || ' has waited over a day.', '/app/approvals', 'appr-wait:' || r.id || ':' || _today)::int;
  END LOOP;
  -- Overdue client invoices (once a day, after 09:00): finance team + handler
  IF _local::time >= time '09:00' THEN
    FOR r IN SELECT DISTINCT i.id, i.number, i.party_name, i.total_ugx - coalesce(i.amount_paid_ugx,0) owed, u.uid FROM public.invoices i
             CROSS JOIN LATERAL (SELECT public.content_handler(i.resident_id) uid UNION SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'finance_ops') u
             WHERE i.direction = 'out' AND i.status = 'sent' AND i.due_date < _today AND coalesce(i.amount_paid_ugx,0) < i.total_ugx AND u.uid IS NOT NULL LOOP
      _n := _n + public.staff_notify(r.uid, 'finance', 'invoice_overdue', 'Overdue invoice ' || coalesce(r.number,''), coalesce(r.party_name,'A client') || ' still owes UGX ' || to_char(r.owed,'FM999,999,999') || '.', '/app/finance', 'inv-late:' || r.id || ':' || r.uid || ':' || _today)::int;
    END LOOP;
  END IF;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.run_due_reminders() FROM PUBLIC, anon, authenticated;

-- Client review answers alert the Handler
CREATE OR REPLACE FUNCTION public.notify_handler_client_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := public.content_handler(NEW.resident_id); _what text;
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.client_review_state IS DISTINCT FROM OLD.client_review_state AND NEW.client_review_state IN ('approved','changes') THEN
    _what := CASE WHEN NEW.client_review_state = 'approved' THEN 'approved' ELSE 'asked for changes on' END;
  ELSIF NEW.collab_status IS DISTINCT FROM OLD.collab_status AND NEW.collab_status = 'rejected' THEN _what := 'rejected the collab on';
  ELSIF NEW.tags IS DISTINCT FROM OLD.tags AND NEW.tags::text LIKE '%"rejected"%' AND coalesce(OLD.tags::text,'') NOT LIKE '%"rejected"%' THEN _what := 'rejected a tag on';
  ELSIF NEW.client_caption IS DISTINCT FROM OLD.client_caption AND NEW.client_caption IS NOT NULL THEN _what := 'edited the caption on';
  END IF;
  IF _what IS NOT NULL THEN
    PERFORM public.staff_notify(_uid, 'communications', 'client_review', 'Client ' || _what || ' a post', NEW.title || coalesce(': "' || NEW.client_review_note || '"', ''), '/app/content', 'review:' || NEW.id || ':' || extract(epoch FROM now())::bigint);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_client_review_notify ON public.content_items;
CREATE TRIGGER content_client_review_notify AFTER UPDATE OF client_review_state, collab_status, tags, client_caption ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_handler_client_review();

-- Who has notifications on (for System Admin People view)
CREATE OR REPLACE FUNCTION public.push_enabled_users()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT user_id FROM public.push_devices WHERE active
    AND (public.has_role(auth.uid(),'admin') OR public.can_view_people(auth.uid()) OR user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.push_enabled_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_enabled_users() TO authenticated;
