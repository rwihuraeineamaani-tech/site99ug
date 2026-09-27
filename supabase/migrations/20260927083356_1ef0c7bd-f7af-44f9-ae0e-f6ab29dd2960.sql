-- Everyone on the team can add ideas to the Content Pipeline.
-- Editing/moving/deleting after the Idea stage stays with the content team and crew.
DROP POLICY IF EXISTS "Content team can add content" ON public.content_items;
CREATE POLICY "Staff can add content"
  ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (public.can_view_content(auth.uid()));

-- Everyone on the team can manage strategy goals and monthly targets.
DROP POLICY IF EXISTS "Assigned staff manage client goals" ON public.client_goals;
CREATE POLICY "Staff manage client goals" ON public.client_goals
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Leadership manage targets" ON public.client_targets;
CREATE POLICY "Staff manage targets" ON public.client_targets
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));