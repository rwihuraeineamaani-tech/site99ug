CREATE TABLE public.site_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'site-logos',
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_logos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_logos TO authenticated;
GRANT ALL ON public.site_logos TO service_role;
ALTER TABLE public.site_logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible site logos are public" ON public.site_logos FOR SELECT TO anon, authenticated USING (visible OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage site logos" ON public.site_logos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_logos (name, image_path, bucket, sort_order)
SELECT r.name, r.avatar_url, 'client-logos', row_number() OVER (ORDER BY r.name)
FROM public.residents r
WHERE r.visible IS NOT FALSE AND r.avatar_url IS NOT NULL AND r.avatar_url <> '';

CREATE POLICY "Public read site-logos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-logos');
CREATE POLICY "Admins upload site-logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete site-logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-logos' AND public.has_role(auth.uid(), 'admin'));