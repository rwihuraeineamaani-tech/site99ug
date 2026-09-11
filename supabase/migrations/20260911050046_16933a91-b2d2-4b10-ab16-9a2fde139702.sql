CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direct_key text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX chat_participants_user_idx ON public.chat_participants(user_id, thread_id);
CREATE INDEX chat_messages_thread_created_idx ON public.chat_messages(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.is_chat_participant(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE thread_id = _thread_id AND user_id = _user_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Participants view threads" ON public.chat_threads FOR SELECT TO authenticated
USING (public.is_chat_participant(id, auth.uid()));
CREATE POLICY "Participants update threads" ON public.chat_threads FOR UPDATE TO authenticated
USING (public.is_chat_participant(id, auth.uid())) WITH CHECK (public.is_chat_participant(id, auth.uid()));

CREATE POLICY "Participants view memberships" ON public.chat_participants FOR SELECT TO authenticated
USING (public.is_chat_participant(thread_id, auth.uid()));
CREATE POLICY "Participants update own read state" ON public.chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Participants read messages" ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_chat_participant(thread_id, auth.uid()));
CREATE POLICY "Participants send own messages" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(thread_id, auth.uid()));
CREATE POLICY "Senders edit own messages" ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(thread_id, auth.uid()));
CREATE POLICY "Senders delete own messages" ON public.chat_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.open_direct_chat(_target_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _key text;
  _thread uuid;
  _me_staff boolean;
  _target_staff boolean;
  _me_resident uuid;
  _target_resident uuid;
  _allowed boolean := false;
BEGIN
  IF _me IS NULL OR _target_user IS NULL OR _me = _target_user THEN
    RAISE EXCEPTION 'Choose another person.';
  END IF;

  _me_staff := public.is_staff(_me);
  _target_staff := public.is_staff(_target_user);
  SELECT id INTO _me_resident FROM public.residents WHERE user_id = _me LIMIT 1;
  SELECT id INTO _target_resident FROM public.residents WHERE user_id = _target_user LIMIT 1;

  IF _me_staff AND _target_staff THEN
    _allowed := true;
  ELSIF _me_staff AND _target_resident IS NOT NULL THEN
    _allowed := true;
  ELSIF _me_resident IS NOT NULL AND _target_staff THEN
    SELECT EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = _me_resident
        AND (_target_user = r.contact_user_id OR _target_user = r.handler_user_id OR public.is_leadership(_target_user))
    ) INTO _allowed;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'You cannot start a conversation with this person.';
  END IF;

  _key := CASE WHEN _me::text < _target_user::text
    THEN _me::text || ':' || _target_user::text
    ELSE _target_user::text || ':' || _me::text END;

  INSERT INTO public.chat_threads(direct_key, created_by)
  VALUES (_key, _me)
  ON CONFLICT (direct_key) DO UPDATE SET updated_at = public.chat_threads.updated_at
  RETURNING id INTO _thread;

  INSERT INTO public.chat_participants(thread_id, user_id)
  VALUES (_thread, _me), (_thread, _target_user)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  RETURN _thread;
END;
$$;
REVOKE ALL ON FUNCTION public.open_direct_chat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_direct_chat(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_chat_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_chat_thread() FROM PUBLIC;
CREATE TRIGGER chat_message_touch_thread
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_thread();

CREATE TABLE public.communication_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_kind text NOT NULL CHECK (entity_kind IN ('brief', 'announcement')),
  entity_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_kind, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_reads TO authenticated;
GRANT ALL ON public.communication_reads TO service_role;
ALTER TABLE public.communication_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People manage own communication reads" ON public.communication_reads FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX communication_reads_user_kind_idx ON public.communication_reads(user_id, entity_kind);

ALTER TABLE public.briefs
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE POLICY "Staff read briefs" ON public.briefs FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff read published announcements" ON public.announcements FOR SELECT TO authenticated
USING (published = true AND public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_communication_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF TG_TABLE_NAME = 'announcements' AND NEW.published = true AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER briefs_set_author BEFORE INSERT ON public.briefs
FOR EACH ROW EXECUTE FUNCTION public.set_communication_author();
CREATE TRIGGER announcements_set_author BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_communication_author();