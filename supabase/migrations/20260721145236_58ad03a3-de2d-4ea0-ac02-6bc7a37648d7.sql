
-- Sales window on tiers
ALTER TABLE public.ticket_tiers 
  ADD COLUMN IF NOT EXISTS sales_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sales_end_at TIMESTAMPTZ;

-- Payment method + manual TID on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pesapal',
  ADD COLUMN IF NOT EXISTS manual_tid TEXT,
  ADD COLUMN IF NOT EXISTS manual_provider TEXT,
  ADD COLUMN IF NOT EXISTS manual_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS manual_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Allow admins to update / delete orders and tickets so they can confirm manually
CREATE POLICY "admins update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
