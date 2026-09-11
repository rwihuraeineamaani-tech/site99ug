create or replace function public.is_system_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role(_user_id, 'admin'::public.app_role), false)
$$;
revoke all on function public.is_system_admin(uuid) from public, anon;
grant execute on function public.is_system_admin(uuid) to authenticated, service_role;

create table public.responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  work_key text not null unique,
  name text not null,
  description text,
  primary_user_id uuid,
  primary_role public.app_role,
  backup_user_ids uuid[] not null default '{}',
  backup_roles public.app_role[] not null default '{}',
  approval_authority boolean not null default false,
  active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.responsibility_assignments to authenticated;
grant all on public.responsibility_assignments to service_role;
alter table public.responsibility_assignments enable row level security;
create policy "Staff view responsibilities" on public.responsibility_assignments for select to authenticated using (public.is_staff(auth.uid()));
create policy "System admins manage responsibilities" on public.responsibility_assignments for all to authenticated using (public.is_system_admin(auth.uid())) with check (public.is_system_admin(auth.uid()));

create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null unique,
  name text not null,
  department text not null,
  description text,
  entity_type text not null,
  active boolean not null default true,
  current_version_id uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.approval_workflows to authenticated;
grant all on public.approval_workflows to service_role;
alter table public.approval_workflows enable row level security;
create policy "Staff view active workflows" on public.approval_workflows for select to authenticated using (public.is_staff(auth.uid()));
create policy "System admins manage workflows" on public.approval_workflows for all to authenticated using (public.is_system_admin(auth.uid())) with check (public.is_system_admin(auth.uid()));

create table public.approval_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  version integer not null,
  state text not null default 'draft' check (state in ('draft','published','retired')),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  notes text,
  validation jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workflow_id, version)
);
grant select, insert, update, delete on public.approval_workflow_versions to authenticated;
grant all on public.approval_workflow_versions to service_role;
alter table public.approval_workflow_versions enable row level security;
create policy "Staff view published workflow versions" on public.approval_workflow_versions for select to authenticated using (state = 'published' and public.is_staff(auth.uid()) or public.is_system_admin(auth.uid()));
create policy "System admins manage workflow versions" on public.approval_workflow_versions for all to authenticated using (public.is_system_admin(auth.uid())) with check (public.is_system_admin(auth.uid()));
alter table public.approval_workflows add constraint approval_workflows_current_version_fk foreign key (current_version_id) references public.approval_workflow_versions(id);

create table public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_id uuid not null,
  delegate_id uuid not null,
  department text,
  workflow_id uuid references public.approval_workflows(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.approval_delegations to authenticated;
grant all on public.approval_delegations to service_role;
alter table public.approval_delegations enable row level security;
create policy "People view relevant delegations" on public.approval_delegations for select to authenticated using (auth.uid() in (delegator_id, delegate_id) or public.is_system_admin(auth.uid()));
create policy "System admins manage delegations" on public.approval_delegations for all to authenticated using (public.is_system_admin(auth.uid())) with check (public.is_system_admin(auth.uid()));

create table public.approval_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id),
  workflow_version_id uuid not null references public.approval_workflow_versions(id),
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  detail text,
  amount numeric,
  context jsonb not null default '{}'::jsonb,
  requester_id uuid not null default auth.uid(),
  status text not null default 'active' check (status in ('active','approved','rejected','changes_requested','cancelled')),
  current_node_ids text[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id)
);
grant select on public.approval_instances to authenticated;
grant all on public.approval_instances to service_role;
alter table public.approval_instances enable row level security;

create table public.approval_tasks (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.approval_instances(id) on delete cascade,
  node_id text not null,
  node_label text not null,
  assigned_user_id uuid,
  assigned_role public.app_role,
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested','delegated','cancelled','expired')),
  due_at timestamptz,
  reminder_at timestamptz,
  exclude_requester boolean not null default true,
  require_distinct_actor boolean not null default false,
  acted_by uuid,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.approval_tasks to authenticated;
grant all on public.approval_tasks to service_role;
alter table public.approval_tasks enable row level security;

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.approval_instances(id) on delete cascade,
  task_id uuid not null references public.approval_tasks(id) on delete cascade,
  actor_id uuid not null default auth.uid(),
  decision text not null check (decision in ('approved','rejected','changes_requested','delegated','commented')),
  note text,
  evidence_url text,
  created_at timestamptz not null default now()
);
grant select on public.approval_decisions to authenticated;
grant all on public.approval_decisions to service_role;
alter table public.approval_decisions enable row level security;

create table public.approval_audit (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.approval_workflows(id),
  instance_id uuid references public.approval_instances(id),
  actor_id uuid,
  event_type text not null,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.approval_audit to authenticated;
grant all on public.approval_audit to service_role;
alter table public.approval_audit enable row level security;

create or replace function public.can_act_approval_task(_task public.approval_tasks, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _task.status = 'pending' and (
    _task.assigned_user_id = _user_id
    or (_task.assigned_role is not null and public.has_role(_user_id, _task.assigned_role))
    or exists (
      select 1 from public.approval_delegations d
      where d.delegate_id = _user_id and d.delegator_id = _task.assigned_user_id
        and d.active and now() between d.starts_at and d.ends_at
    )
    or public.is_system_admin(_user_id)
  )
$$;
revoke all on function public.can_act_approval_task(public.approval_tasks, uuid) from public, anon;
grant execute on function public.can_act_approval_task(public.approval_tasks, uuid) to authenticated, service_role;

create policy "People view relevant approval instances" on public.approval_instances for select to authenticated using (
  requester_id = auth.uid() or public.is_system_admin(auth.uid()) or exists (
    select 1 from public.approval_tasks t where t.instance_id = approval_instances.id and (
      t.assigned_user_id = auth.uid() or (t.assigned_role is not null and public.has_role(auth.uid(), t.assigned_role))
    )
  )
);
create policy "People view relevant approval tasks" on public.approval_tasks for select to authenticated using (
  public.can_act_approval_task(approval_tasks, auth.uid()) or public.is_system_admin(auth.uid()) or exists (
    select 1 from public.approval_instances i where i.id = approval_tasks.instance_id and i.requester_id = auth.uid()
  )
);
create policy "People view relevant approval decisions" on public.approval_decisions for select to authenticated using (
  public.is_system_admin(auth.uid()) or actor_id = auth.uid() or exists (
    select 1 from public.approval_instances i where i.id = approval_decisions.instance_id and i.requester_id = auth.uid()
  ) or exists (
    select 1 from public.approval_tasks t where t.instance_id = approval_decisions.instance_id and (
      t.assigned_user_id = auth.uid() or (t.assigned_role is not null and public.has_role(auth.uid(), t.assigned_role))
    )
  )
);
create policy "System admins view approval audit" on public.approval_audit for select to authenticated using (public.is_system_admin(auth.uid()));

create index approval_versions_workflow_idx on public.approval_workflow_versions(workflow_id, version desc);
create index approval_instances_status_idx on public.approval_instances(status, created_at desc);
create index approval_instances_entity_idx on public.approval_instances(entity_type, entity_id);
create index approval_tasks_pending_user_idx on public.approval_tasks(assigned_user_id, status, due_at);
create index approval_tasks_pending_role_idx on public.approval_tasks(assigned_role, status, due_at);
create index approval_audit_instance_idx on public.approval_audit(instance_id, created_at desc);

create trigger responsibility_assignments_updated before update on public.responsibility_assignments for each row execute function public.set_updated_at();
create trigger approval_workflows_updated before update on public.approval_workflows for each row execute function public.set_updated_at();
create trigger approval_workflow_versions_updated before update on public.approval_workflow_versions for each row execute function public.set_updated_at();
create trigger approval_delegations_updated before update on public.approval_delegations for each row execute function public.set_updated_at();
create trigger approval_instances_updated before update on public.approval_instances for each row execute function public.set_updated_at();
create trigger approval_tasks_updated before update on public.approval_tasks for each row execute function public.set_updated_at();

create or replace function public.publish_approval_workflow(_workflow_id uuid, _version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.approval_workflow_versions;
  has_start boolean;
  has_end boolean;
begin
  if not public.is_system_admin(auth.uid()) then raise exception 'System admin only'; end if;
  select * into v from public.approval_workflow_versions where id = _version_id and workflow_id = _workflow_id for update;
  if not found then raise exception 'Workflow version not found'; end if;
  select exists(select 1 from jsonb_array_elements(v.nodes) n where n->>'kind' = 'start') into has_start;
  select exists(select 1 from jsonb_array_elements(v.nodes) n where n->>'kind' = 'end') into has_end;
  if not has_start or not has_end then raise exception 'A workflow needs a Start and End step'; end if;
  if jsonb_array_length(v.edges) = 0 then raise exception 'Connect the workflow steps before publishing'; end if;
  update public.approval_workflow_versions set state = 'retired' where workflow_id = _workflow_id and state = 'published';
  update public.approval_workflow_versions set state = 'published', published_by = auth.uid(), published_at = now(), validation = jsonb_build_object('valid',true,'checked_at',now()) where id = _version_id;
  update public.approval_workflows set current_version_id = _version_id, active = true where id = _workflow_id;
  insert into public.approval_audit(workflow_id, actor_id, event_type, summary, detail) values (_workflow_id, auth.uid(), 'workflow_published', 'Workflow version published', jsonb_build_object('version',v.version));
end
$$;
revoke all on function public.publish_approval_workflow(uuid, uuid) from public, anon;
grant execute on function public.publish_approval_workflow(uuid, uuid) to authenticated, service_role;

create or replace function public.start_approval(
  _workflow_key text, _entity_type text, _entity_id uuid, _title text,
  _detail text default null, _amount numeric default null, _context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.approval_workflows;
  v public.approval_workflow_versions;
  start_id text;
  first_node jsonb;
  instance_id uuid;
  assignee uuid;
  role_text text;
  sla_hours integer;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into w from public.approval_workflows where workflow_key = _workflow_key and active and current_version_id is not null;
  if not found then raise exception 'No published workflow for %', _workflow_key; end if;
  select * into v from public.approval_workflow_versions where id = w.current_version_id and state = 'published';
  select n->>'id' into start_id from jsonb_array_elements(v.nodes) n where n->>'kind' = 'start' limit 1;
  select n into first_node from jsonb_array_elements(v.nodes) n
    where n->>'id' = (select e->>'target' from jsonb_array_elements(v.edges) e where e->>'source' = start_id order by e->>'id' limit 1);
  if first_node is null then raise exception 'Published workflow has no first step'; end if;
  insert into public.approval_instances(workflow_id, workflow_version_id, entity_type, entity_id, title, detail, amount, context, requester_id, current_node_ids)
  values(w.id, v.id, _entity_type, _entity_id, _title, _detail, _amount, coalesce(_context,'{}'::jsonb), auth.uid(), array[first_node->>'id']) returning id into instance_id;
  assignee := nullif(first_node->'config'->>'user_id','')::uuid;
  role_text := nullif(first_node->'config'->>'role','');
  sla_hours := coalesce(nullif(first_node->'config'->>'sla_hours','')::integer, 24);
  insert into public.approval_tasks(instance_id,node_id,node_label,assigned_user_id,assigned_role,due_at,reminder_at,exclude_requester,require_distinct_actor)
  values(instance_id,first_node->>'id',coalesce(first_node->>'label','Approval'),assignee,case when role_text is null then null else role_text::public.app_role end,now()+make_interval(hours=>sla_hours),now()+make_interval(hours=>greatest(1,sla_hours-4)),coalesce((first_node->'config'->>'exclude_requester')::boolean,true),coalesce((first_node->'config'->>'distinct_actor')::boolean,false));
  insert into public.approval_audit(workflow_id,instance_id,actor_id,event_type,summary) values(w.id,instance_id,auth.uid(),'submitted','Approval submitted');
  return instance_id;
end
$$;
revoke all on function public.start_approval(text,text,uuid,text,text,numeric,jsonb) from public, anon;
grant execute on function public.start_approval(text,text,uuid,text,text,numeric,jsonb) to authenticated, service_role;

create or replace function public.decide_approval_task(_task_id uuid, _decision text, _note text default null, _evidence_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.approval_tasks;
  i public.approval_instances;
  v public.approval_workflow_versions;
  next_node jsonb;
  next_id text;
  assignee uuid;
  role_text text;
  sla_hours integer;
begin
  if _decision not in ('approved','rejected','changes_requested') then raise exception 'Invalid decision'; end if;
  select * into t from public.approval_tasks where id=_task_id for update;
  if not found or not public.can_act_approval_task(t,auth.uid()) then raise exception 'This approval is not assigned to you'; end if;
  select * into i from public.approval_instances where id=t.instance_id for update;
  if t.exclude_requester and i.requester_id=auth.uid() then raise exception 'You cannot approve your own request'; end if;
  if t.require_distinct_actor and exists(select 1 from public.approval_decisions d where d.instance_id=i.id and d.actor_id=auth.uid() and d.decision='approved') then raise exception 'A different person must complete this approval'; end if;
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
  insert into public.approval_audit(workflow_id,instance_id,actor_id,event_type,summary,detail) values(i.workflow_id,i.id,auth.uid(),_decision,'Approval decision recorded',jsonb_build_object('task_id',t.id,'note',_note));
end
$$;
revoke all on function public.decide_approval_task(uuid,text,text,text) from public, anon;
grant execute on function public.decide_approval_task(uuid,text,text,text) to authenticated, service_role;