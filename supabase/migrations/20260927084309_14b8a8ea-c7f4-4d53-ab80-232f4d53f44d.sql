
ALTER TABLE public.resident_contracts
  ADD COLUMN IF NOT EXISTS renewed_from_id uuid REFERENCES public.resident_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_due_on date GENERATED ALWAYS AS (ends_on - 14) STORED;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS resident_contract_id uuid REFERENCES public.resident_contracts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoices_resident_contract_idx ON public.invoices(resident_contract_id);

ALTER TABLE public.kpi_contract_bonuses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.kpi_contract_bonuses ADD CONSTRAINT kpi_contract_bonuses_status_check CHECK (status IN ('pending','confirmed'));

CREATE TABLE public.contract_lifecycle_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enforce_client_status boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.contract_lifecycle_settings TO authenticated;
GRANT ALL ON public.contract_lifecycle_settings TO service_role;
ALTER TABLE public.contract_lifecycle_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read lifecycle settings" ON public.contract_lifecycle_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Founders change lifecycle settings" ON public.contract_lifecycle_settings FOR UPDATE TO authenticated USING (public.is_founder(auth.uid()) OR public.is_system_admin(auth.uid())) WITH CHECK (public.is_founder(auth.uid()) OR public.is_system_admin(auth.uid()));
INSERT INTO public.contract_lifecycle_settings(id) VALUES (true) ON CONFLICT DO NOTHING;

-- money on a contract
CREATE OR REPLACE FUNCTION public.contract_money(_contract_id uuid)
RETURNS TABLE(value_ugx bigint, invoiced_ugx bigint, paid_ugx bigint, outstanding_ugx bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT coalesce(value_ugx,0)::bigint v FROM resident_contracts WHERE id = _contract_id),
  i AS (SELECT coalesce(sum(total_ugx) FILTER (WHERE status NOT IN ('draft','void')),0)::bigint inv,
               coalesce(sum(amount_paid_ugx) FILTER (WHERE status <> 'void'),0)::bigint paid
        FROM invoices WHERE resident_contract_id = _contract_id AND direction = 'out')
  SELECT c.v, i.inv, i.paid, greatest(greatest(c.v, i.inv) - i.paid, 0) FROM c, i
$$;

CREATE OR REPLACE FUNCTION public.contract_finance_summary(_resident_id uuid DEFAULT NULL)
RETURNS TABLE(contract_id uuid, resident_id uuid, title text, status text, starts_on date, ends_on date, renewal_due_on date,
              value_ugx bigint, invoiced_ugx bigint, paid_ugx bigint, outstanding_ugx bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.resident_id, c.title, c.status, c.starts_on, c.ends_on, c.renewal_due_on, m.value_ugx, m.invoiced_ugx, m.paid_ugx, m.outstanding_ugx
  FROM resident_contracts c CROSS JOIN LATERAL public.contract_money(c.id) m
  WHERE (_resident_id IS NULL OR c.resident_id = _resident_id)
    AND (public.can_see_finance(auth.uid()) OR public.is_leadership(auth.uid()) OR public.is_resident_handler(c.resident_id, auth.uid()))
  ORDER BY c.ends_on NULLS LAST
$$;
REVOKE EXECUTE ON FUNCTION public.contract_money(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contract_finance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_finance_summary(uuid) TO authenticated;

-- what a contract's status should be today
CREATE OR REPLACE FUNCTION public.contract_effective_status(_c public.resident_contracts)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Africa/Kampala')::date; has_renewal boolean; owed bigint;
BEGIN
  IF _c.status IN ('draft','cancelled','archived') THEN RETURN _c.status; END IF;
  SELECT EXISTS(SELECT 1 FROM resident_contracts r WHERE r.renewed_from_id = _c.id AND r.status NOT IN ('draft','cancelled')) INTO has_renewal;
  IF _c.starts_on IS NOT NULL AND today < _c.starts_on THEN RETURN 'signed'; END IF;
  IF _c.ends_on IS NULL OR today <= _c.ends_on THEN
    IF _c.ends_on IS NOT NULL AND today >= _c.ends_on - 14 AND NOT has_renewal THEN RETURN 'renewal_due'; END IF;
    RETURN 'active';
  END IF;
  IF has_renewal THEN RETURN 'renewed'; END IF;
  SELECT outstanding_ugx INTO owed FROM public.contract_money(_c.id);
  IF coalesce(owed,0) > 0 THEN RETURN 'ended_unpaid'; END IF;
  RETURN 'complete';
END $$;
REVOKE EXECUTE ON FUNCTION public.contract_effective_status(public.resident_contracts) FROM PUBLIC, anon;

-- apply to one resident: refresh contract statuses, bonuses, client status
CREATE OR REPLACE FUNCTION public.recompute_resident_lifecycle(_resident_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c resident_contracts; s text; r residents; enforce boolean; onboarded boolean; life text; label text;
  handler uuid; prev resident_contracts;
BEGIN
  PERFORM set_config('app.lifecycle_sync','on',true);
  FOR c IN SELECT * FROM resident_contracts WHERE resident_id = _resident_id LOOP
    s := public.contract_effective_status(c);
    IF s IS DISTINCT FROM c.status THEN
      UPDATE resident_contracts SET status = s, updated_at = now(),
        completed_at = CASE WHEN s = 'complete' THEN coalesce(completed_at, now()) ELSE completed_at END
      WHERE id = c.id;
    END IF;
  END LOOP;

  SELECT * INTO r FROM residents WHERE id = _resident_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  handler := coalesce(r.handler_user_id, r.contact_user_id);

  -- automatic KPI bonuses (awaiting management confirmation)
  IF handler IS NOT NULL THEN
    INSERT INTO kpi_contract_bonuses(resident_id,user_id,contract_id,kind,contract_value_ugx,percent,amount_ugx,month,confirmed_by,note,status)
    SELECT c2.resident_id, handler, c2.id, 'end', coalesce(c2.value_ugx,0), 10, round(coalesce(c2.value_ugx,0)*0.10),
           date_trunc('month', coalesce(c2.completed_at, now()) AT TIME ZONE 'Africa/Kampala')::date, NULL,
           'Automatic: contract completed and paid', 'pending'
    FROM resident_contracts c2
    WHERE c2.resident_id = _resident_id AND c2.status IN ('complete','renewed')
      AND NOT EXISTS (SELECT 1 FROM kpi_contract_bonuses b WHERE b.contract_id = c2.id AND b.kind = 'end');
    INSERT INTO kpi_contract_bonuses(resident_id,user_id,contract_id,kind,contract_value_ugx,percent,amount_ugx,month,confirmed_by,note,status)
    SELECT p.resident_id, handler, p.id, 'renewal', coalesce(p.value_ugx,0), 5, round(coalesce(p.value_ugx,0)*0.05),
           date_trunc('month', now() AT TIME ZONE 'Africa/Kampala')::date, NULL, 'Automatic: client renewed', 'pending'
    FROM resident_contracts p
    WHERE p.resident_id = _resident_id
      AND EXISTS (SELECT 1 FROM resident_contracts n WHERE n.renewed_from_id = p.id AND n.status IN ('signed','active','renewal_due','renewed','complete','ended_unpaid'))
      AND NOT EXISTS (SELECT 1 FROM kpi_contract_bonuses b WHERE b.contract_id = p.id AND b.kind = 'renewal');
  END IF;

  SELECT enforce_client_status INTO enforce FROM contract_lifecycle_settings WHERE id;
  IF NOT coalesce(enforce,false) AND NOT EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id) THEN
    RETURN r.lifecycle_status;
  END IF;

  onboarded := coalesce(r.onboarding_status,'') = 'complete'
    AND NOT EXISTS (SELECT 1 FROM resident_onboarding_steps WHERE resident_id = _resident_id AND status <> 'complete');

  IF EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id AND status = 'renewal_due') AND onboarded THEN life := 'renewal_due';
  ELSIF EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id AND status = 'active') AND onboarded THEN life := 'active';
  ELSIF EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id AND status IN ('signed','active','renewal_due','draft')) THEN life := 'onboarding';
  ELSIF EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id AND status = 'ended_unpaid') THEN life := 'ended_unpaid';
  ELSIF EXISTS (SELECT 1 FROM resident_contracts WHERE resident_id = _resident_id AND status IN ('complete','renewed')) THEN life := 'complete';
  ELSE life := 'onboarding';
  END IF;
  label := CASE life WHEN 'active' THEN 'Active' WHEN 'renewal_due' THEN 'Renewal due' WHEN 'complete' THEN 'Complete'
                     WHEN 'ended_unpaid' THEN 'Balance owed' ELSE 'Onboarding' END;
  IF r.lifecycle_status IS DISTINCT FROM life OR r.status IS DISTINCT FROM label THEN
    UPDATE residents SET lifecycle_status = life, status = label, updated_at = now() WHERE id = _resident_id;
  END IF;
  RETURN life;
END $$;
REVOKE EXECUTE ON FUNCTION public.recompute_resident_lifecycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_resident_lifecycle(uuid) TO authenticated;

-- preview of what would change if enforced
CREATE OR REPLACE FUNCTION public.preview_client_lifecycle()
RETURNS TABLE(resident_id uuid, name text, current_status text, new_status text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid())) THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY
  SELECT r.id, r.name::text, r.status::text,
    CASE WHEN x.best IS NULL THEN 'Onboarding'
         WHEN x.best IN ('active','renewal_due') AND NOT ob.ok THEN 'Onboarding'
         WHEN x.best = 'active' THEN 'Active' WHEN x.best = 'renewal_due' THEN 'Renewal due'
         WHEN x.best IN ('signed','draft') THEN 'Onboarding' WHEN x.best = 'ended_unpaid' THEN 'Balance owed'
         ELSE 'Complete' END,
    CASE WHEN x.best IS NULL THEN 'No contract on file'
         WHEN x.best IN ('active','renewal_due') AND NOT ob.ok THEN 'Onboarding not finished'
         ELSE 'Contract ' || replace(x.best,'_',' ') END
  FROM residents r
  CROSS JOIN LATERAL (SELECT coalesce(r.onboarding_status,'')='complete' AND NOT EXISTS (SELECT 1 FROM resident_onboarding_steps s WHERE s.resident_id=r.id AND s.status<>'complete') ok) ob
  LEFT JOIN LATERAL (
    SELECT e.st best FROM (SELECT public.contract_effective_status(c) st FROM resident_contracts c WHERE c.resident_id = r.id) e
    WHERE e.st NOT IN ('cancelled','archived')
    ORDER BY array_position(ARRAY['renewal_due','active','signed','draft','ended_unpaid','complete','renewed'], e.st) LIMIT 1
  ) x ON true
  ORDER BY r.name;
END $$;
REVOKE EXECUTE ON FUNCTION public.preview_client_lifecycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_client_lifecycle() TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_all_lifecycles()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; n int := 0;
BEGIN
  FOR rid IN SELECT id FROM residents LOOP PERFORM public.recompute_resident_lifecycle(rid); n := n + 1; END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.recompute_all_lifecycles() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_client_lifecycle_enforced(_on boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_founder(auth.uid()) OR public.is_system_admin(auth.uid())) THEN RAISE EXCEPTION 'Only Founders can switch this on.'; END IF;
  UPDATE contract_lifecycle_settings SET enforce_client_status = _on, updated_at = now(), updated_by = auth.uid() WHERE id;
  RETURN public.recompute_all_lifecycles();
END $$;
REVOKE EXECUTE ON FUNCTION public.set_client_lifecycle_enforced(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_client_lifecycle_enforced(boolean) TO authenticated;

-- triggers
CREATE OR REPLACE FUNCTION public.lifecycle_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF current_setting('app.lifecycle_sync', true) = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'invoices' THEN
    rid := coalesce((SELECT resident_id FROM resident_contracts WHERE id = coalesce(NEW.resident_contract_id, OLD.resident_contract_id)), coalesce(NEW.resident_id, OLD.resident_id));
  ELSIF TG_TABLE_NAME = 'residents' THEN
    rid := NEW.id;
  ELSE
    rid := coalesce(NEW.resident_id, OLD.resident_id);
  END IF;
  IF rid IS NOT NULL THEN PERFORM public.recompute_resident_lifecycle(rid); END IF;
  RETURN coalesce(NEW, OLD);
END $$;

CREATE TRIGGER resident_contracts_lifecycle AFTER INSERT OR UPDATE OR DELETE ON public.resident_contracts FOR EACH ROW EXECUTE FUNCTION public.lifecycle_trigger();
CREATE TRIGGER onboarding_steps_lifecycle AFTER INSERT OR UPDATE OF status OR DELETE ON public.resident_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.lifecycle_trigger();
CREATE TRIGGER invoices_lifecycle AFTER INSERT OR UPDATE OF status, amount_paid_ugx, total_ugx, resident_contract_id OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.lifecycle_trigger();
CREATE TRIGGER residents_onboarding_lifecycle AFTER UPDATE OF onboarding_status ON public.residents FOR EACH ROW EXECUTE FUNCTION public.lifecycle_trigger();

-- daily run + renewal alerts
CREATE OR REPLACE FUNCTION public.run_contract_lifecycle_daily()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; u uuid;
BEGIN
  PERFORM public.recompute_all_lifecycles();
  FOR c IN SELECT rc.id, rc.title, rc.ends_on, rc.resident_id, r.name, coalesce(r.handler_user_id, r.contact_user_id) handler
           FROM resident_contracts rc JOIN residents r ON r.id = rc.resident_id
           WHERE rc.status = 'renewal_due' AND rc.renewal_alerted_at IS NULL LOOP
    FOR u IN SELECT DISTINCT x FROM (
        SELECT c.handler x
        UNION SELECT user_id FROM user_roles WHERE role IN ('founder','sales_head')) q WHERE x IS NOT NULL LOOP
      INSERT INTO push_outbox(recipient_user_id, category, event_type, entity_type, entity_id, title, body, path, event_key)
      VALUES (u, 'tasks', 'contract_renewal_due', 'resident_contract', c.id,
              'Renewal due: ' || c.name,
              c.title || ' ends on ' || to_char(c.ends_on, 'DD Mon YYYY') || '. Start the renewal.',
              '/app/residents/' || c.resident_id, 'renewal:' || c.id || ':' || u)
      ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE resident_contracts SET renewal_alerted_at = now() WHERE id = c.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_contract_lifecycle_daily() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('contract-lifecycle-daily', '5 21 * * *', $$SELECT public.run_contract_lifecycle_daily()$$);
