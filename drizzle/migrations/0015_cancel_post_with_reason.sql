ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS cancelled_reason text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- cancelled posts never get reminders or show in morning briefs
DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.arm_post_reminder'::regproc);
  d := replace(d, $q$OR NEW.stage IN ('Posted','Archived') OR NEW.resident_id IS NULL$q$, $q$OR NEW.stage IN ('Posted','Archived') OR NEW.cancelled_at IS NOT NULL OR NEW.resident_id IS NULL$q$);
  EXECUTE d;
  d := pg_get_functiondef('public.run_staff_morning_brief'::regproc);
  d := replace(d, $q$c.stage NOT IN ('Posted','Archived')
        AND (c.scheduled_post_at$q$, $q$c.stage NOT IN ('Posted','Archived') AND c.cancelled_at IS NULL
        AND (c.scheduled_post_at$q$);
  EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_post(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c content_items; who uuid := auth.uid();
BEGIN
  SELECT * INTO c FROM content_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF NOT (public.is_staff(who) AND (public.can_edit_content(who) OR public.is_founder() OR public.content_handler(c.resident_id) = who)) THEN
    RAISE EXCEPTION 'Only the Handler, content team or leadership can cancel a post';
  END IF;
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason for cancelling'; END IF;
  IF c.posted_at IS NOT NULL THEN RAISE EXCEPTION 'This video is already posted'; END IF;
  PERFORM set_config('app.shoot_sync', 'on', true);
  UPDATE content_items SET cancelled_at = now(), cancelled_reason = trim(_reason), cancelled_by = who, updated_at = now() WHERE id = _id;
  UPDATE push_outbox SET status = 'skipped', processed_at = now(), last_error = 'Post cancelled'
   WHERE event_key LIKE 'post-reminder:' || _id || ':%' AND status = 'pending';
  IF c.resident_id IS NOT NULL THEN
    PERFORM public.notify_client(c.resident_id, 'post_cancelled', 'Post cancelled: ' || c.title, trim(_reason), '/portal/calendar', 'pcancel:' || _id::text || ':' || extract(epoch FROM now())::bigint);
    IF public.content_handler(c.resident_id) IS DISTINCT FROM who THEN
      PERFORM public.notify_resident_handler(c.resident_id, 'post_cancelled', 'Post cancelled: ' || c.title, trim(_reason), '/app/content', 'pcancel-h:' || _id::text || ':' || extract(epoch FROM now())::bigint);
    END IF;
  END IF;
  INSERT INTO activity_log(actor_id, actor_kind, area, action, summary, entity_type, entity_id)
  VALUES (who, 'staff', 'content', 'post_cancelled', 'Cancelled "' || c.title || '": ' || trim(_reason), 'content_item', _id);
END $$;

CREATE OR REPLACE FUNCTION public.restore_post(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c content_items; who uuid := auth.uid();
BEGIN
  SELECT * INTO c FROM content_items WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF NOT (public.is_staff(who) AND (public.can_edit_content(who) OR public.is_founder() OR public.content_handler(c.resident_id) = who)) THEN
    RAISE EXCEPTION 'Only the Handler, content team or leadership can restore a post';
  END IF;
  PERFORM set_config('app.shoot_sync', 'on', true);
  UPDATE content_items SET cancelled_at = NULL, cancelled_reason = NULL, cancelled_by = NULL, updated_at = now() WHERE id = _id;
  -- re-arm the posting reminder
  UPDATE content_items SET scheduled_post_at = scheduled_post_at + interval '0 second' WHERE id = _id AND scheduled_post_at IS NOT NULL;
  INSERT INTO activity_log(actor_id, actor_kind, area, action, summary, entity_type, entity_id)
  VALUES (who, 'staff', 'content', 'post_restored', 'Restored "' || c.title || '"', 'content_item', _id);
END $$;

REVOKE ALL ON FUNCTION public.cancel_post(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.restore_post(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_post(uuid) TO authenticated;