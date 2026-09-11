create or replace function public.workflow_domain_submit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workflow_key text;
  entity_kind text;
  title_text text;
  detail_text text;
  amount_value numeric;
  context_value jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'cash_requests' and new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    workflow_key := 'finance_cash_request'; entity_kind := 'cash_request'; title_text := new.purpose; amount_value := new.amount_ugx;
  elsif tg_table_name = 'loans' and new.status = 'pending_approval' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    workflow_key := 'finance_loan'; entity_kind := 'loan'; title_text := new.counterparty_name; detail_text := new.purpose; amount_value := new.principal_ugx;
  elsif tg_table_name = 'content_items' and new.stage in ('Idea','Review') and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    workflow_key := 'content_signoff'; entity_kind := 'content_item'; title_text := new.title; context_value := jsonb_build_object('submitted_stage',new.stage);
  elsif tg_table_name in ('client_goals','client_targets','strategy_maps','client_plans','strategy_map_versions') and new.review_state = 'submitted' and (tg_op = 'INSERT' or old.review_state is distinct from new.review_state) then
    workflow_key := 'strategy_review'; entity_kind := tg_table_name; title_text := coalesce(to_jsonb(new)->>'title', initcap(replace(tg_table_name,'_',' '))); context_value := jsonb_build_object('table',tg_table_name);
  elsif tg_table_name in ('contracts','resident_contracts') and new.status = 'out for signature' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    workflow_key := 'contract_approval'; entity_kind := tg_table_name; title_text := coalesce(to_jsonb(new)->>'title', to_jsonb(new)->>'contract_type', 'Contract'); context_value := jsonb_build_object('table',tg_table_name);
  else
    return new;
  end if;
  if not exists(select 1 from public.approval_instances where entity_type=entity_kind and entity_id=new.id) then
    perform public.start_approval(workflow_key,entity_kind,new.id,title_text,detail_text,amount_value,context_value);
  end if;
  return new;
end
$$;
revoke all on function public.workflow_domain_submit() from public, anon;
grant execute on function public.workflow_domain_submit() to authenticated, service_role;

create trigger cash_requests_workflow_submit after insert or update of status on public.cash_requests for each row execute function public.workflow_domain_submit();
create trigger loans_workflow_submit after insert or update of status on public.loans for each row execute function public.workflow_domain_submit();
create trigger content_workflow_submit after insert or update of stage on public.content_items for each row execute function public.workflow_domain_submit();
create trigger client_goals_workflow_submit after insert or update of review_state on public.client_goals for each row execute function public.workflow_domain_submit();
create trigger client_targets_workflow_submit after insert or update of review_state on public.client_targets for each row execute function public.workflow_domain_submit();
create trigger strategy_maps_workflow_submit after insert or update of review_state on public.strategy_maps for each row execute function public.workflow_domain_submit();
create trigger client_plans_workflow_submit after insert or update of review_state on public.client_plans for each row execute function public.workflow_domain_submit();
create trigger strategy_versions_workflow_submit after insert or update of review_state on public.strategy_map_versions for each row execute function public.workflow_domain_submit();
create trigger contracts_workflow_submit after insert or update of status on public.contracts for each row execute function public.workflow_domain_submit();
create trigger resident_contracts_workflow_submit after insert or update of status on public.resident_contracts for each row execute function public.workflow_domain_submit();

create or replace function public.workflow_domain_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status or new.status not in ('approved','rejected','changes_requested') then return new; end if;
  if new.entity_type = 'cash_request' then
    update public.cash_requests set status = case when new.status='approved' then 'approved' else 'declined' end where id=new.entity_id;
  elsif new.entity_type = 'loan' then
    update public.loans set status = case when new.status='approved' then 'active' else 'cancelled' end where id=new.entity_id;
  elsif new.entity_type = 'content_item' then
    update public.content_items set stage = case when new.status='approved' then case when context->>'submitted_stage'='Review' then 'Handover' else 'Approved' end else 'Rejected' end where id=new.entity_id;
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
  elsif new.entity_type = 'resident_contracts' then
    update public.resident_contracts set status=case when new.status='approved' then 'out for signature' else 'draft' end where id=new.entity_id;
  end if;
  return new;
end
$$;
revoke all on function public.workflow_domain_sync() from public, anon;
grant execute on function public.workflow_domain_sync() to authenticated, service_role;
create trigger approval_instance_domain_sync after update of status on public.approval_instances for each row execute function public.workflow_domain_sync();