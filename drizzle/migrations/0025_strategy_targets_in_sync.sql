CREATE OR REPLACE FUNCTION public.strategy_terms_reopen()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD);
BEGIN
  IF OLD.review_state = 'approved' AND NEW.review_state = 'approved' AND (
       n->'target_value' IS DISTINCT FROM o->'target_value'
    OR n->'metric' IS DISTINCT FROM o->'metric'
    OR n->'month' IS DISTINCT FROM o->'month'
    OR n->'start_value' IS DISTINCT FROM o->'start_value'
    OR n->'due_on' IS DISTINCT FROM o->'due_on'
    OR n->'title' IS DISTINCT FROM o->'title') THEN
    NEW.review_state := 'draft';
    NEW.approved_at := NULL; NEW.approved_by := NULL;
    NEW.submitted_at := NULL; NEW.submitted_by := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS client_targets_a_reopen ON public.client_targets;
CREATE TRIGGER client_targets_a_reopen BEFORE UPDATE ON public.client_targets
  FOR EACH ROW EXECUTE FUNCTION public.strategy_terms_reopen();
DROP TRIGGER IF EXISTS client_goals_a_reopen ON public.client_goals;
CREATE TRIGGER client_goals_a_reopen BEFORE UPDATE ON public.client_goals
  FOR EACH ROW EXECUTE FUNCTION public.strategy_terms_reopen();

DROP POLICY IF EXISTS "Portal users view own goals" ON public.client_goals;
CREATE POLICY "Portal users view own goals" ON public.client_goals FOR SELECT TO authenticated
  USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()) AND review_state = 'approved');

CREATE OR REPLACE FUNCTION public.client_month_metrics(_resident uuid, _month date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s date := date_trunc('month', _month)::date; e date := (date_trunc('month', _month) + interval '1 month')::date; out jsonb;
  pv int; pp int; pa int; sh int; fo numeric; re numeric; nf int;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.is_my_resident(_resident)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT count(*) FILTER (WHERE content_type ~* '(video|reel|vlog)' OR content_type !~* '(photo|poster|carousel|still|graphic|image|slide)' OR content_type IS NULL),
         count(*) FILTER (WHERE content_type !~* '(video|reel|vlog)' AND content_type ~* '(photo|poster|carousel|still|graphic|image|slide)'),
         count(*)
    INTO pv, pp, pa
    FROM content_items WHERE resident_id = _resident AND posted_at >= s AND posted_at < e AND cancelled_at IS NULL;
  SELECT count(*) INTO sh FROM shoot_days WHERE resident_id = _resident AND status = 'done' AND shoot_date >= s AND shoot_date < e;
  SELECT coalesce(sum(m.reach),0), count(*) FILTER (WHERE m.filled_by IS NOT NULL) INTO re, nf
    FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id
    WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e;
  SELECT sum(l.followers) INTO fo FROM (
    SELECT DISTINCT ON (m.account_id) m.followers FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id
    WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e
    ORDER BY m.account_id, m.week_start DESC) l;
  SELECT jsonb_build_object(
    'posted', pa,
    'posted_videos', pv, 'posted_photos', pp,
    'posted_on_time', (SELECT count(*) FROM content_items WHERE resident_id = _resident AND posted_at >= s AND posted_at < e AND cancelled_at IS NULL
                       AND (post_window_end IS NULL OR posted_at <= post_window_end + interval '1 hour')),
    'shoots', sh,
    'numbers', nf,
    'ideas', (SELECT count(*) FROM content_items WHERE resident_id = _resident AND created_at >= s AND created_at < e),
    'followers', fo,
    'reach', re,
    'impressions', (SELECT coalesce(sum(m.impressions),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'profile_visits', (SELECT coalesce(sum(m.profile_visits),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'link_clicks', (SELECT coalesce(sum(m.link_clicks),0) FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e),
    'weeks', (SELECT coalesce(jsonb_agg(jsonb_build_object('week', w.week_start, 'reach', w.reach, 'followers', w.followers) ORDER BY w.week_start), '[]'::jsonb)
              FROM (SELECT m.week_start, sum(m.reach) reach, sum(m.followers) followers FROM account_metrics m JOIN client_accounts a ON a.id = m.account_id
                    WHERE a.resident_id = _resident AND m.week_start >= s AND m.week_start < e GROUP BY m.week_start) w),
    'targets', (SELECT coalesce(jsonb_agg(jsonb_build_object('metric', t.metric, 'target', t.target_value, 'notes', t.notes,
                  'actual', CASE t.metric WHEN 'posted' THEN pa WHEN 'posted_videos' THEN pv WHEN 'posted_photos' THEN pp
                    WHEN 'shoots' THEN sh WHEN 'followers' THEN fo WHEN 'reach' THEN re WHEN 'numbers' THEN nf ELSE NULL END) ORDER BY t.metric), '[]'::jsonb)
              FROM client_targets t WHERE t.resident_id = _resident AND t.month >= s AND t.month < e AND t.review_state = 'approved')
  ) INTO out;
  RETURN out;
END $function$;