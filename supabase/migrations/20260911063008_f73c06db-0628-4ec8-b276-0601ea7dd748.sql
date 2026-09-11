CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_label text,
  user_agent text,
  platform text,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People manage own push devices" ON public.push_devices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX push_devices_user_active_idx ON public.push_devices(user_id, active);

CREATE TABLE public.push_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tasks_enabled boolean NOT NULL DEFAULT true,
  approvals_enabled boolean NOT NULL DEFAULT true,
  communications_enabled boolean NOT NULL DEFAULT true,
  finance_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_preferences TO authenticated;
GRANT ALL ON public.push_preferences TO service_role;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People manage own push preferences" ON public.push_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('tasks','approvals','communications','finance')),
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  path text NOT NULL DEFAULT '/app',
  event_key text NOT NULL UNIQUE,
  available_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_outbox TO authenticated;
GRANT ALL ON public.push_outbox TO service_role;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People view own push history" ON public.push_outbox FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
CREATE INDEX push_outbox_dispatch_idx ON public.push_outbox(status, available_at) WHERE status IN ('pending','failed');
CREATE INDEX push_outbox_recipient_idx ON public.push_outbox(recipient_user_id, created_at DESC);

CREATE TABLE public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.push_outbox(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.push_devices(id) ON DELETE SET NULL,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent','failed','stale','skipped')),
  provider_status integer,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins view push delivery logs" ON public.push_delivery_log FOR SELECT TO authenticated USING (public.is_system_admin(auth.uid()));
CREATE INDEX push_delivery_log_outbox_idx ON public.push_delivery_log(outbox_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.push_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.push_touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_touch_updated_at() TO authenticated, service_role;
CREATE TRIGGER push_devices_touch BEFORE UPDATE ON public.push_devices FOR EACH ROW EXECUTE FUNCTION public.push_touch_updated_at();
CREATE TRIGGER push_preferences_touch BEFORE UPDATE ON public.push_preferences FOR EACH ROW EXECUTE FUNCTION public.push_touch_updated_at();

CREATE OR REPLACE FUNCTION public.queue_push(
  _recipient uuid, _actor uuid, _category text, _event_type text,
  _entity_type text, _entity_id uuid, _title text, _body text,
  _path text, _event_key text, _available_at timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _recipient IS NULL OR _recipient = _actor OR _category NOT IN ('tasks','approvals','communications','finance') THEN RETURN; END IF;
  INSERT INTO public.push_outbox(recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
  VALUES (_recipient, _actor, _category, _event_type, _entity_type, _entity_id, left(_title,120), left(_body,240), COALESCE(NULLIF(_path,''),'/app'), _event_key, COALESCE(_available_at,now()))
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_push(uuid,uuid,text,text,text,uuid,text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_push(uuid,uuid,text,text,text,uuid,text,text,text,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_chat_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _recipient uuid;
BEGIN
  FOR _recipient IN SELECT user_id FROM public.chat_participants WHERE thread_id = NEW.thread_id AND user_id <> NEW.sender_id LOOP
    PERFORM public.queue_push(_recipient, NEW.sender_id, 'communications', 'chat_message', 'chat_message', NEW.id, 'New message', left(NEW.body,160), '/app/chat/'||NEW.thread_id::text, 'chat:'||NEW.id::text||':'||_recipient::text);
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_chat_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chat_message_queue_push AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.queue_chat_push();

CREATE OR REPLACE FUNCTION public.queue_communication_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _recipient uuid; _is_announcement boolean := TG_TABLE_NAME = 'announcements'; _published boolean;
BEGIN
  _published := CASE WHEN _is_announcement THEN COALESCE(NEW.published,false) ELSE true END;
  IF NOT _published OR (_is_announcement AND TG_OP = 'UPDATE' AND COALESCE(OLD.published,false)) THEN RETURN NEW; END IF;
  FOR _recipient IN SELECT tm.user_id FROM public.team_members tm WHERE tm.user_id IS NOT NULL AND tm.user_id <> NEW.created_by LOOP
    PERFORM public.queue_push(_recipient, NEW.created_by, 'communications', CASE WHEN _is_announcement THEN 'announcement' ELSE 'brief' END, TG_TABLE_NAME, NEW.id,
      CASE WHEN _is_announcement THEN 'New announcement' ELSE 'New brief' END,
      CASE WHEN _is_announcement THEN left(COALESCE(NEW.title,'Open the announcement'),160) ELSE left(COALESCE(NEW.title,'Open the brief'),160) END,
      CASE WHEN _is_announcement THEN '/app/announcements/' ELSE '/app/briefs/' END || NEW.id::text,
      TG_TABLE_NAME||':'||NEW.id::text||':'||_recipient::text);
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_communication_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER brief_queue_push AFTER INSERT ON public.briefs FOR EACH ROW EXECUTE FUNCTION public.queue_communication_push();
CREATE TRIGGER announcement_queue_push AFTER INSERT OR UPDATE OF published ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.queue_communication_push();

CREATE OR REPLACE FUNCTION public.queue_approval_task_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.assigned_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id) THEN
    PERFORM public.queue_push(NEW.assigned_user_id, NULL, 'approvals', 'approval_assigned', 'approval_task', NEW.id, 'Approval waiting', left(COALESCE(NEW.node_label,'An approval needs you'),160), '/app/approvals', 'approval-task:'||NEW.id::text||':'||NEW.assigned_user_id::text);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_approval_task_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER approval_task_queue_push AFTER INSERT OR UPDATE OF status, assigned_user_id ON public.approval_tasks FOR EACH ROW EXECUTE FUNCTION public.queue_approval_task_push();

CREATE OR REPLACE FUNCTION public.queue_cash_request_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _recipient uuid; _actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' THEN
    FOR _recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'managing_director' AND ur.user_id <> NEW.requester_id LOOP
      PERFORM public.queue_push(_recipient,_actor,'finance','cash_request_submitted','cash_request',NEW.id,'Cash request waiting','A cash request needs review.','/app/finance/requests','cash:'||NEW.id::text||':submitted:'||_recipient::text);
    END LOOP;
  ELSIF NEW.status = 'md_approved' THEN
    FOR _recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'founder' AND ur.user_id <> NEW.requester_id LOOP
      PERFORM public.queue_push(_recipient,_actor,'finance','cash_request_founder_review','cash_request',NEW.id,'Founder approval waiting','A cash request needs final review.','/app/finance/requests','cash:'||NEW.id::text||':md:'||_recipient::text);
    END LOOP;
  ELSIF NEW.status IN ('founder_approved','declined','rejected') THEN
    PERFORM public.queue_push(NEW.requester_id,_actor,'finance','cash_request_decided','cash_request',NEW.id,'Cash request updated','Your cash request has been '||replace(NEW.status,'_',' ')||'.','/app/finance/requests','cash:'||NEW.id::text||':'||NEW.status||':'||NEW.requester_id::text);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_cash_request_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cash_request_queue_push AFTER INSERT OR UPDATE OF status ON public.cash_requests FOR EACH ROW EXECUTE FUNCTION public.queue_cash_request_push();

CREATE OR REPLACE FUNCTION public.queue_payment_line_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _recipient uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'pending' THEN
    FOR _recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('founder','managing_director') LOOP
      PERFORM public.queue_push(_recipient,auth.uid(),'finance','payment_pending','payment_run_line',NEW.id,'Payment approval waiting','A payment is ready for review.','/app/finance/payments','payment:'||NEW.id::text||':pending:'||_recipient::text);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_payment_line_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payment_line_queue_push AFTER INSERT OR UPDATE OF status ON public.payment_run_lines FOR EACH ROW EXECUTE FUNCTION public.queue_payment_line_push();