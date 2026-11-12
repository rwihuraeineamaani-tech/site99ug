ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS client_approves_content boolean NOT NULL DEFAULT false;

CREATE TABLE public.shoot_day_client_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  item text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price_ugx integer NOT NULL DEFAULT 0,
  payer text NOT NULL DEFAULT 'client' CHECK (payer IN ('client','site99')),
  status text NOT NULL DEFAULT 'needed' CHECK (status IN ('needed','ready','provided')),
  visible_to_client boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_day_client_needs TO authenticated;
GRANT ALL ON public.shoot_day_client_needs TO service_role;
ALTER TABLE public.shoot_day_client_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage shoot needs" ON public.shoot_day_client_needs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Client reads own visible shoot needs" ON public.shoot_day_client_needs FOR SELECT TO authenticated
  USING (visible_to_client AND EXISTS (SELECT 1 FROM public.shoot_days s WHERE s.id = shoot_day_id AND s.resident_id = public.my_resident_id(auth.uid())));
CREATE TRIGGER shoot_day_client_needs_updated_at BEFORE UPDATE ON public.shoot_day_client_needs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Client review: approving moves the video straight to Handover when the client approves content.
CREATE OR REPLACE FUNCTION public.client_review_content(_id uuid, _caption text, _collab_ok boolean, _rejected_tags text[], _decision text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _c public.content_items; _h uuid; _msg text; _gate boolean;
BEGIN
  SELECT * INTO _c FROM public.content_items WHERE id = _id;
  IF _c.id IS NULL OR _c.resident_id IS DISTINCT FROM public.my_resident_id(auth.uid()) THEN
    RAISE EXCEPTION 'This post is not on your account';
  END IF;
  IF _decision NOT IN ('pending','approved','changes') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF _decision = 'changes' AND coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Tell us what to change'; END IF;
  SELECT client_approves_content INTO _gate FROM public.residents WHERE id = _c.resident_id;
  IF coalesce(_gate,false) AND _c.stage = 'Review' AND _decision IN ('approved','changes') THEN
    PERFORM set_config('app.shoot_sync', 'on', true);
  END IF;
  UPDATE public.content_items SET
    client_caption = CASE WHEN _caption IS NOT NULL AND _caption IS DISTINCT FROM coalesce(client_caption, caption_suggestions) THEN left(_caption, 4000) ELSE client_caption END,
    caption_edited_by_client_at = CASE WHEN _caption IS NOT NULL AND _caption IS DISTINCT FROM coalesce(client_caption, caption_suggestions) THEN now() ELSE caption_edited_by_client_at END,
    collab_status = CASE WHEN collab_handle IS NULL THEN collab_status WHEN _collab_ok IS NULL THEN collab_status WHEN _collab_ok THEN 'accepted' ELSE 'rejected' END,
    tags = coalesce((SELECT jsonb_agg(t || jsonb_build_object('status', CASE WHEN t->>'handle' = ANY(coalesce(_rejected_tags, '{}')) THEN 'rejected' ELSE 'accepted' END)) FROM jsonb_array_elements(tags) t), '[]'::jsonb),
    client_review_state = _decision,
    client_review_note = nullif(trim(_note), ''),
    client_reviewed_at = now(),
    stage = CASE WHEN coalesce(_gate,false) AND _c.stage = 'Review' AND _decision = 'approved' THEN 'Handover'
                 WHEN coalesce(_gate,false) AND _c.stage = 'Review' AND _decision = 'changes' THEN 'Editing'
                 ELSE stage END,
    founder_approved_at = CASE WHEN coalesce(_gate,false) AND _c.stage = 'Review' AND _decision = 'approved' THEN coalesce(founder_approved_at, now()) ELSE founder_approved_at END
  WHERE id = _id;
  PERFORM set_config('app.shoot_sync', 'off', true);
  _h := public.content_handler(_c.resident_id);
  IF _h IS NOT NULL THEN
    _msg := CASE _decision WHEN 'approved' THEN 'approved' WHEN 'changes' THEN 'asked for changes on' ELSE 'updated' END;
    INSERT INTO public.push_outbox (recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key)
    VALUES (_h, auth.uid(), 'tasks', 'client_review', 'content_item', _id,
      left('Client ' || _msg || ' a post', 120),
      left(_c.title || coalesce(': ' || nullif(trim(_note), ''), CASE WHEN _decision = 'approved' AND coalesce(_gate,false) THEN '. It is now with you in Handover.' ELSE '. Check caption, collab and tags before posting.' END), 240),
      '/app/post/' || _id, 'client-review:' || _id || ':' || extract(epoch FROM now())::bigint)
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END $function$;

-- Only System Admin may approve on the client's behalf when they have delayed.
CREATE OR REPLACE FUNCTION public.admin_override_client_approval(_id uuid, _note text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _c public.content_items; _h uuid;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN RAISE EXCEPTION 'Only System Admin can approve for a client' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.content_items WHERE id = _id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Video not found'; END IF;
  IF _c.stage <> 'Review' THEN RAISE EXCEPTION 'This video is not waiting on the client'; END IF;
  UPDATE public.content_items SET stage = 'Handover', client_review_state = 'approved',
    client_review_note = coalesce(nullif(trim(_note),''), 'Approved by System Admin on the client''s behalf'),
    client_reviewed_at = now() WHERE id = _id;
  INSERT INTO public.activity_log (actor_id, actor_kind, area, action, summary, path, entity_type, entity_id, detail)
  VALUES (auth.uid(), 'staff', 'content', 'client_approval_override', 'Approved "' || _c.title || '" for the client', '/app/post/' || _id, 'content_item', _id, jsonb_build_object('note', _note));
  _h := public.content_handler(_c.resident_id);
  IF _h IS NOT NULL THEN
    INSERT INTO public.push_outbox (recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key)
    VALUES (_h, auth.uid(), 'tasks', 'client_review', 'content_item', _id, 'Approved for the client', left(_c.title || '. It is now with you in Handover.', 240), '/app/post/' || _id, 'client-override:' || _id)
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.admin_override_client_approval(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_client_approval(uuid, text) TO authenticated;

-- One brief for a shoot day; clients get only what they should see.
CREATE OR REPLACE FUNCTION public.shoot_day_brief(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.shoot_days; _staff boolean := public.is_staff(auth.uid()); _out jsonb;
BEGIN
  SELECT * INTO d FROM public.shoot_days WHERE id = _id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Shoot day not found'; END IF;
  IF NOT _staff AND d.resident_id IS DISTINCT FROM public.my_resident_id(auth.uid()) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'id', d.id, 'shoot_date', d.shoot_date, 'call_time', d.call_time, 'location', d.location, 'status', d.status, 'notes', d.notes,
    'client', (SELECT name FROM public.residents WHERE id = d.resident_id),
    'budget_ugx', CASE WHEN _staff THEN d.budget_ugx END, 'budget_note', CASE WHEN _staff THEN d.budget_note END,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('ref_no', c.ref_no, 'title', c.title, 'content_type', c.content_type, 'notes', c.notes,
              'crew_notes', CASE WHEN _staff THEN c.crew_notes END) ORDER BY c.ref_no)
              FROM public.shoot_day_items i JOIN public.content_items c ON c.id = i.content_id WHERE i.shoot_day_id = d.id), '[]'::jsonb),
    'crew', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('name', coalesce(t.display_name, 'Site 99 crew'), 'role', cc.role))
              FROM public.shoot_day_items i JOIN public.content_crew cc ON cc.content_id = i.content_id
              LEFT JOIN public.team_members t ON t.user_id = cc.user_id WHERE i.shoot_day_id = d.id), '[]'::jsonb),
    'equipment', CASE WHEN _staff THEN coalesce((SELECT jsonb_agg(jsonb_build_object('name', e.name, 'qty', se.qty)) FROM public.shoot_day_equipment se JOIN public.equipment e ON e.id = se.equipment_id WHERE se.shoot_day_id = d.id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'needs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'item', n.item, 'qty', n.qty, 'unit_price_ugx', n.unit_price_ugx, 'payer', n.payer, 'status', n.status, 'note', n.note, 'visible_to_client', n.visible_to_client) ORDER BY n.created_at)
              FROM public.shoot_day_client_needs n WHERE n.shoot_day_id = d.id AND (_staff OR n.visible_to_client)), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $function$;
REVOKE EXECUTE ON FUNCTION public.shoot_day_brief(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shoot_day_brief(uuid) TO authenticated;