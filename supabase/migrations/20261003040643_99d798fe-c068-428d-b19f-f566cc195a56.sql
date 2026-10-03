CREATE OR REPLACE FUNCTION public.can_act_approval_task(_task approval_tasks, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select _task.status = 'pending' and (
    _task.assigned_user_id = _user_id
    or (_task.assigned_role is not null and public.has_role(_user_id, _task.assigned_role))
    or exists (select 1 from public.approval_delegations d
      where d.delegate_id = _user_id and d.delegator_id = _task.assigned_user_id
        and d.active and now() between d.starts_at and d.ends_at)
    or public.is_system_admin(_user_id)
    or public.is_founder(_user_id)
  )
$function$;

CREATE OR REPLACE FUNCTION public.decide_approval_task(_task_id uuid, _decision text, _note text DEFAULT NULL::text, _evidence_url text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  t public.approval_tasks; i public.approval_instances; v public.approval_workflow_versions;
  next_node jsonb; next_id text; assignee uuid; role_text text; sla_hours integer;
  override boolean := public.is_founder(auth.uid());
begin
  if _decision not in ('approved','rejected','changes_requested') then raise exception 'Invalid decision'; end if;
  select * into t from public.approval_tasks where id=_task_id for update;
  if not found or not public.can_act_approval_task(t,auth.uid()) then raise exception 'This approval is not assigned to you'; end if;
  select * into i from public.approval_instances where id=t.instance_id for update;
  if not override and t.exclude_requester and i.requester_id=auth.uid() then raise exception 'You cannot approve your own request'; end if;
  if not override and t.require_distinct_actor and exists(select 1 from public.approval_decisions d where d.instance_id=i.id and d.actor_id=auth.uid() and d.decision='approved') then raise exception 'A different person must complete this approval'; end if;
  update public.approval_tasks set status=_decision,acted_by=auth.uid(),acted_at=now() where id=t.id;
  insert into public.approval_decisions(instance_id,task_id,actor_id,decision,note,evidence_url) values(i.id,t.id,auth.uid(),_decision,nullif(trim(coalesce(_note,'')),''),nullif(trim(coalesce(_evidence_url,'')),''));
  if _decision in ('rejected','changes_requested') then
    update public.approval_instances set status=_decision,completed_at=now(),current_node_ids='{}' where id=i.id;
  else
    select * into v from public.approval_workflow_versions where id=i.workflow_version_id;
    select e->>'target' into next_id from jsonb_array_elements(v.edges) e where e->>'source'=t.node_id and coalesce(e->>'route','approved')='approved' order by e->>'id' limit 1;
    select n into next_node from jsonb_array_elements(v.nodes) n where n->>'id'=next_id;
    if next_node is null or next_node->>'kind'='end' then
      update public.approval_instances set status='approved',completed_at=now(),current_node_ids='{}' where id=i.id;
    else
      assignee := nullif(next_node->'config'->>'user_id','')::uuid;
      role_text := nullif(next_node->'config'->>'role','');
      sla_hours := coalesce(nullif(next_node->'config'->>'sla_hours','')::integer,24);
      update public.approval_instances set current_node_ids=array[next_id] where id=i.id;
      insert into public.approval_tasks(instance_id,node_id,node_label,assigned_user_id,assigned_role,due_at,reminder_at,exclude_requester,require_distinct_actor)
      values(i.id,next_id,coalesce(next_node->>'label','Approval'),assignee,case when role_text is null then null else role_text::public.app_role end,now()+make_interval(hours=>sla_hours),now()+make_interval(hours=>greatest(1,sla_hours-4)),coalesce((next_node->'config'->>'exclude_requester')::boolean,true),coalesce((next_node->'config'->>'distinct_actor')::boolean,false));
    end if;
  end if;
  insert into public.approval_audit(workflow_id,instance_id,actor_id,event_type,summary,detail) values(i.workflow_id,i.id,auth.uid(),_decision,case when override then 'Approval decision recorded (Founder override)' else 'Approval decision recorded' end,jsonb_build_object('task_id',t.id,'note',_note,'override',override));
end
$function$;

CREATE OR REPLACE FUNCTION public.approve_cash_request(_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st text;
BEGIN
  SELECT status INTO st FROM public.cash_requests WHERE id = _id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'That request no longer exists.' USING ERRCODE = '22004'; END IF;
  IF st = 'submitted' THEN
    IF NOT public.has_any_role(uid, ARRAY['admin','managing_director']::app_role[]) AND NOT public.is_founder(uid) THEN
      RAISE EXCEPTION 'Only the Managing Director can give the first approval.' USING ERRCODE = '42501';
    END IF;
    IF public.is_founder(uid) THEN
      UPDATE public.cash_requests SET status='approved', md_approved_by=uid, md_approved_at=now(), founder_approved_by=uid, founder_approved_at=now() WHERE id=_id;
      RETURN 'approved';
    END IF;
    UPDATE public.cash_requests SET status='md_approved', md_approved_by=uid, md_approved_at=now() WHERE id=_id;
    RETURN 'md_approved';
  ELSIF st = 'md_approved' THEN
    IF NOT public.is_founder(uid) THEN
      RAISE EXCEPTION 'Only a founder can give the final approval.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.cash_requests SET status='approved', founder_approved_by=uid, founder_approved_at=now() WHERE id=_id;
    RETURN 'approved';
  END IF;
  RAISE EXCEPTION 'This request is not waiting for approval.' USING ERRCODE = '22004';
END;
$function$;

ALTER TABLE public.resident_contracts
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS legal_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_verified_by uuid;
ALTER TABLE public.resident_contracts DROP CONSTRAINT IF EXISTS resident_contracts_vat_mode_chk;
ALTER TABLE public.resident_contracts ADD CONSTRAINT resident_contracts_vat_mode_chk CHECK (vat_mode IN ('unknown','inclusive','exclusive','exempt'));