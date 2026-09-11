CREATE TABLE public.leadership_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  instruction text NOT NULL CHECK (char_length(btrim(instruction)) BETWEEN 2 AND 5000),
  task_type text NOT NULL DEFAULT 'general' CHECK (task_type IN ('contract','sales','report','call','finance','content','strategy','operations','general')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','submitted','returned','accepted','cancelled')),
  assigned_by uuid NOT NULL,
  due_at timestamptz,
  private_notes text,
  entity_type text,
  entity_id uuid,
  work_path text,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  require_written_update boolean NOT NULL DEFAULT true,
  require_file_or_link boolean NOT NULL DEFAULT false,
  require_signoff boolean NOT NULL DEFAULT true,
  submitted_update text,
  clarification_request text,
  leader_feedback text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.leadership_tasks TO authenticated;
GRANT ALL ON public.leadership_tasks TO service_role;
ALTER TABLE public.leadership_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leadership_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.leadership_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.leadership_task_assignees TO authenticated;
GRANT ALL ON public.leadership_task_assignees TO service_role;
ALTER TABLE public.leadership_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leadership_task_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.leadership_tasks(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('file','link')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  url text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'file' AND storage_path IS NOT NULL AND url IS NULL) OR (kind = 'link' AND url IS NOT NULL AND storage_path IS NULL))
);
GRANT SELECT, INSERT, DELETE ON public.leadership_task_evidence TO authenticated;
GRANT ALL ON public.leadership_task_evidence TO service_role;
ALTER TABLE public.leadership_task_evidence ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leadership_task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.leadership_tasks(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_type text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leadership_task_activity TO authenticated;
GRANT ALL ON public.leadership_task_activity TO service_role;
ALTER TABLE public.leadership_task_activity ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_assign_leadership_work(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','founder','managing_director','creative_director','sales_head')
  )
$$;
REVOKE ALL ON FUNCTION public.can_assign_leadership_work(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_leadership_work(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_leadership_task(_task_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leadership_tasks t
    WHERE t.id = _task_id
      AND (t.assigned_by = _user_id OR public.is_system_admin(_user_id)
        OR EXISTS (SELECT 1 FROM public.leadership_task_assignees a WHERE a.task_id = t.id AND a.user_id = _user_id))
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_leadership_task(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_leadership_task(uuid,uuid) TO authenticated, service_role;

CREATE POLICY "Task participants view leadership tasks" ON public.leadership_tasks FOR SELECT TO authenticated
USING (assigned_by = auth.uid() OR public.is_system_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leadership_task_assignees a WHERE a.task_id = id AND a.user_id = auth.uid()));
CREATE POLICY "Leadership create assigned work" ON public.leadership_tasks FOR INSERT TO authenticated
WITH CHECK (assigned_by = auth.uid() AND public.can_assign_leadership_work(auth.uid()));
CREATE POLICY "Assigners update leadership tasks" ON public.leadership_tasks FOR UPDATE TO authenticated
USING (assigned_by = auth.uid() OR public.is_system_admin(auth.uid()))
WITH CHECK (assigned_by = auth.uid() OR public.is_system_admin(auth.uid()));

CREATE POLICY "Task participants view assignees" ON public.leadership_task_assignees FOR SELECT TO authenticated
USING (public.can_access_leadership_task(task_id, auth.uid()));
CREATE POLICY "Assigners add assignees" ON public.leadership_task_assignees FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.leadership_tasks t WHERE t.id = task_id AND (t.assigned_by = auth.uid() OR public.is_system_admin(auth.uid()))));
CREATE POLICY "Assigners remove assignees" ON public.leadership_task_assignees FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.leadership_tasks t WHERE t.id = task_id AND (t.assigned_by = auth.uid() OR public.is_system_admin(auth.uid()))));

CREATE POLICY "Task participants view evidence" ON public.leadership_task_evidence FOR SELECT TO authenticated
USING (public.can_access_leadership_task(task_id, auth.uid()));
CREATE POLICY "Assignees add evidence" ON public.leadership_task_evidence FOR INSERT TO authenticated
WITH CHECK (added_by = auth.uid() AND EXISTS (SELECT 1 FROM public.leadership_task_assignees a WHERE a.task_id = leadership_task_evidence.task_id AND a.user_id = auth.uid()));
CREATE POLICY "Evidence owners remove before acceptance" ON public.leadership_task_evidence FOR DELETE TO authenticated
USING (added_by = auth.uid() AND EXISTS (SELECT 1 FROM public.leadership_tasks t WHERE t.id = task_id AND t.status <> 'accepted'));
CREATE POLICY "Task participants view activity" ON public.leadership_task_activity FOR SELECT TO authenticated
USING (public.can_access_leadership_task(task_id, auth.uid()));

CREATE INDEX leadership_tasks_assigner_idx ON public.leadership_tasks(assigned_by, status, due_at);
CREATE INDEX leadership_task_assignees_user_idx ON public.leadership_task_assignees(user_id, task_id);
CREATE INDEX leadership_task_activity_task_idx ON public.leadership_task_activity(task_id, created_at DESC);
CREATE INDEX leadership_task_evidence_task_idx ON public.leadership_task_evidence(task_id, created_at);

CREATE OR REPLACE FUNCTION public.leadership_task_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.leadership_task_touch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leadership_task_touch() TO authenticated, service_role;
CREATE TRIGGER leadership_tasks_touch BEFORE UPDATE ON public.leadership_tasks FOR EACH ROW EXECUTE FUNCTION public.leadership_task_touch();

CREATE OR REPLACE FUNCTION public.create_leadership_task(
  _title text, _instruction text, _task_type text, _priority text, _due_at timestamptz,
  _private_notes text, _assignee_ids uuid[], _resident_id uuid DEFAULT NULL,
  _entity_type text DEFAULT NULL, _entity_id uuid DEFAULT NULL, _work_path text DEFAULT NULL,
  _require_written_update boolean DEFAULT true, _require_file_or_link boolean DEFAULT false, _require_signoff boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _task_id uuid; _assignee uuid;
BEGIN
  IF NOT public.can_assign_leadership_work(auth.uid()) THEN RAISE EXCEPTION 'Only leadership can assign work'; END IF;
  IF COALESCE(array_length(_assignee_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'Choose at least one assignee'; END IF;
  INSERT INTO public.leadership_tasks(title,instruction,task_type,priority,assigned_by,due_at,private_notes,resident_id,entity_type,entity_id,work_path,require_written_update,require_file_or_link,require_signoff)
  VALUES (btrim(_title),btrim(_instruction),_task_type,_priority,auth.uid(),_due_at,NULLIF(btrim(_private_notes),''),_resident_id,NULLIF(_entity_type,''),_entity_id,NULLIF(_work_path,''),COALESCE(_require_written_update,true),COALESCE(_require_file_or_link,false),COALESCE(_require_signoff,true)) RETURNING id INTO _task_id;
  FOREACH _assignee IN ARRAY _assignee_ids LOOP
    INSERT INTO public.leadership_task_assignees(task_id,user_id) VALUES (_task_id,_assignee) ON CONFLICT DO NOTHING;
    PERFORM public.queue_push(_assignee,auth.uid(),'tasks','leadership_task_assigned','leadership_task',_task_id,'New work assigned',btrim(_title),'/app/todo/'||_task_id::text,'leadership-task-assigned:'||_task_id::text||':'||_assignee::text);
  END LOOP;
  INSERT INTO public.leadership_task_activity(task_id,actor_user_id,event_type,detail) VALUES (_task_id,auth.uid(),'assigned','Work assigned');
  RETURN _task_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_leadership_task(text,text,text,text,timestamptz,text,uuid[],uuid,text,uuid,text,boolean,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_leadership_task(text,text,text,text,timestamptz,text,uuid[],uuid,text,uuid,text,boolean,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_leadership_task(_task_id uuid, _status text, _message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _task public.leadership_tasks; _event text; _recipient uuid;
BEGIN
  SELECT * INTO _task FROM public.leadership_tasks WHERE id = _task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF _status IN ('in_progress','submitted') THEN
    IF NOT EXISTS (SELECT 1 FROM public.leadership_task_assignees WHERE task_id=_task_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Only an assignee can update this work'; END IF;
    IF _status='submitted' AND _task.require_written_update AND length(btrim(COALESCE(_message,''))) < 2 THEN RAISE EXCEPTION 'A written update is required'; END IF;
    IF _status='submitted' AND _task.require_file_or_link AND NOT EXISTS (SELECT 1 FROM public.leadership_task_evidence WHERE task_id=_task_id) THEN RAISE EXCEPTION 'A file or link is required'; END IF;
    UPDATE public.leadership_tasks SET status=_status, submitted_update=CASE WHEN _status='submitted' THEN btrim(_message) ELSE submitted_update END, submitted_at=CASE WHEN _status='submitted' THEN now() ELSE submitted_at END, clarification_request=NULL WHERE id=_task_id;
    _event := _status;
    IF _status='submitted' THEN PERFORM public.queue_push(_task.assigned_by,auth.uid(),'tasks','leadership_task_submitted','leadership_task',_task_id,'Work submitted',_task.title,'/app/todo/'||_task_id::text,'leadership-task-submitted:'||_task_id::text||':'||extract(epoch from now())::bigint::text); END IF;
  ELSIF _status='clarification' THEN
    IF NOT EXISTS (SELECT 1 FROM public.leadership_task_assignees WHERE task_id=_task_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Only an assignee can request clarification'; END IF;
    IF length(btrim(COALESCE(_message,''))) < 2 THEN RAISE EXCEPTION 'Explain what needs clarification'; END IF;
    UPDATE public.leadership_tasks SET clarification_request=btrim(_message) WHERE id=_task_id;
    _event := 'clarification_requested';
    PERFORM public.queue_push(_task.assigned_by,auth.uid(),'tasks','leadership_task_clarification','leadership_task',_task_id,'Clarification requested',_task.title,'/app/todo/'||_task_id::text,'leadership-task-clarification:'||_task_id::text||':'||extract(epoch from now())::bigint::text);
  ELSE RAISE EXCEPTION 'Unsupported task update'; END IF;
  INSERT INTO public.leadership_task_activity(task_id,actor_user_id,event_type,detail) VALUES (_task_id,auth.uid(),_event,NULLIF(btrim(_message),''));
END; $$;
REVOKE ALL ON FUNCTION public.update_leadership_task(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_leadership_task(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_leadership_task(_task_id uuid, _decision text, _feedback text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _task public.leadership_tasks; _recipient uuid; _next text;
BEGIN
  SELECT * INTO _task FROM public.leadership_tasks WHERE id=_task_id;
  IF NOT FOUND OR (_task.assigned_by<>auth.uid() AND NOT public.is_system_admin(auth.uid())) THEN RAISE EXCEPTION 'Only the assigning leader can decide this work'; END IF;
  _next := CASE _decision WHEN 'accept' THEN 'accepted' WHEN 'return' THEN 'returned' WHEN 'cancel' THEN 'cancelled' ELSE NULL END;
  IF _next IS NULL THEN RAISE EXCEPTION 'Unsupported decision'; END IF;
  IF _next='returned' AND length(btrim(COALESCE(_feedback,'')))<2 THEN RAISE EXCEPTION 'Feedback is required when returning work'; END IF;
  UPDATE public.leadership_tasks SET status=_next, leader_feedback=NULLIF(btrim(_feedback),''), accepted_at=CASE WHEN _next='accepted' THEN now() ELSE NULL END, accepted_by=CASE WHEN _next='accepted' THEN auth.uid() ELSE NULL END, cancelled_at=CASE WHEN _next='cancelled' THEN now() ELSE NULL END WHERE id=_task_id;
  INSERT INTO public.leadership_task_activity(task_id,actor_user_id,event_type,detail) VALUES (_task_id,auth.uid(),_next,NULLIF(btrim(_feedback),''));
  FOR _recipient IN SELECT user_id FROM public.leadership_task_assignees WHERE task_id=_task_id LOOP
    PERFORM public.queue_push(_recipient,auth.uid(),'tasks','leadership_task_'||_next,'leadership_task',_task_id,CASE _next WHEN 'accepted' THEN 'Work accepted' WHEN 'returned' THEN 'Work returned' ELSE 'Work cancelled' END,_task.title,'/app/todo/'||_task_id::text,'leadership-task-'||_next||':'||_task_id::text||':'||_recipient::text||':'||extract(epoch from now())::bigint::text);
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.decide_leadership_task(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_leadership_task(uuid,text,text) TO authenticated;

CREATE POLICY "Task participants read evidence files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='task-evidence' AND public.can_access_leadership_task(((storage.foldername(name))[1])::uuid,auth.uid()));
CREATE POLICY "Assignees upload task evidence" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='task-evidence' AND EXISTS (SELECT 1 FROM public.leadership_task_assignees a WHERE a.task_id=((storage.foldername(name))[1])::uuid AND a.user_id=auth.uid()));
CREATE POLICY "Evidence owners update task files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='task-evidence' AND owner_id=auth.uid()::text AND public.can_access_leadership_task(((storage.foldername(name))[1])::uuid,auth.uid()));
CREATE POLICY "Evidence owners delete task files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='task-evidence' AND owner_id=auth.uid()::text AND public.can_access_leadership_task(((storage.foldername(name))[1])::uuid,auth.uid()));

CREATE OR REPLACE FUNCTION public.prepare_due_push_reminders(_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer := 0; _inserted integer := 0;
BEGIN
  INSERT INTO public.push_outbox(recipient_user_id, actor_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key, available_at)
  SELECT ci.owner_user_id,NULL,'tasks','calendar_reminder','calendar_item',ci.id,'Calendar reminder',left(ci.title||CASE WHEN ci.start_time IS NOT NULL THEN ' · '||to_char(ci.start_time,'HH24:MI') ELSE '' END,240),COALESCE(NULLIF(ci.work_path,''),'/app/calendar'),'calendar-reminder:'||ci.id::text||':'||ci.start_date::text,COALESCE(ci.reminder_at,((ci.start_date::text||' '||COALESCE(ci.start_time::text,'09:00'))::timestamp AT TIME ZONE ci.timezone)-make_interval(mins=>COALESCE(ci.reminder_minutes,0)))
  FROM public.calendar_items ci WHERE ci.reminder_minutes IS NOT NULL AND ci.reminder_dismissed_at IS NULL AND ci.freq='none' AND COALESCE(ci.reminder_at,((ci.start_date::text||' '||COALESCE(ci.start_time::text,'09:00'))::timestamp AT TIME ZONE ci.timezone)-make_interval(mins=>COALESCE(ci.reminder_minutes,0)))<=_now AND ((ci.start_date::text||' '||COALESCE(ci.start_time::text,'23:59'))::timestamp AT TIME ZONE ci.timezone)>=_now-interval '12 hours' ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS _count=ROW_COUNT;
  INSERT INTO public.push_outbox(recipient_user_id,actor_user_id,category,event_type,entity_type,entity_id,title,body,path,event_key,available_at)
  SELECT sf.assigned_user_id,NULL,'tasks','sales_followup','sales_followup',sf.id,'Sales follow-up due',left(sf.title,240),'/app/sales?tab=opportunities&opportunity='||sf.opportunity_id::text,'sales-followup:'||sf.id::text,sf.due_at FROM public.sales_followups sf WHERE sf.status='open' AND sf.due_at<=_now AND sf.due_at>=_now-interval '24 hours' ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS _inserted=ROW_COUNT; _count:=_count+_inserted;
  INSERT INTO public.push_outbox(recipient_user_id,actor_user_id,category,event_type,entity_type,entity_id,title,body,path,event_key,available_at)
  SELECT a.user_id,t.assigned_by,'tasks',CASE WHEN t.due_at<_now THEN 'leadership_task_overdue' ELSE 'leadership_task_due_soon' END,'leadership_task',t.id,CASE WHEN t.due_at<_now THEN 'Assigned work overdue' ELSE 'Assigned work due soon' END,left(t.title,240),'/app/todo/'||t.id::text,CASE WHEN t.due_at<_now THEN 'leadership-task-overdue:' ELSE 'leadership-task-due-soon:' END||t.id::text||':'||a.user_id::text,t.due_at
  FROM public.leadership_tasks t JOIN public.leadership_task_assignees a ON a.task_id=t.id WHERE t.status IN ('assigned','in_progress','returned') AND t.due_at IS NOT NULL AND t.due_at<=_now+interval '24 hours' AND t.due_at>=_now-interval '7 days' ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS _inserted=ROW_COUNT; _count:=_count+_inserted;
  RETURN _count;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_due_push_reminders(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_due_push_reminders(timestamptz) TO service_role;