CREATE OR REPLACE FUNCTION public.resolve_website_resident(
  _project_ids uuid[],
  _resident_id uuid DEFAULT NULL,
  _name text DEFAULT NULL,
  _territory text DEFAULT NULL,
  _since text DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
  resolved_name text;
  clean_name text := nullif(trim(_name), '');
  clean_territory text := nullif(trim(_territory), '');
  clean_since text := nullif(trim(_since), '');
  clean_email text := nullif(lower(trim(_email)), '');
  project_count integer;
  linked_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the System Administrator can resolve website Resident links.' USING ERRCODE = '42501';
  END IF;

  IF _project_ids IS NULL OR cardinality(_project_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one website project.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO project_count
  FROM public.projects
  WHERE id = ANY(_project_ids);

  IF project_count <> cardinality(_project_ids) THEN
    RAISE EXCEPTION 'One or more website projects could not be found.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO linked_count
  FROM public.resident_projects
  WHERE project_id = ANY(_project_ids);

  IF linked_count > 0 THEN
    RAISE EXCEPTION 'One or more projects were already linked. Refresh the review queue and try again.' USING ERRCODE = '23505';
  END IF;

  IF _resident_id IS NOT NULL THEN
    SELECT id, name INTO resolved_id, resolved_name
    FROM public.residents
    WHERE id = _resident_id;

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'That Resident record no longer exists.' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF clean_name IS NULL OR clean_territory IS NULL OR clean_since IS NULL THEN
      RAISE EXCEPTION 'Name, area/category and starting year are required.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.residents
      WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(regexp_replace(clean_name, '\s+', ' ', 'g'))
    ) THEN
      RAISE EXCEPTION 'A Resident with this name already exists. Link the existing record instead.' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.residents (
      name, territory, since, status, visible, email, primary_email,
      source, category, lifecycle_status, onboarding_status, onboarding_started_at
    ) VALUES (
      clean_name, clean_territory, clean_since, 'Active', false, clean_email, clean_email,
      'website_review', clean_territory, 'active', 'in_progress', now()
    )
    RETURNING id, name INTO resolved_id, resolved_name;
  END IF;

  INSERT INTO public.resident_projects (project_id, resident_id)
  SELECT DISTINCT project_id, resolved_id
  FROM unnest(_project_ids) AS project_id
  ON CONFLICT (resident_id, project_id) DO NOTHING;

  UPDATE public.projects
  SET client = resolved_name,
      updated_at = now()
  WHERE id = ANY(_project_ids);

  INSERT INTO public.activity_log (
    actor_id, actor_kind, area, action, summary, path, entity_type, entity_id, detail
  ) VALUES (
    auth.uid(), 'staff', 'Website',
    CASE WHEN _resident_id IS NULL THEN 'Created and linked website Resident' ELSE 'Linked website projects to Resident' END,
    format('%s project%s linked to %s', project_count, CASE WHEN project_count = 1 THEN '' ELSE 's' END, resolved_name),
    '/app/site', 'resident', resolved_id,
    jsonb_build_object('project_ids', to_jsonb(_project_ids), 'resident_name', resolved_name, 'created', _resident_id IS NULL)
  );

  RETURN resolved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_website_resident(uuid[], uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_website_resident(uuid[], uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_website_resident(uuid[], uuid, text, text, text, text) TO service_role;