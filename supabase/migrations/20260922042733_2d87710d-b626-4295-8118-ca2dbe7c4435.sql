
-- Portal (client) read-only visibility, scoped to the signed-in user's own resident record.

CREATE POLICY "Portal users view own invoices" ON public.invoices
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()) AND direction = 'out');

CREATE POLICY "Portal users view own funds" ON public.client_funds
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own contracts" ON public.contracts
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own resident contracts" ON public.resident_contracts
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own shoot days" ON public.shoot_days
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own briefs" ON public.briefs
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own onboarding" ON public.resident_onboarding_steps
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own goals" ON public.client_goals
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));

CREATE POLICY "Portal users view own contacts" ON public.resident_contacts
FOR SELECT TO authenticated
USING (resident_id IS NOT NULL AND resident_id = public.my_resident_id(auth.uid()));
