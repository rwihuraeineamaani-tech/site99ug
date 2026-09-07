ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_items_project_id_idx ON public.content_items(project_id);