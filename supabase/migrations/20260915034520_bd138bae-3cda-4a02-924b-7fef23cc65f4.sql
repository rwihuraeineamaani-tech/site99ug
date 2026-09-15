CREATE OR REPLACE FUNCTION public.workflow_domain_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  new_status text := n->>'status';
  old_status text := o->>'status';
  new_stage text := n->>'stage';
  old_stage text := o->>'stage';
  new_review text := n->>'review_state';
  old_review text := o->>'review_state';
  workflow_key text;
  entity_kind text;
  title_text text;
  detail_text text;
  amount_value numeric;
  context_value jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then return new; end if;

  if tg_table_name = 'cash_requests' and new_status = 'submitted' and (tg_op = 'INSERT' or old_status is distinct from new_status) then
    workflow_key := 'finance_cash_request'; entity_kind := 'cash_request';
    title_text := n->>'purpose'; amount_value := (n->>'amount_ugx')::numeric;
  elsif tg_table_name = 'loans' and new_status = 'pending_approval' and (tg_op = 'INSERT' or old_status is distinct from new_status) then
    workflow_key := 'finance_loan'; entity_kind := 'loan';
    title_text := n->>'counterparty_name'; detail_text := n->>'purpose'; amount_value := (n->>'principal_ugx')::numeric;
  elsif tg_table_name = 'content_items' and new_stage in ('Idea','Review') and (tg_op = 'INSERT' or old_stage is distinct from new_stage) then
    workflow_key := 'content_signoff'; entity_kind := 'content_item';
    title_text := n->>'title'; context_value := jsonb_build_object('submitted_stage', new_stage);
  elsif tg_table_name in ('client_goals','client_targets','strategy_maps','client_plans','strategy_map_versions')
        and new_review = 'submitted' and (tg_op = 'INSERT' or old_review is distinct from new_review) then
    workflow_key := 'strategy_review'; entity_kind := tg_table_name;
    title_text := coalesce(n->>'title', initcap(replace(tg_table_name,'_',' ')));
    context_value := jsonb_build_object('table', tg_table_name);
  elsif tg_table_name in ('contracts','resident_contracts') and new_status = 'out for signature'
        and (tg_op = 'INSERT' or old_status is distinct from new_status) then
    workflow_key := 'contract_approval'; entity_kind := tg_table_name;
    title_text := coalesce(n->>'title', n->>'contract_type', 'Contract');
    context_value := jsonb_build_object('table', tg_table_name);
  else
    return new;
  end if;

  if not exists (select 1 from public.approval_instances where entity_type = entity_kind and entity_id = new.id) then
    perform public.start_approval(workflow_key, entity_kind, new.id, title_text, detail_text, amount_value, context_value);
  end if;
  return new;
end
$$;

ALTER VIEW public.public_residents SET (security_invoker = false);
GRANT SELECT ON public.public_residents TO anon, authenticated;