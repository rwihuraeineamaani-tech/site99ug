-- ============ client money pot ============
CREATE TABLE public.client_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'top_up' CHECK (direction IN ('top_up','refund')),
  amount_ugx integer NOT NULL CHECK (amount_ugx > 0),
  received_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kampala')::date,
  method text,
  reference text,
  note text,
  attachment_path text,
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE SET NULL,
  added_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_funds_resident_idx ON public.client_funds(resident_id);
CREATE INDEX client_funds_day_idx ON public.client_funds(shoot_day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_funds TO authenticated;
GRANT ALL ON public.client_funds TO service_role;
ALTER TABLE public.client_funds ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_fund_client(_resident_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_leadership(_user_id)
      OR public.can_see_finance(_user_id)
      OR public.is_resident_handler(_resident_id, _user_id)
      OR public.is_resident_contact(_resident_id, _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.can_fund_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_fund_client(uuid, uuid) TO authenticated;

CREATE POLICY "Staff and the client can see the pot" ON public.client_funds
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid()));

CREATE POLICY "Fund holders add money" ON public.client_funds
FOR INSERT TO authenticated
WITH CHECK (public.can_fund_client(resident_id, auth.uid()));

CREATE POLICY "Fund holders fix money lines" ON public.client_funds
FOR UPDATE TO authenticated
USING (public.can_fund_client(resident_id, auth.uid()))
WITH CHECK (public.can_fund_client(resident_id, auth.uid()));

CREATE POLICY "Leadership and finance remove money lines" ON public.client_funds
FOR DELETE TO authenticated
USING (public.is_leadership(auth.uid()) OR public.can_see_finance(auth.uid()));

CREATE TRIGGER client_funds_updated_at BEFORE UPDATE ON public.client_funds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ shoot day spend ============
CREATE TABLE public.shoot_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_day_id uuid NOT NULL REFERENCES public.shoot_days(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  payer text NOT NULL DEFAULT 'studio' CHECK (payer IN ('studio','client')),
  amount_ugx integer NOT NULL CHECK (amount_ugx > 0),
  category text NOT NULL DEFAULT 'other',
  note text,
  attachment_path text,
  spent_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kampala')::date,
  spent_by uuid DEFAULT auth.uid(),
  cashbook_entry_id uuid REFERENCES public.cashbook_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shoot_spend_day_idx ON public.shoot_spend(shoot_day_id);
CREATE INDEX shoot_spend_resident_idx ON public.shoot_spend(resident_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoot_spend TO authenticated;
GRANT ALL ON public.shoot_spend TO service_role;
ALTER TABLE public.shoot_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and the client can see spend" ON public.shoot_spend
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR resident_id IN (SELECT id FROM public.residents WHERE user_id = auth.uid()));

CREATE POLICY "Crew and fund holders log spend" ON public.shoot_spend
FOR INSERT TO authenticated
WITH CHECK (
  public.is_shoot_crew(auth.uid(), shoot_day_id)
  OR public.can_edit_content(auth.uid())
  OR (resident_id IS NOT NULL AND public.can_fund_client(resident_id, auth.uid()))
  OR public.is_leadership(auth.uid())
  OR public.can_see_finance(auth.uid())
);

CREATE POLICY "Crew and fund holders fix spend" ON public.shoot_spend
FOR UPDATE TO authenticated
USING (
  public.is_shoot_crew(auth.uid(), shoot_day_id)
  OR public.is_leadership(auth.uid())
  OR public.can_see_finance(auth.uid())
)
WITH CHECK (
  public.is_shoot_crew(auth.uid(), shoot_day_id)
  OR public.is_leadership(auth.uid())
  OR public.can_see_finance(auth.uid())
);

CREATE POLICY "Crew and leadership remove spend" ON public.shoot_spend
FOR DELETE TO authenticated
USING (
  public.is_shoot_crew(auth.uid(), shoot_day_id)
  OR public.is_leadership(auth.uid())
  OR public.can_see_finance(auth.uid())
);

CREATE TRIGGER shoot_spend_updated_at BEFORE UPDATE ON public.shoot_spend
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ what was shot ============
ALTER TABLE public.shoot_day_items
  ADD COLUMN outcome text NOT NULL DEFAULT 'planned' CHECK (outcome IN ('planned','shot','partly','missed')),
  ADD COLUMN outcome_note text,
  ADD COLUMN footage_where text,
  ADD COLUMN outcome_by uuid,
  ADD COLUMN outcome_at timestamptz;

-- ============ pot balance ============
CREATE OR REPLACE FUNCTION public.client_pot_balance(_resident_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT SUM(CASE WHEN direction = 'top_up' THEN amount_ugx ELSE -amount_ugx END)
    FROM public.client_funds WHERE resident_id = _resident_id
  ), 0)::int
  - COALESCE((
    SELECT SUM(amount_ugx) FROM public.shoot_spend
    WHERE resident_id = _resident_id AND payer = 'client'
  ), 0)::int;
$$;
REVOKE EXECUTE ON FUNCTION public.client_pot_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_pot_balance(uuid) TO authenticated;

-- ============ wrap guard ============
CREATE OR REPLACE FUNCTION public.finish_shoot_day(_day_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NOT (public.can_edit_content(auth.uid()) OR public.is_shoot_crew(auth.uid(), _day_id)) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shoot_day_items WHERE shoot_day_id = _day_id AND outcome = 'planned') THEN
    RAISE EXCEPTION 'Mark every piece as shot, partly shot or not shot before wrapping the day.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.shoot_days SET status = 'done' WHERE id = _day_id AND status IN ('confirmed','shooting');
END;
$function$;