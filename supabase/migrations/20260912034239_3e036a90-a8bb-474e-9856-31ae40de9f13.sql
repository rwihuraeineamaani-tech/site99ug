DROP POLICY "Task participants view leadership tasks" ON public.leadership_tasks;
CREATE POLICY "Task participants view leadership tasks" ON public.leadership_tasks FOR SELECT TO authenticated
USING (assigned_by = auth.uid() OR public.is_system_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leadership_task_assignees a WHERE a.task_id = leadership_tasks.id AND a.user_id = auth.uid()));