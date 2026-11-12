
CREATE OR REPLACE FUNCTION public.users_with_roles(_roles public.app_role[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT user_id FROM public.user_roles WHERE role = ANY(_roles) $$;
REVOKE ALL ON FUNCTION public.users_with_roles(public.app_role[]) FROM public, anon, authenticated;

-- Month close
CREATE TABLE IF NOT EXISTS public.period_closes (
  month date PRIMARY KEY,
  finance_signed_by uuid, finance_signed_at timestamptz,
  founder_signed_by uuid, founder_signed_at timestamptz,
  locked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.period_closes TO authenticated;
GRANT ALL ON public.period_closes TO service_role;
ALTER TABLE public.period_closes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance reads month closes" ON public.period_closes FOR SELECT TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()));

CREATE OR REPLACE FUNCTION public.sign_period_close(_month date, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m date := date_trunc('month', _month)::date; open_count int;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT count(*) INTO open_count FROM public.cashbook_entries
   WHERE entry_date >= m AND entry_date < (m + interval '1 month') AND reconciled_at IS NULL;
  IF open_count > 0 THEN RAISE EXCEPTION '% entries in this month are not ticked against the statement yet', open_count; END IF;
  INSERT INTO public.period_closes(month, note) VALUES (m, _note) ON CONFLICT (month) DO NOTHING;
  IF public.is_founder(auth.uid()) THEN
    UPDATE public.period_closes SET founder_signed_by = auth.uid(), founder_signed_at = now() WHERE month = m;
  END IF;
  IF public.has_any_role(auth.uid(), ARRAY['finance_ops','admin']::public.app_role[]) OR NOT public.is_founder(auth.uid()) THEN
    UPDATE public.period_closes SET finance_signed_by = auth.uid(), finance_signed_at = now() WHERE month = m;
  END IF;
  UPDATE public.period_closes SET locked = (finance_signed_at IS NOT NULL AND founder_signed_at IS NOT NULL) WHERE month = m;
END $$;
GRANT EXECUTE ON FUNCTION public.sign_period_close(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_period(_month date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_founder(auth.uid()) THEN RAISE EXCEPTION 'Only a Co-founder can reopen a closed month'; END IF;
  UPDATE public.period_closes SET locked = false, finance_signed_at = NULL, finance_signed_by = NULL,
    founder_signed_at = NULL, founder_signed_by = NULL, note = 'Reopened: ' || COALESCE(_reason,'') WHERE month = date_trunc('month', _month)::date;
END $$;
GRANT EXECUTE ON FUNCTION public.reopen_period(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cashbook_period_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d date := CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_date ELSE NEW.entry_date END;
BEGIN
  IF EXISTS (SELECT 1 FROM public.period_closes WHERE locked AND month = date_trunc('month', d)::date)
     OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.period_closes WHERE locked AND month = date_trunc('month', OLD.entry_date)::date)) THEN
    RAISE EXCEPTION 'That month is closed. A Co-founder must reopen it first.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS cashbook_period_lock_trg ON public.cashbook_entries;
CREATE TRIGGER cashbook_period_lock_trg BEFORE INSERT OR UPDATE OR DELETE ON public.cashbook_entries
FOR EACH ROW EXECUTE FUNCTION public.cashbook_period_lock();

-- Weekly Friday pack
CREATE TABLE IF NOT EXISTS public.finance_weekly_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  approved_by uuid, sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.finance_weekly_packs TO authenticated;
GRANT ALL ON public.finance_weekly_packs TO service_role;
ALTER TABLE public.finance_weekly_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and leadership read weekly packs" ON public.finance_weekly_packs FOR SELECT TO authenticated
USING (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid()) OR public.is_md(auth.uid()));

CREATE OR REPLACE FUNCTION public.send_weekly_finance_pack(_week_start date, _metrics jsonb, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; u uuid; w date := _week_start;
BEGIN
  IF NOT (public.can_see_finance(auth.uid()) OR public.is_founder(auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.finance_weekly_packs(week_start, metrics, note, status, approved_by, sent_at)
  VALUES (w, COALESCE(_metrics,'{}'::jsonb), _note, 'sent', auth.uid(), now())
  ON CONFLICT (week_start) DO UPDATE SET metrics = EXCLUDED.metrics, note = EXCLUDED.note, status = 'sent', approved_by = auth.uid(), sent_at = now()
  RETURNING id INTO r;
  FOR u IN SELECT public.users_with_roles(ARRAY['founder','managing_director']::public.app_role[]) LOOP
    PERFORM public.queue_push(u, auth.uid(), 'finance', 'weekly_finance_pack', 'finance_weekly_pack', r,
      'Weekly finance report ready', 'Week of ' || to_char(w,'DD Mon') || ': money in, money out, balances and unpaid invoices.',
      '/app/finance/reports?week=' || w, 'weekly-pack-' || w || '-' || u || '-' || extract(epoch FROM now())::bigint);
  END LOOP;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.send_weekly_finance_pack(date, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_friday_reminder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid; w date := (date_trunc('week', (now() AT TIME ZONE 'Africa/Kampala')))::date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_weekly_packs WHERE week_start = w AND status = 'sent') THEN RETURN; END IF;
  FOR u IN SELECT public.users_with_roles(ARRAY['finance_ops']::public.app_role[]) LOOP
    PERFORM public.queue_push(u, NULL, 'finance', 'weekly_pack_due', 'finance_weekly_pack', NULL,
      'Friday finance report due', 'Check this week''s figures, approve them and send them to the Co-founders and MD.',
      '/app/finance/reports', 'weekly-pack-due-' || w || '-' || u);
  END LOOP;
END $$;

-- Production fund alerts
CREATE OR REPLACE FUNCTION public.production_fund_budget_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid;
BEGIN
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR OLD.estimate_ugx <> NEW.estimate_ugx) THEN
    FOR u IN SELECT public.users_with_roles(ARRAY['founder']::public.app_role[]) LOOP
      PERFORM public.queue_push(u, NEW.submitted_by, 'approvals', 'production_estimate', 'production_fund_budget', NEW.id,
        'Production fund estimate to approve', 'UGX ' || to_char(NEW.estimate_ugx,'FM999,999,999') || ' asked for ' || to_char(NEW.month,'FMMonth YYYY') || '. Set the limit.',
        '/app/finance/production-fund', 'pf-est-' || NEW.id || '-' || u || '-' || extract(epoch FROM now())::bigint);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NEW.status IN ('approved','declined') THEN
    PERFORM public.queue_push(NEW.submitted_by, NEW.decided_by, 'approvals', 'production_estimate_decided', 'production_fund_budget', NEW.id,
      CASE WHEN NEW.status = 'approved' THEN 'Production fund approved' ELSE 'Production fund estimate declined' END,
      CASE WHEN NEW.status = 'approved' THEN 'Limit UGX ' || to_char(NEW.approved_limit_ugx,'FM999,999,999') || ' for ' || to_char(NEW.month,'FMMonth YYYY') || '.' ELSE COALESCE(NEW.decision_note,'See the note on the page.') END,
      '/app/finance/production-fund', 'pf-dec-' || NEW.id || '-' || extract(epoch FROM now())::bigint);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS production_fund_budget_alert_trg ON public.production_fund_budgets;
CREATE TRIGGER production_fund_budget_alert_trg AFTER INSERT OR UPDATE ON public.production_fund_budgets
FOR EACH ROW EXECUTE FUNCTION public.production_fund_budget_alert();

CREATE OR REPLACE FUNCTION public.production_fund_request_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR u IN SELECT public.users_with_roles(ARRAY['finance_ops']::public.app_role[]) LOOP
      PERFORM public.queue_push(u, NEW.requested_by, 'finance', 'production_request', 'production_fund_request', NEW.id,
        'Production fund request', 'UGX ' || to_char(NEW.amount_ugx,'FM999,999,999') || ' for ' || NEW.purpose,
        '/app/finance/production-fund', 'pf-req-' || NEW.id || '-' || u);
    END LOOP;
  ELSIF NEW.status <> OLD.status THEN
    PERFORM public.queue_push(NEW.requested_by, COALESCE(NEW.transferred_by, auth.uid()), 'finance', 'production_request_done', 'production_fund_request', NEW.id,
      CASE WHEN NEW.status = 'transferred' THEN 'Money is in the production fund' ELSE 'Production fund request declined' END,
      'UGX ' || to_char(NEW.amount_ugx,'FM999,999,999') || ' for ' || NEW.purpose || COALESCE('. ' || NEW.decline_reason, ''),
      '/app/finance/production-fund', 'pf-req-done-' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS production_fund_request_alert_trg ON public.production_fund_requests;
CREATE TRIGGER production_fund_request_alert_trg AFTER INSERT OR UPDATE ON public.production_fund_requests
FOR EACH ROW EXECUTE FUNCTION public.production_fund_request_alert();
