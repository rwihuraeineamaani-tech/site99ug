CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'Post',
  stage text NOT NULL DEFAULT 'Idea',
  lead text,
  shooter text,
  editor text,
  planned_at date,
  link text,
  notes text,
  sort integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','founder','managing_director','creative_director','creative']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_view_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_edit_content(_user_id)
      OR public.has_any_role(_user_id, ARRAY['sales_head','legal','viewer']::app_role[])
$$;

REVOKE EXECUTE ON FUNCTION public.can_edit_content(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_content(uuid) FROM anon;

CREATE POLICY "Content team can view content"
  ON public.content_items FOR SELECT TO authenticated
  USING (public.can_view_content(auth.uid()));

CREATE POLICY "Clients can view their own content"
  ON public.content_items FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND client_id = public.my_client_id());

CREATE POLICY "Content team can add content"
  ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_content(auth.uid()));

CREATE POLICY "Content team can edit content"
  ON public.content_items FOR UPDATE TO authenticated
  USING (public.can_edit_content(auth.uid()))
  WITH CHECK (public.can_edit_content(auth.uid()));

CREATE POLICY "Content team can remove content"
  ON public.content_items FOR DELETE TO authenticated
  USING (public.can_edit_content(auth.uid()));

CREATE TRIGGER content_items_set_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX content_items_stage_idx ON public.content_items (stage);
CREATE INDEX content_items_client_idx ON public.content_items (client_id);