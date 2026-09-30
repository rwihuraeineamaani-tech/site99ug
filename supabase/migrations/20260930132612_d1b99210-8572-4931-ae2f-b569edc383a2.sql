CREATE OR REPLACE FUNCTION public.list_public_projects()
RETURNS TABLE(id uuid, title text, client text, year text, tag text, description text, cover_url text, gallery_urls text[], external_url text, display_order int, youtube_url text, aspect_ratio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, client, year::text, tag, description, cover_url, gallery_urls, external_url, display_order::int, youtube_url, aspect_ratio::text
  FROM public.projects ORDER BY display_order;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_projects() TO anon, authenticated;