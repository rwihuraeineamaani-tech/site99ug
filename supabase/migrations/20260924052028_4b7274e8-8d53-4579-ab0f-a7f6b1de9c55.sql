DROP POLICY IF EXISTS "Assigned staff manage strategy maps" ON public.strategy_maps;
CREATE POLICY "Staff manage strategy maps" ON public.strategy_maps FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Strategy team writes map versions" ON public.strategy_map_versions;
CREATE POLICY "Staff write map versions" ON public.strategy_map_versions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));