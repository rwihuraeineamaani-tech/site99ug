create or replace function public.workflow_domain_sync() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = old.status or new.status not in ('approved','rejected','changes_requested') then return new; end if;
  if new.entity_type = 'cash_request' then
    update public.cash_requests set status = case when new.status='approved' then 'approved' else 'declined' end where id=new.entity_id;
  elsif new.entity_type = 'loan' then
    update public.loans set status = case when new.status='approved' then 'active' else 'cancelled' end where id=new.entity_id;
  elsif new.entity_type = 'content_item' then
    if public.content_approvals_enabled() then
      update public.content_items set stage = case when new.status='approved' then case when new.context->>'submitted_stage'='Review' then 'Handover' else 'Approved' end else 'Rejected' end where id=new.entity_id;
    end if;
  elsif new.entity_type = 'client_goals' then
    update public.client_goals set review_state=new.status, approved_at=case when new.status='approved' then now() else null end where id=new.entity_id;
  elsif new.entity_type = 'client_targets' then
    update public.client_targets set review_state=new.status, approved_at=case when new.status='approved' then now() else null end where id=new.entity_id;
  elsif new.entity_type = 'strategy_maps' then
    update public.strategy_maps set review_state=new.status, approved_at=case when new.status='approved' then now() else null end where id=new.entity_id;
  elsif new.entity_type = 'client_plans' then
    update public.client_plans set review_state=new.status, approved_at=case when new.status='approved' then now() else null end where id=new.entity_id;
  elsif new.entity_type = 'strategy_map_versions' then
    update public.strategy_map_versions set review_state=new.status, approved_at=case when new.status='approved' then now() else null end where id=new.entity_id;
  elsif new.entity_type = 'contracts' then
    update public.contracts set status=case when new.status='approved' then 'out for signature' else 'draft' end where id=new.entity_id;
  end if;
  return new;
end $$;

-- Content never opens approval steps while content sign-offs are off.
create or replace function public.skip_content_approval_instance() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.entity_type = 'content_item' and not public.content_approvals_enabled() then
    new.status := 'cancelled'; new.completed_at := now(); new.current_node_ids := '{}';
  end if;
  return new;
end $$;
drop trigger if exists skip_content_approval_instance on public.approval_instances;
create trigger skip_content_approval_instance before insert on public.approval_instances for each row execute function public.skip_content_approval_instance();

create or replace function public.skip_content_approval_task() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.approval_instances i where i.id=new.instance_id and i.entity_type='content_item' and i.status='cancelled') then
    new.status := 'cancelled';
  end if;
  return new;
end $$;
drop trigger if exists skip_content_approval_task on public.approval_tasks;
create trigger skip_content_approval_task before insert on public.approval_tasks for each row execute function public.skip_content_approval_task();