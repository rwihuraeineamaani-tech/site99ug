-- Narrow public reads on site-logos to the published list only.
-- Previously "Public read site-logos" let any caller read every object in the
-- bucket, including retired or unpublished uploads. Now an anonymous visitor can
-- only read a file that is currently listed and visible in public.site_logos,
-- which is exactly what the homepage logo strip needs.
DROP POLICY IF EXISTS "Public read site-logos" ON storage.objects;

CREATE POLICY "Published site logos are public" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'site-logos'
  AND EXISTS (
    SELECT 1
    FROM public.site_logos sl
    WHERE sl.bucket = 'site-logos'
      AND sl.image_path = storage.objects.name
      AND sl.visible IS TRUE
  )
);