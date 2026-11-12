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
  UPDATE content_items SET cancelled_at = NULL, cancelled_reason = NULL, cancelled_by = NULL, scheduled_post_at = NULL, updated_at = now() WHERE id = _id;
  -- setting the time back re-arms the 30-minute posting reminder
  UPDATE content_items SET scheduled_post_at = c.scheduled_post_at WHERE id = _id AND c.scheduled_post_at IS NOT NULL;
  INSERT INTO activity_log(actor_id, actor_kind, area, action, summary, entity_type, entity_id)
  VALUES (who, 'staff', 'content', 'post_restored', 'Restored "' || c.title || '"', 'content_item', _id);
END $$;