-- Inbox: one place for briefs, announcements, client messages and person-to-person notes.

CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message','brief','announcement','client_message')),
  subject text NOT NULL,
  body text,
  author uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'person' CHECK (audience IN ('person','role','everyone')),
  target_user uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role app_role,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  link_path text,
  parent_id uuid REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages TO authenticated;
GRANT ALL ON public.inbox_messages TO service_role;

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read what is addressed to you"
ON public.inbox_messages FOR SELECT TO authenticated
USING (
  author = auth.uid()
  OR audience = 'everyone'
  OR (audience = 'person' AND target_user = auth.uid())
  OR (audience = 'role' AND target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
);

CREATE POLICY "Staff send their own"
ON public.inbox_messages FOR INSERT TO authenticated
WITH CHECK (author = auth.uid() AND public.is_staff(auth.uid()));

CREATE POLICY "Edit your own"
ON public.inbox_messages FOR UPDATE TO authenticated
USING (author = auth.uid()) WITH CHECK (author = auth.uid());

CREATE POLICY "Remove your own or leadership"
ON public.inbox_messages FOR DELETE TO authenticated
USING (author = auth.uid() OR public.is_leadership(auth.uid()));

CREATE INDEX inbox_messages_created_idx ON public.inbox_messages (created_at DESC);
CREATE INDEX inbox_messages_target_idx ON public.inbox_messages (target_user);
CREATE INDEX inbox_messages_parent_idx ON public.inbox_messages (parent_id);

CREATE TRIGGER inbox_messages_updated
BEFORE UPDATE ON public.inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Who has read what.
CREATE TABLE public.inbox_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.inbox_reads TO authenticated;
GRANT ALL ON public.inbox_reads TO service_role;

ALTER TABLE public.inbox_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Your own read marks"
ON public.inbox_reads FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Mark your own as read"
ON public.inbox_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Unmark your own"
ON public.inbox_reads FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Announcements become an inbox item for everyone.
CREATE OR REPLACE FUNCTION public.inbox_from_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published AND (TG_OP = 'INSERT' OR COALESCE(OLD.published, false) = false) THEN
    INSERT INTO public.inbox_messages (kind, subject, body, audience, link_path)
    VALUES ('announcement', NEW.title, NEW.body, 'everyone', '/app/ops/announcements');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER announcements_to_inbox
AFTER INSERT OR UPDATE OF published ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.inbox_from_announcement();

-- A sent shoot brief reaches the crew on that day.
CREATE OR REPLACE FUNCTION public.inbox_from_brief()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who uuid;
  label text;
BEGIN
  IF NEW.brief_sent_at IS NOT NULL AND OLD.brief_sent_at IS DISTINCT FROM NEW.brief_sent_at THEN
    SELECT COALESCE(r.name, 'Shoot day') INTO label FROM public.residents r WHERE r.id = NEW.resident_id;
    FOR who IN
      SELECT DISTINCT cc.user_id
      FROM public.shoot_day_items sdi
      JOIN public.content_crew cc ON cc.content_id = sdi.content_id
      WHERE sdi.shoot_day_id = NEW.id AND cc.user_id IS NOT NULL
      UNION
      SELECT NEW.created_by WHERE NEW.created_by IS NOT NULL
    LOOP
      INSERT INTO public.inbox_messages (kind, subject, body, audience, target_user, shoot_day_id, resident_id, link_path)
      VALUES (
        'brief',
        'Shoot brief · ' || COALESCE(label, 'shoot day'),
        COALESCE(NEW.notes, '') ||
          CASE WHEN NEW.shoot_date IS NOT NULL THEN E'\n' || to_char(NEW.shoot_date, 'DD Mon YYYY') ELSE '' END ||
          CASE WHEN NEW.call_time IS NOT NULL THEN ' · call ' || NEW.call_time ELSE '' END ||
          CASE WHEN NEW.location IS NOT NULL THEN ' · ' || NEW.location ELSE '' END,
        'person', who, NEW.id, NEW.resident_id, '/app/shoots'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shoot_brief_to_inbox
AFTER UPDATE OF brief_sent_at ON public.shoot_days
FOR EACH ROW EXECUTE FUNCTION public.inbox_from_brief();

-- A client message reaches that client's contact and handler.
CREATE OR REPLACE FUNCTION public.inbox_from_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who uuid;
  label text;
BEGIN
  IF NEW.sender_role = 'resident' THEN
    SELECT COALESCE(r.name, 'Client') INTO label FROM public.residents r WHERE r.id = NEW.resident_id;
    FOR who IN
      SELECT DISTINCT ca.user_id FROM public.client_assignments ca WHERE ca.resident_id = NEW.resident_id AND ca.user_id IS NOT NULL
    LOOP
      INSERT INTO public.inbox_messages (kind, subject, body, audience, target_user, resident_id, link_path)
      VALUES ('client_message', 'Message from ' || COALESCE(label, 'a client'), NEW.body, 'person', who,
              NEW.resident_id, '/app/residents/' || NEW.resident_id::text);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_message_to_inbox
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.inbox_from_client_message();