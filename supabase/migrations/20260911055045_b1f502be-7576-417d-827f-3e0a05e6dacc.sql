create policy "Portal users view own resident" on public.residents for select to authenticated using(id=public.my_resident_id(auth.uid()));
drop policy if exists "Clients can view their own content" on public.content_items;
create policy "Portal users view own content" on public.content_items for select to authenticated using(resident_id is not null and resident_id=public.my_resident_id(auth.uid()));

create or replace function public.chat_people()
returns table(user_id uuid,display_name text,person_kind text,subtitle text)
language sql stable security definer set search_path=public as $$
 with me as (select auth.uid() uid,public.is_staff(auth.uid()) staff),
 my_resident as (select r.id,r.contact_user_id,r.handler_user_id from public.residents r,me where r.user_id=me.uid or r.id=public.my_resident_id(me.uid) limit 1),
 allowed as (
  select tm.user_id,coalesce(tm.display_name,tm.email) as display_name,'staff'::text as person_kind,coalesce(tm.title,'Site 99 team') as subtitle from public.team_members tm,me where tm.user_id<>me.uid and (me.staff or tm.user_id in(select contact_user_id from my_resident union select handler_user_id from my_resident) or public.is_leadership(tm.user_id))
  union all
  select ru.user_id,r.name as display_name,'client'::text as person_kind,coalesce(r.territory,'Resident') as subtitle from public.resident_users ru join public.residents r on r.id=ru.resident_id cross join me where me.staff and ru.user_id is not null and ru.user_id<>me.uid
 ) select distinct on(a.user_id) a.user_id,a.display_name,a.person_kind,a.subtitle from allowed a where a.user_id is not null order by a.user_id,a.person_kind desc
$$;
revoke all on function public.chat_people() from public,anon;
grant execute on function public.chat_people() to authenticated,service_role;

create or replace function public.open_direct_chat(_target_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare _me uuid:=auth.uid();_key text;_thread uuid;_me_staff boolean;_target_staff boolean;_me_resident uuid;_target_resident uuid;_allowed boolean:=false;
begin
 if _me is null or _target_user is null or _me=_target_user then raise exception 'Choose another person.'; end if;
 _me_staff:=public.is_staff(_me);_target_staff:=public.is_staff(_target_user);
 select public.my_resident_id(_me) into _me_resident;select public.my_resident_id(_target_user) into _target_resident;
 if _me_staff and (_target_staff or _target_resident is not null) then _allowed:=true;
 elsif _target_staff and _me_resident is not null then _allowed:=exists(select 1 from public.residents r where r.id=_me_resident and (_target_user in(r.contact_user_id,r.handler_user_id) or public.is_leadership(_target_user))); end if;
 if not _allowed then raise exception 'You cannot start a conversation with this person.'; end if;
 _key:=case when _me::text<_target_user::text then _me::text||':'||_target_user::text else _target_user::text||':'||_me::text end;
 insert into public.chat_threads(direct_key,created_by) values(_key,_me) on conflict(direct_key) do update set updated_at=public.chat_threads.updated_at returning id into _thread;
 insert into public.chat_participants(thread_id,user_id) values(_thread,_me),(_thread,_target_user) on conflict(thread_id,user_id) do nothing;
 return _thread;
end $$;
revoke all on function public.open_direct_chat(uuid) from public,anon;
grant execute on function public.open_direct_chat(uuid) to authenticated,service_role;

create or replace function public.raise_recurring_invoices() returns integer language plpgsql security definer set search_path=public as $$
declare r public.invoices%rowtype; made integer:=0; d date; child uuid;
begin
 if not(public.can_see_finance(auth.uid()) or public.is_leadership(auth.uid())) then return 0; end if;
 for r in select * from public.invoices where recurring and status<>'void' and recur_parent_id is null loop
  d:=make_date(extract(year from current_date)::int,extract(month from current_date)::int,coalesce(r.recur_day,1));
  continue when d>current_date or exists(select 1 from public.invoices c where c.recur_parent_id=r.id and c.issue_date=d);
  insert into public.invoices(direction,status,number,party_kind,party_name,resident_id,contract_id,issue_date,due_date,period_label,category,subtotal_ugx,vat_rate,vat_ugx,total_ugx,note,recurring,recur_parent_id,created_by)
  values(r.direction,'draft',case when r.direction='out' then public.next_invoice_number() else null end,r.party_kind,r.party_name,r.resident_id,r.contract_id,d,d+14,to_char(d,'Mon YYYY'),r.category,r.subtotal_ugx,r.vat_rate,r.vat_ugx,r.total_ugx,r.note,false,r.id,r.created_by) returning id into child;
  insert into public.invoice_lines(invoice_id,description,qty,unit_price_ugx,amount_ugx,sort) select child,description,qty,unit_price_ugx,amount_ugx,sort from public.invoice_lines where invoice_id=r.id;
  made:=made+1;
 end loop;return made;
end $$;
revoke all on function public.raise_recurring_invoices() from public,anon;
grant execute on function public.raise_recurring_invoices() to authenticated,service_role;

drop policy if exists "Clients can view their own record" on public.clients;
drop function if exists public.accept_client_invite();
drop function if exists public.my_client_id();
alter table public.content_items drop column client_id;
alter table public.contracts drop column client_id;
alter table public.invoices drop column client_id;
drop table public.client_users;
drop table public.clients;