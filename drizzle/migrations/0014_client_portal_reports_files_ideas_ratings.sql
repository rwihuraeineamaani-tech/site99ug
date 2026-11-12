
-- helpers
CREATE OR REPLACE FUNCTION public.is_my_resident(_resident uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _resident IS NOT NULL AND (
    EXISTS (SELECT 1 FROM resident_users WHERE user_id = auth.uid() AND resident_id = _resident)
    OR EXISTS (SELECT 1 FROM residents WHERE id = _resident AND user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.notify_client(_resident uuid, _type text, _title text, _body text, _path text, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT user_id FROM resident_users WHERE resident_id = _resident AND user_id IS NOT NULL
           UNION SELECT user_id FROM residents WHERE id = _resident AND user_id IS NOT NULL LOOP
    PERFORM public.staff_notify(u, 'approvals', _type, _title, _body, _path, _key || ':' || u::text, false);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.notify_resident_handler(_resident uuid, _type text, _title text, _body text, _path text, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h uuid;
BEGIN
  SELECT coalesce(handler_user_id, contact_user_id) INTO h FROM residents WHERE id = _resident;
  IF h IS NOT NULL THEN PERFORM public.staff_notify(h, 'tasks', _type, _title, _body, _path, _key); END IF;
END $$;

-- 1. reports
CREATE TABLE public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  month date NOT NULL,
  summary text,
  file_path text,
  file_name text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resident_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_reports TO authenticated;
GRANT ALL ON public.client_reports TO service_role;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage reports" ON public.client_reports FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Clients read published reports" ON public.client_reports FOR SELECT TO authenticated
  USING (published AND public.is_my_resident(resident_id));

CREATE OR REPLACE FUNCTION public.client_report_publish_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.published AND (TG_OP = 'INSERT' OR NOT OLD.published) THEN
    NEW.published_at := now();
    PERFORM public.notify_client(NEW.resident_id, 'client_report', 'Your monthly report is ready',
      'Your ' || to_char(NEW.month, 'FMMonth YYYY') || ' results report is ready to read.', '/portal/reports', 'report:' || NEW.id::text);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER client_report_publish_trg BEFORE INSERT OR UPDATE ON public.client_reports
  FOR EACH ROW EXECUTE FUNCTION public.client_report_publish_notify();

-- 2. client files
CREATE TABLE public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  label text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  uploaded_by_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_files TO authenticated;
GRANT ALL ON public.client_files TO service_role;
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage client files" ON public.client_files FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Clients read own files" ON public.client_files FOR SELECT TO authenticated
  USING (public.is_my_resident(resident_id));
CREATE POLICY "Clients add own files" ON public.client_files FOR INSERT TO authenticated
  WITH CHECK (public.is_my_resident(resident_id) AND uploaded_by = auth.uid() AND uploaded_by_client);
CREATE POLICY "Clients delete their uploads" ON public.client_files FOR DELETE TO authenticated
  USING (public.is_my_resident(resident_id) AND uploaded_by = auth.uid());

CREATE OR REPLACE FUNCTION public.client_file_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n text;
BEGIN
  IF NEW.uploaded_by_client THEN
    SELECT name INTO n FROM residents WHERE id = NEW.resident_id;
    PERFORM public.notify_resident_handler(NEW.resident_id, 'client_file', n || ' uploaded a file',
      NEW.label || ' (' || NEW.category || ')', '/app/residents/' || NEW.resident_id::text, 'cfile:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER client_file_notify_trg AFTER INSERT ON public.client_files
  FOR EACH ROW EXECUTE FUNCTION public.client_file_notify();

-- storage: resident-files bucket, folders <resident_id>/reports and <resident_id>/files
CREATE POLICY "Staff manage resident-files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'resident-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'resident-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Clients read own client files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resident-files' AND (storage.foldername(name))[2] IN ('files','reports')
         AND public.is_my_resident(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Clients upload own client files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resident-files' AND (storage.foldername(name))[2] = 'files'
         AND public.is_my_resident(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Clients delete own client uploads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resident-files' AND (storage.foldername(name))[2] = 'files' AND owner = auth.uid()
         AND public.is_my_resident(((storage.foldername(name))[1])::uuid));

-- 3. client ideas
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'team';
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS client_idea_month date;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS declined_note text;

CREATE OR REPLACE FUNCTION public.client_suggest_idea(_title text, _description text, _ref text, _month date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid := public.my_resident_id(auth.uid()); _id uuid; n text;
BEGIN
  IF r IS NULL THEN RAISE EXCEPTION 'Only clients can suggest ideas here'; END IF;
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'Give the idea a title'; END IF;
  PERFORM set_config('app.shoot_sync','on',true);
  INSERT INTO content_items(title, notes, link, stage, resident_id, source, client_idea_month, created_by, added_by, content_type)
  VALUES (left(trim(_title),200), _description, nullif(trim(_ref),''), 'Idea', r, 'client', _month, auth.uid(), auth.uid(), 'Video')
  RETURNING id INTO _id;
  SELECT name INTO n FROM residents WHERE id = r;
  PERFORM public.notify_resident_handler(r, 'client_idea', n || ' suggested a video idea', _title, '/app/content', 'cidea:' || _id::text);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.client_suggest_idea(text,text,text,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.client_suggest_idea(text,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_client_ideas()
RETURNS TABLE(id uuid, title text, notes text, link text, stage text, client_idea_month date, declined_note text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, notes, link, stage, client_idea_month, declined_note, created_at FROM content_items
  WHERE source = 'client' AND resident_id = public.my_resident_id(auth.uid()) ORDER BY created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.my_client_ideas() TO authenticated;

-- 4. shoot ratings
CREATE TABLE public.shoot_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL UNIQUE REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  overall smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  crew smallint CHECK (crew BETWEEN 1 AND 5),
  timekeeping smallint CHECK (timekeeping BETWEEN 1 AND 5),
  comment text,
  rated_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.shoot_ratings TO authenticated;
GRANT ALL ON public.shoot_ratings TO service_role;
ALTER TABLE public.shoot_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read ratings" ON public.shoot_ratings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Clients read own ratings" ON public.shoot_ratings FOR SELECT TO authenticated USING (public.is_my_resident(resident_id));
CREATE POLICY "Clients rate own finished shoots" ON public.shoot_ratings FOR INSERT TO authenticated
  WITH CHECK (rated_by = auth.uid() AND public.is_my_resident(resident_id)
    AND EXISTS (SELECT 1 FROM shoot_days d WHERE d.id = shoot_day_id AND d.resident_id = shoot_ratings.resident_id AND d.status = 'done'));

CREATE OR REPLACE FUNCTION public.shoot_rating_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n text;
BEGIN
  SELECT name INTO n FROM residents WHERE id = NEW.resident_id;
  PERFORM public.notify_resident_handler(NEW.resident_id, 'shoot_rating', n || ' rated a shoot ' || NEW.overall || '/5',
    coalesce(NEW.comment, 'No comment'), '/app/shoots/' || NEW.shoot_day_id::text, 'srate:' || NEW.id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER shoot_rating_notify_trg AFTER INSERT ON public.shoot_ratings FOR EACH ROW EXECUTE FUNCTION public.shoot_rating_notify();

-- monthly numbers
CREATE OR REPLACE FUNCTION public.client_month_metrics(_resident uuid, _month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month')::date; out jsonb;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.is_my_resident(_resident)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT jsonb_build_object(
    'posted', (SELECT count(*) FROM content_items WHERE resident_id = _resident AND posted_at >= s AND posted_at < e),
    'posted_on_time', (SELECT count(*) FROM content_items WHERE resident_id = _resident AND posted_at >= s AND posted_at < e
                       AND (post_window_end IS NULL OR posted_at <= post_window_end + interval '1 hour')),
    'shoots', (SELECT count(*) FROM shoot_days WHERE resident_id = _resident AND status = 'done' AND shoot_date >= s AND shoot_date < e),
    'ideas', (SELECT count(*) FROM content_items WHERE resident_id = _resident AND created_at >= s AND created_at < e),
    'followers', (SELECT max(m.followers) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id
                  WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'reach', (SELECT coalesce(sum(m.reach),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'impressions', (SELECT coalesce(sum(m.impressions),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'profile_visits', (SELECT coalesce(sum(m.profile_visits),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'link_clicks', (SELECT coalesce(sum(m.link_clicks),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'weeks', (SELECT coalesce(jsonb_agg(jsonb_build_object('week', w.week_start, 'reach', w.reach, 'followers', w.followers) ORDER BY w.week_start), '[]'::jsonb)
              FROM (SELECT m.week_start, sum(m.reach) reach, max(m.followers) followers FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id
                    WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e GROUP BY m.week_start) w)
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.client_month_metrics(uuid, date) TO authenticated;

-- 5. client alerts
CREATE OR REPLACE FUNCTION public.content_client_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.resident_id IS NOT NULL AND NEW.stage = 'Review' AND OLD.stage IS DISTINCT FROM 'Review'
     AND EXISTS (SELECT 1 FROM residents WHERE id = NEW.resident_id AND client_approves_content) THEN
    PERFORM public.notify_client(NEW.resident_id, 'client_approval', 'A video needs your approval',
      NEW.title || ' is ready for you to watch and approve.', '/portal/calendar', 'capprove:' || NEW.id::text || ':' || now()::date::text);
  END IF;
  IF NEW.source = 'client' AND NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage IN ('Archived','Posted') THEN
    PERFORM public.notify_client(NEW.resident_id, 'client_idea', 'Update on your idea',
      NEW.title || CASE WHEN NEW.stage = 'Posted' THEN ' has been posted.' ELSE ' was not taken forward.' END, '/portal/ideas', 'cideaupd:' || NEW.id::text || NEW.stage);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER content_client_alert_trg AFTER UPDATE OF stage ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.content_client_alert();

CREATE OR REPLACE FUNCTION public.invoice_client_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.resident_id IS NOT NULL AND NEW.direction = 'out' AND NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    PERFORM public.notify_client(NEW.resident_id, 'client_invoice', 'New invoice ' || coalesce(NEW.number,''),
      'An invoice for UGX ' || to_char(coalesce(NEW.total_ugx,0), 'FM999,999,999') || ' is in your portal.', '/portal/money', 'cinv:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_client_alert_trg AFTER INSERT OR UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.invoice_client_alert();

CREATE OR REPLACE FUNCTION public.shoot_client_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.resident_id IS NOT NULL AND NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL THEN
    PERFORM public.notify_client(NEW.resident_id, 'client_shoot', 'Shoot day confirmed',
      'Your shoot on ' || to_char(NEW.shoot_date, 'FMDay DD Mon') || coalesce(' at ' || NEW.call_time, '') || ' is confirmed.', '/portal/shoots/' || NEW.id::text, 'cshoot:' || NEW.id::text || NEW.shoot_date::text);
  END IF;
  IF NEW.resident_id IS NOT NULL AND NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    PERFORM public.notify_client(NEW.resident_id, 'client_shoot_rate', 'How did the shoot go?',
      'Rate your shoot so we can keep getting better.', '/portal/shoots/' || NEW.id::text, 'crate:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shoot_client_alert_trg AFTER UPDATE ON public.shoot_days FOR EACH ROW EXECUTE FUNCTION public.shoot_client_alert();
