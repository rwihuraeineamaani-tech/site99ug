GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_maps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_map_versions TO authenticated;
GRANT ALL ON public.strategy_maps TO service_role;
GRANT ALL ON public.strategy_map_versions TO service_role;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS client_caption text,
  ADD COLUMN IF NOT EXISTS caption_edited_by_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS collab_handle text,
  ADD COLUMN IF NOT EXISTS collab_url text,
  ADD COLUMN IF NOT EXISTS collab_status text NOT NULL DEFAULT 'proposed',
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS post_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS post_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS client_review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS client_review_note text,
  ADD COLUMN IF NOT EXISTS client_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.content_handler(_resident uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(handler_user_id, contact_user_id) FROM public.residents WHERE id = _resident
$$;

CREATE OR REPLACE FUNCTION public.arm_post_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _h uuid; _client text; _at text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.scheduled_post_at IS NOT DISTINCT FROM OLD.scheduled_post_at
     AND NEW.stage = OLD.stage AND NEW.resident_id IS NOT DISTINCT FROM OLD.resident_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.push_outbox SET status = 'skipped', processed_at = now(), last_error = 'Rescheduled'
   WHERE event_key LIKE 'post-reminder:' || NEW.id || ':%' AND status = 'pending';
  IF NEW.scheduled_post_at IS NULL OR NEW.scheduled_post_at <= now() OR NEW.stage IN ('Posted','Archived') OR NEW.resident_id IS NULL THEN
    RETURN NEW;
  END IF;
  _h := public.content_handler(NEW.resident_id);
  IF _h IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO _client FROM public.residents WHERE id = NEW.resident_id;
  _at := to_char(NEW.scheduled_post_at AT TIME ZONE 'Africa/Kampala', 'HH24:MI');
  INSERT INTO public.push_outbox (recipient_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
  VALUES (_h, 'tasks', 'post_reminder', 'content_item', NEW.id,
    left('Posting in 30 min: ' || coalesce(_client, 'client'), 120),
    left(NEW.title || ' goes out at ' || _at || ' on ' || coalesce(nullif(array_to_string(NEW.platforms, ', '), ''), 'the planned platforms') || '. Cut, caption and tags are ready.', 240),
    '/app/post/' || NEW.id,
    'post-reminder:' || NEW.id || ':' || extract(epoch FROM NEW.scheduled_post_at)::bigint,
    NEW.scheduled_post_at - interval '30 minutes')
  ON CONFLICT (event_key) DO UPDATE SET status = 'pending', available_at = EXCLUDED.available_at, attempts = 0, processed_at = NULL, last_error = NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS content_post_reminder ON public.content_items;
CREATE TRIGGER content_post_reminder AFTER INSERT OR UPDATE ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.arm_post_reminder();

INSERT INTO public.push_outbox (recipient_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
SELECT public.content_handler(c.resident_id), 'tasks', 'post_reminder', 'content_item', c.id,
  left('Posting in 30 min: ' || coalesce(r.name, 'client'), 120),
  left(c.title || ' goes out at ' || to_char(c.scheduled_post_at AT TIME ZONE 'Africa/Kampala', 'HH24:MI') || ' on ' || coalesce(nullif(array_to_string(c.platforms, ', '), ''), 'the planned platforms') || '. Cut, caption and tags are ready.', 240),
  '/app/post/' || c.id,
  'post-reminder:' || c.id || ':' || extract(epoch FROM c.scheduled_post_at)::bigint,
  c.scheduled_post_at - interval '30 minutes'
FROM public.content_items c JOIN public.residents r ON r.id = c.resident_id
WHERE c.scheduled_post_at > now() AND c.stage NOT IN ('Posted','Archived') AND public.content_handler(c.resident_id) IS NOT NULL
ON CONFLICT (event_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.client_review_content(_id uuid, _caption text, _collab_ok boolean, _rejected_tags text[], _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.content_items; _h uuid; _msg text;
BEGIN
  SELECT * INTO _c FROM public.content_items WHERE id = _id;
  IF _c.id IS NULL OR _c.resident_id IS DISTINCT FROM public.my_resident_id(auth.uid()) THEN
    RAISE EXCEPTION 'This post is not on your account';
  END IF;
  IF _decision NOT IN ('pending','approved','changes') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF _decision = 'changes' AND coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Tell us what to change'; END IF;
  UPDATE public.content_items SET
    client_caption = CASE WHEN _caption IS NOT NULL AND _caption IS DISTINCT FROM coalesce(client_caption, caption_suggestions) THEN left(_caption, 4000) ELSE client_caption END,
    caption_edited_by_client_at = CASE WHEN _caption IS NOT NULL AND _caption IS DISTINCT FROM coalesce(client_caption, caption_suggestions) THEN now() ELSE caption_edited_by_client_at END,
    collab_status = CASE WHEN collab_handle IS NULL THEN collab_status WHEN _collab_ok IS NULL THEN collab_status WHEN _collab_ok THEN 'accepted' ELSE 'rejected' END,
    tags = coalesce((SELECT jsonb_agg(t || jsonb_build_object('status', CASE WHEN t->>'handle' = ANY(coalesce(_rejected_tags, '{}')) THEN 'rejected' ELSE 'accepted' END)) FROM jsonb_array_elements(tags) t), '[]'::jsonb),
    client_review_state = _decision,
    client_review_note = nullif(trim(_note), ''),
    client_reviewed_at = now()
  WHERE id = _id;
  _h := public.content_handler(_c.resident_id);
  IF _h IS NOT NULL THEN
    _msg := CASE _decision WHEN 'approved' THEN 'approved' WHEN 'changes' THEN 'asked for changes on' ELSE 'updated' END;
    INSERT INTO public.push_outbox (recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key)
    VALUES (_h, auth.uid(), 'tasks', 'client_review', 'content_item', _id,
      left('Client ' || _msg || ' a post', 120),
      left(_c.title || coalesce(': ' || nullif(trim(_note), ''), '. Check caption, collab and tags before posting.'), 240),
      '/app/post/' || _id, 'client-review:' || _id || ':' || extract(epoch FROM now())::bigint)
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.client_review_content(uuid, text, boolean, text[], text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.client_review_content(uuid, text, boolean, text[], text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_handler_morning_brief()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := (now() AT TIME ZONE 'Africa/Kampala')::date; r record; _n int := 0; _body text;
BEGIN
  FOR r IN
    WITH h AS (SELECT id rid, name, public.content_handler(id) uid FROM public.residents WHERE public.content_handler(id) IS NOT NULL),
    posts AS (SELECT h.uid, h.name, c.title, c.platforms, c.scheduled_post_at, c.client_review_state FROM h JOIN public.content_items c ON c.resident_id = h.rid
      WHERE c.stage NOT IN ('Posted','Archived') AND (c.scheduled_post_at AT TIME ZONE 'Africa/Kampala')::date = _today),
    shoots AS (SELECT h.uid, h.name, s.call_time FROM h JOIN public.shoot_days s ON s.resident_id = h.rid WHERE s.shoot_date = _today),
    late AS (SELECT h.uid, count(*) n FROM h JOIN public.content_items c ON c.resident_id = h.rid
      WHERE c.stage NOT IN ('Posted','Archived') AND c.scheduled_post_at < date_trunc('day', now() AT TIME ZONE 'Africa/Kampala') AT TIME ZONE 'Africa/Kampala' GROUP BY 1),
    metrics AS (SELECT h.uid, count(*) n FROM h JOIN public.content_items c ON c.resident_id = h.rid
      WHERE c.metrics_due_at IS NOT NULL AND c.metrics_filled_at IS NULL AND c.metrics_due_at <= now() + interval '1 day' GROUP BY 1),
    u AS (SELECT uid FROM posts UNION SELECT uid FROM shoots UNION SELECT uid FROM late UNION SELECT uid FROM metrics)
    SELECT u.uid,
      (SELECT string_agg(to_char(p.scheduled_post_at AT TIME ZONE 'Africa/Kampala','HH24:MI') || ' ' || p.name || ': ' || p.title || ' (' || coalesce(nullif(array_to_string(p.platforms, ', '),''),'platform tbc') || CASE WHEN p.client_review_state <> 'approved' THEN ', client not approved yet' ELSE '' END || ')', E'\n' ORDER BY p.scheduled_post_at) FROM posts p WHERE p.uid = u.uid) post_lines,
      (SELECT count(*) FROM posts p WHERE p.uid = u.uid) post_n,
      (SELECT string_agg(s.name || coalesce(' at ' || to_char(s.call_time,'HH24:MI'), ''), ', ') FROM shoots s WHERE s.uid = u.uid) shoot_line,
      coalesce((SELECT n FROM late WHERE late.uid = u.uid), 0) late_n,
      coalesce((SELECT n FROM metrics WHERE metrics.uid = u.uid), 0) metrics_n
    FROM u
  LOOP
    _body := concat_ws(E'\n\n',
      CASE WHEN r.post_n > 0 THEN 'Posting today:' || E'\n' || r.post_lines END,
      CASE WHEN r.shoot_line IS NOT NULL THEN 'Shoot days today: ' || r.shoot_line END,
      CASE WHEN r.late_n > 0 THEN r.late_n || ' post(s) are past their time and still not marked posted.' END,
      CASE WHEN r.metrics_n > 0 THEN r.metrics_n || ' video(s) need their numbers filled in by tomorrow.' END);
    INSERT INTO public.inbox_messages (kind, subject, body, author, audience, target_user, link_path)
    VALUES ('brief', 'Your day, ' || to_char(_today, 'Dy DD Mon'), _body, NULL, 'person', r.uid, '/app/content');
    INSERT INTO public.push_outbox (recipient_user_id, category, event_type, title, body, path, event_key)
    VALUES (r.uid, 'tasks', 'morning_brief', 'Your day at a glance',
      left(concat_ws('. ', CASE WHEN r.post_n > 0 THEN r.post_n || ' post(s) to go out' END, CASE WHEN r.shoot_line IS NOT NULL THEN 'shoot: ' || r.shoot_line END, CASE WHEN r.late_n > 0 THEN r.late_n || ' overdue' END, CASE WHEN r.metrics_n > 0 THEN r.metrics_n || ' numbers due' END) || '.', 240),
      '/app/inbox', 'morning-brief:' || r.uid || ':' || _today)
    ON CONFLICT (event_key) DO NOTHING;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.run_handler_morning_brief() FROM public, anon, authenticated;