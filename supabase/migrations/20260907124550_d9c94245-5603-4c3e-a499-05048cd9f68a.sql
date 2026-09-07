CREATE POLICY "Staff can read team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));