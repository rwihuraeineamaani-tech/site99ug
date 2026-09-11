alter table public.residents
  add column if not exists legal_name text,
  add column if not exists primary_email text,
  add column if not exists primary_phone text,
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists tin text,
  add column if not exists source text,
  add column if not exists category text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists sales_owner_id uuid,
  add column if not exists onboarding_status text not null default 'complete',
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarded_at timestamptz;

create index if not exists residents_sales_owner_idx on public.residents(sales_owner_id);
create index if not exists residents_lifecycle_idx on public.residents(lifecycle_status);

create table public.resident_contacts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  name text not null,
  role_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  receives_billing boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.resident_contacts to authenticated;
grant all on public.resident_contacts to service_role;
alter table public.resident_contacts enable row level security;
create policy "Staff view resident contacts" on public.resident_contacts for select to authenticated using (public.is_staff(auth.uid()));
create policy "Sales and leadership manage resident contacts" on public.resident_contacts for all to authenticated using (public.has_any_role(auth.uid(), array['admin','founder','managing_director','sales_head']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['admin','founder','managing_director','sales_head']::public.app_role[]));
create index resident_contacts_resident_idx on public.resident_contacts(resident_id);
create unique index resident_contacts_one_primary_idx on public.resident_contacts(resident_id) where is_primary;
create trigger resident_contacts_updated before update on public.resident_contacts for each row execute function public.set_updated_at();

create table public.resident_users (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  user_id uuid unique,
  email text not null unique,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.resident_users to authenticated;
grant all on public.resident_users to service_role;
alter table public.resident_users enable row level security;
create policy "System admins manage resident portal users" on public.resident_users for all to authenticated using (public.is_system_admin(auth.uid())) with check (public.is_system_admin(auth.uid()));
create policy "Residents view own portal link" on public.resident_users for select to authenticated using (user_id=auth.uid());
create index resident_users_resident_idx on public.resident_users(resident_id);
create trigger resident_users_updated before update on public.resident_users for each row execute function public.set_updated_at();

create or replace function public.my_resident_id(_user_id uuid default auth.uid()) returns uuid language sql stable security definer set search_path=public as $$ select coalesce((select resident_id from public.resident_users where user_id=_user_id limit 1),(select id from public.residents where user_id=_user_id limit 1)) $$;
revoke all on function public.my_resident_id(uuid) from public, anon;
grant execute on function public.my_resident_id(uuid) to authenticated, service_role;

create or replace function public.accept_resident_portal_invite() returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  update public.resident_users set user_id=auth.uid(),accepted_at=coalesce(accepted_at,now()),updated_at=now() where lower(email)=lower(coalesce(auth.jwt()->>'email','')) and (user_id is null or user_id=auth.uid()) returning resident_id into rid;
  if rid is not null then insert into public.user_roles(user_id,role) values(auth.uid(),'client') on conflict do nothing; end if;
  return rid;
end $$;
revoke all on function public.accept_resident_portal_invite() from public, anon;
grant execute on function public.accept_resident_portal_invite() to authenticated, service_role;

create table public.resident_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  step_key text not null,
  title text not null,
  department text not null,
  owner_user_id uuid,
  status text not null default 'pending' check(status in ('pending','in_progress','blocked','complete','not_needed')),
  due_on date,
  note text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(resident_id,step_key)
);
grant select, insert, update, delete on public.resident_onboarding_steps to authenticated;
grant all on public.resident_onboarding_steps to service_role;
alter table public.resident_onboarding_steps enable row level security;
create policy "Staff view resident onboarding" on public.resident_onboarding_steps for select to authenticated using (public.is_staff(auth.uid()));
create policy "Specialists manage resident onboarding" on public.resident_onboarding_steps for all to authenticated using (public.is_staff(auth.uid()) and (owner_user_id=auth.uid() or public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]))) with check (public.is_staff(auth.uid()));
create index resident_onboarding_resident_idx on public.resident_onboarding_steps(resident_id,status);
create trigger resident_onboarding_steps_updated before update on public.resident_onboarding_steps for each row execute function public.set_updated_at();

create table public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents(id) on delete set null,
  journey text not null default 'new_client' check(journey in ('new_client','existing_growth','partnership')),
  organisation_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text,
  service text,
  stage text not null default 'new_lead' check(stage in ('new_lead','contacted','qualified','discovery','proposal','negotiation','won','lost')),
  status text not null default 'open' check(status in ('open','won','lost')),
  owner_user_id uuid not null default auth.uid(),
  value_ugx numeric not null default 0 check(value_ugx>=0),
  probability integer not null default 10 check(probability between 0 and 100),
  expected_close date,
  next_action text not null,
  next_action_at timestamptz not null,
  notes text,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  converted_resident_id uuid references public.residents(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sales_opportunities to authenticated;
grant all on public.sales_opportunities to service_role;
alter table public.sales_opportunities enable row level security;
create policy "Sales team view opportunities" on public.sales_opportunities for select to authenticated using (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or owner_user_id=auth.uid());
create policy "Sales team create opportunities" on public.sales_opportunities for insert to authenticated with check (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create policy "Sales team update opportunities" on public.sales_opportunities for update to authenticated using (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create policy "Leadership delete opportunities" on public.sales_opportunities for delete to authenticated using (public.has_any_role(auth.uid(),array['admin','founder','managing_director']::public.app_role[]));
create index sales_opportunities_stage_idx on public.sales_opportunities(stage,next_action_at);
create index sales_opportunities_owner_idx on public.sales_opportunities(owner_user_id,status);
create index sales_opportunities_resident_idx on public.sales_opportunities(resident_id);
create trigger sales_opportunities_updated before update on public.sales_opportunities for each row execute function public.set_updated_at();

create table public.sales_assignments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  user_id uuid not null,
  assignment_role text not null default 'collaborator',
  assigned_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(opportunity_id,user_id)
);
grant select, insert, update, delete on public.sales_assignments to authenticated;
grant all on public.sales_assignments to service_role;
alter table public.sales_assignments enable row level security;
create policy "People view sales assignments" on public.sales_assignments for select to authenticated using (user_id=auth.uid() or public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create policy "Sales leads manage assignments" on public.sales_assignments for all to authenticated using (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create index sales_assignments_user_idx on public.sales_assignments(user_id);
drop policy "Sales team view opportunities" on public.sales_opportunities;
create policy "Sales team view opportunities" on public.sales_opportunities for select to authenticated using (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or owner_user_id=auth.uid() or exists(select 1 from public.sales_assignments a where a.opportunity_id=sales_opportunities.id and a.user_id=auth.uid()));

create table public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  kind text not null,
  summary text not null,
  detail text,
  actor_id uuid not null default auth.uid(),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.sales_activities to authenticated;
grant all on public.sales_activities to service_role;
alter table public.sales_activities enable row level security;
create policy "Sales participants view activity" on public.sales_activities for select to authenticated using (exists(select 1 from public.sales_opportunities o where o.id=opportunity_id and (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or o.owner_user_id=auth.uid() or exists(select 1 from public.sales_assignments a where a.opportunity_id=o.id and a.user_id=auth.uid()))));
create policy "Sales participants add activity" on public.sales_activities for insert to authenticated with check (actor_id=auth.uid() and exists(select 1 from public.sales_opportunities o where o.id=opportunity_id and (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or o.owner_user_id=auth.uid() or exists(select 1 from public.sales_assignments a where a.opportunity_id=o.id and a.user_id=auth.uid()))));
create index sales_activities_opportunity_idx on public.sales_activities(opportunity_id,occurred_at desc);

create table public.sales_followups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  assigned_user_id uuid not null,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open' check(status in ('open','done','cancelled')),
  calendar_item_id uuid references public.calendar_items(id) on delete set null,
  completed_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sales_followups to authenticated;
grant all on public.sales_followups to service_role;
alter table public.sales_followups enable row level security;
create policy "People view assigned followups" on public.sales_followups for select to authenticated using (assigned_user_id=auth.uid() or public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create policy "Sales team manages followups" on public.sales_followups for all to authenticated using (assigned_user_id=auth.uid() or public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check (public.is_staff(auth.uid()));
create index sales_followups_due_idx on public.sales_followups(assigned_user_id,status,due_at);
create trigger sales_followups_updated before update on public.sales_followups for each row execute function public.set_updated_at();

create table public.sales_packages (
 id uuid primary key default gen_random_uuid(), name text not null, description text, service text, price_ugx numeric not null default 0, vat_rate numeric not null default .18, active boolean not null default true, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.sales_packages to authenticated;
grant all on public.sales_packages to service_role;
alter table public.sales_packages enable row level security;
create policy "Staff view sales packages" on public.sales_packages for select to authenticated using(public.is_staff(auth.uid()));
create policy "Sales manages packages" on public.sales_packages for all to authenticated using(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create trigger sales_packages_updated before update on public.sales_packages for each row execute function public.set_updated_at();

create table public.sales_offers (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade, kind text not null check(kind in ('quote','estimate','proposal','rate_card')), title text not null, version integer not null default 1, status text not null default 'draft' check(status in ('draft','submitted','approved','changes_requested','issued','accepted','declined','expired')), subtotal_ugx numeric not null default 0, discount_ugx numeric not null default 0, vat_rate numeric not null default .18, vat_ugx numeric not null default 0, total_ugx numeric not null default 0, valid_until date, terms text, notes text, approval_instance_id uuid references public.approval_instances(id) on delete set null, issued_at timestamptz, accepted_at timestamptz, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(opportunity_id,kind,version)
);
grant select,insert,update,delete on public.sales_offers to authenticated;
grant all on public.sales_offers to service_role;
alter table public.sales_offers enable row level security;
create policy "Sales participants view offers" on public.sales_offers for select to authenticated using(exists(select 1 from public.sales_opportunities o where o.id=opportunity_id and (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or o.owner_user_id=auth.uid() or exists(select 1 from public.sales_assignments a where a.opportunity_id=o.id and a.user_id=auth.uid()))));
create policy "Sales manages offers" on public.sales_offers for all to authenticated using(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create index sales_offers_opportunity_idx on public.sales_offers(opportunity_id,status);
create trigger sales_offers_updated before update on public.sales_offers for each row execute function public.set_updated_at();

create table public.sales_offer_lines (
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.sales_offers(id) on delete cascade, description text not null, quantity numeric not null default 1, unit_price_ugx numeric not null default 0, amount_ugx numeric not null default 0, sort integer not null default 0, created_at timestamptz not null default now()
);
grant select,insert,update,delete on public.sales_offer_lines to authenticated;
grant all on public.sales_offer_lines to service_role;
alter table public.sales_offer_lines enable row level security;
create policy "Sales participants view offer lines" on public.sales_offer_lines for select to authenticated using(exists(select 1 from public.sales_offers f join public.sales_opportunities o on o.id=f.opportunity_id where f.id=offer_id and (public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or o.owner_user_id=auth.uid() or exists(select 1 from public.sales_assignments a where a.opportunity_id=o.id and a.user_id=auth.uid()))));
create policy "Sales manages offer lines" on public.sales_offer_lines for all to authenticated using(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create index sales_offer_lines_offer_idx on public.sales_offer_lines(offer_id,sort);

create table public.sales_targets (
 id uuid primary key default gen_random_uuid(), month date not null, owner_user_id uuid, target_ugx numeric not null default 0, target_wins integer not null default 0, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(month,owner_user_id)
);
grant select,insert,update,delete on public.sales_targets to authenticated;
grant all on public.sales_targets to service_role;
alter table public.sales_targets enable row level security;
create policy "Sales team view targets" on public.sales_targets for select to authenticated using(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) or owner_user_id=auth.uid());
create policy "Leadership manages sales targets" on public.sales_targets for all to authenticated using(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[])) with check(public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]));
create trigger sales_targets_updated before update on public.sales_targets for each row execute function public.set_updated_at();

create or replace function public.sales_move_opportunity(_id uuid,_stage text,_reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare o public.sales_opportunities; old_stage text;
begin
 if not public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) then raise exception 'Sales access required'; end if;
 if _stage not in ('new_lead','contacted','qualified','discovery','proposal','negotiation','won','lost') then raise exception 'Invalid stage'; end if;
 select * into o from public.sales_opportunities where id=_id for update; if not found then raise exception 'Opportunity not found'; end if;
 old_stage:=o.stage;
 if _stage='won' and not exists(select 1 from public.sales_offers where opportunity_id=_id and status in ('approved','issued','accepted')) then raise exception 'An approved offer is required before winning this opportunity'; end if;
 update public.sales_opportunities set stage=_stage,status=case when _stage='won' then 'won' when _stage='lost' then 'lost' else 'open' end,lost_reason=case when _stage='lost' then nullif(_reason,'') else null end,won_at=case when _stage='won' then now() else won_at end,lost_at=case when _stage='lost' then now() else lost_at end where id=_id;
 insert into public.sales_activities(opportunity_id,kind,summary,detail,actor_id,metadata) values(_id,'stage_change','Moved from '||replace(old_stage,'_',' ')||' to '||replace(_stage,'_',' '),_reason,auth.uid(),jsonb_build_object('from',old_stage,'to',_stage));
end $$;
revoke all on function public.sales_move_opportunity(uuid,text,text) from public,anon;
grant execute on function public.sales_move_opportunity(uuid,text,text) to authenticated,service_role;

create or replace function public.sales_submit_offer(_offer_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare f public.sales_offers; o public.sales_opportunities; aid uuid;
begin
 select * into f from public.sales_offers where id=_offer_id for update; if not found then raise exception 'Offer not found'; end if;
 select * into o from public.sales_opportunities where id=f.opportunity_id;
 if not public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) then raise exception 'Sales access required'; end if;
 if f.status not in ('draft','changes_requested') then raise exception 'Only draft offers can be submitted'; end if;
 aid:=public.start_approval('sales-offer','sales_offer',f.id,f.title,o.organisation_name||' · '||f.kind,f.total_ugx,jsonb_build_object('opportunity_id',o.id,'offer_id',f.id));
 update public.sales_offers set status='submitted',approval_instance_id=aid where id=f.id;
 insert into public.sales_activities(opportunity_id,kind,summary,actor_id,metadata) values(o.id,'offer_submitted','Offer submitted for Founder approval',auth.uid(),jsonb_build_object('offer_id',f.id));
 return aid;
end $$;
revoke all on function public.sales_submit_offer(uuid) from public,anon;
grant execute on function public.sales_submit_offer(uuid) to authenticated,service_role;

create or replace function public.sales_onboard_resident(_opportunity_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare o public.sales_opportunities; rid uuid; duplicate_id uuid; step text; title_text text; dept text;
begin
 if not public.has_any_role(auth.uid(),array['admin','founder','managing_director','sales_head']::public.app_role[]) then raise exception 'Sales access required'; end if;
 select * into o from public.sales_opportunities where id=_opportunity_id for update; if not found then raise exception 'Opportunity not found'; end if;
 if o.status<>'won' then raise exception 'Win the opportunity before onboarding'; end if;
 if o.converted_resident_id is not null then return o.converted_resident_id; end if;
 if o.resident_id is not null then rid:=o.resident_id; else
  select id into duplicate_id from public.residents where lower(regexp_replace(name,'[^a-z0-9]+','','g'))=lower(regexp_replace(o.organisation_name,'[^a-z0-9]+','','g')) or (o.contact_email is not null and lower(coalesce(primary_email,email,''))=lower(o.contact_email)) limit 1;
  if duplicate_id is not null then raise exception 'Possible duplicate Resident already exists'; end if;
  insert into public.residents(name,legal_name,territory,since,status,primary_email,primary_phone,source,category,lifecycle_status,sales_owner_id,onboarding_status,onboarding_started_at) values(o.organisation_name,o.organisation_name,'Uganda',to_char(current_date,'YYYY'),'Onboarding',o.contact_email,o.contact_phone,o.source,o.service,'onboarding',o.owner_user_id,'in_progress',now()) returning id into rid;
 end if;
 update public.residents set onboarding_status='in_progress',onboarding_started_at=coalesce(onboarding_started_at,now()),sales_owner_id=coalesce(sales_owner_id,o.owner_user_id),primary_email=coalesce(primary_email,o.contact_email),primary_phone=coalesce(primary_phone,o.contact_phone) where id=rid;
 if o.contact_name is not null then insert into public.resident_contacts(resident_id,name,email,phone,is_primary,created_by) values(rid,o.contact_name,o.contact_email,o.contact_phone,true,auth.uid()) on conflict do nothing; end if;
 for step,title_text,dept in values ('contact','Confirm contacts','Sales'),('owners','Assign account owners','Management'),('offer','Approved offer','Sales'),('contract','Legal contract','Legal'),('invoice','Invoice or deposit','Finance'),('brand','Brand guidelines and assets','Creative'),('strategy','Strategy kickoff','Strategy'),('portal','Portal invitation','System admin'),('brief','First production brief','Content') loop
  insert into public.resident_onboarding_steps(resident_id,step_key,title,department,status,created_at,updated_at) values(rid,step,title_text,dept,case when step='offer' then 'complete' else 'pending' end,now(),now()) on conflict(resident_id,step_key) do nothing;
 end loop;
 update public.sales_opportunities set converted_resident_id=rid,resident_id=rid where id=o.id;
 insert into public.sales_activities(opportunity_id,kind,summary,actor_id,metadata) values(o.id,'resident_onboarded','Forwarded into Resident onboarding',auth.uid(),jsonb_build_object('resident_id',rid));
 return rid;
end $$;
revoke all on function public.sales_onboard_resident(uuid) from public,anon;
grant execute on function public.sales_onboard_resident(uuid) to authenticated,service_role;

create or replace function public.sales_offer_approval_sync() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.entity_type='sales_offer' and new.status is distinct from old.status then
  update public.sales_offers set status=case new.status when 'approved' then 'approved' when 'changes_requested' then 'changes_requested' when 'rejected' then 'declined' else status end where id=new.entity_id;
 end if;
 return new;
end $$;
revoke all on function public.sales_offer_approval_sync() from public,anon,authenticated;
grant execute on function public.sales_offer_approval_sync() to service_role;
create trigger sales_offer_approval_sync after update of status on public.approval_instances for each row execute function public.sales_offer_approval_sync();