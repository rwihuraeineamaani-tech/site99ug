CREATE OR REPLACE FUNCTION public.chat_people()
RETURNS TABLE(user_id uuid, display_name text, person_kind text, subtitle text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid, public.is_staff(auth.uid()) AS staff
  ), my_resident AS (
    SELECT r.id, r.contact_user_id, r.handler_user_id
    FROM public.residents r, me
    WHERE r.user_id = me.uid
    LIMIT 1
  ), my_client AS (
    SELECT cu.client_id
    FROM public.client_users cu, me
    WHERE cu.user_id = me.uid
    LIMIT 1
  ), allowed AS (
    SELECT tm.user_id, coalesce(tm.display_name, tm.email) AS display_name,
           'staff'::text AS person_kind, coalesce(tm.title, 'Site 99 team') AS subtitle
    FROM public.team_members tm, me
    WHERE tm.user_id <> me.uid
      AND (
        me.staff
        OR tm.user_id IN (SELECT contact_user_id FROM my_resident UNION SELECT handler_user_id FROM my_resident)
        OR public.is_leadership(tm.user_id)
      )
    UNION ALL
    SELECT r.user_id, r.name, 'client'::text, coalesce(r.territory, 'Resident')
    FROM public.residents r, me
    WHERE me.staff AND r.user_id IS NOT NULL AND r.user_id <> me.uid
    UNION ALL
    SELECT cu.user_id, coalesce(c.contact_person, c.name), 'client'::text, c.name
    FROM public.client_users cu
    JOIN public.clients c ON c.id = cu.client_id
    CROSS JOIN me
    WHERE me.staff AND cu.user_id IS NOT NULL AND cu.user_id <> me.uid
  )
  SELECT DISTINCT ON (a.user_id) a.user_id, a.display_name, a.person_kind, a.subtitle
  FROM allowed a
  WHERE a.user_id IS NOT NULL
  ORDER BY a.user_id, a.person_kind DESC
$$;
REVOKE ALL ON FUNCTION public.chat_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_people() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.open_direct_chat(_target_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _key text;
  _thread uuid;
  _me_staff boolean;
  _target_staff boolean;
  _me_resident public.residents%ROWTYPE;
  _target_resident public.residents%ROWTYPE;
  _me_client uuid;
  _target_client uuid;
  _allowed boolean := false;
BEGIN
  IF _me IS NULL OR _target_user IS NULL OR _me = _target_user THEN
    RAISE EXCEPTION 'Choose another person.';
  END IF;

  _me_staff := public.is_staff(_me);
  _target_staff := public.is_staff(_target_user);
  SELECT * INTO _me_resident FROM public.residents WHERE user_id = _me LIMIT 1;
  SELECT * INTO _target_resident FROM public.residents WHERE user_id = _target_user LIMIT 1;
  SELECT client_id INTO _me_client FROM public.client_users WHERE user_id = _me LIMIT 1;
  SELECT client_id INTO _target_client FROM public.client_users WHERE user_id = _target_user LIMIT 1;

  IF _me_staff AND (_target_staff OR _target_resident.id IS NOT NULL OR _target_client IS NOT NULL) THEN
    _allowed := true;
  ELSIF _target_staff AND _me_resident.id IS NOT NULL THEN
    _allowed := _target_user = _me_resident.contact_user_id
      OR _target_user = _me_resident.handler_user_id
      OR public.is_leadership(_target_user);
  ELSIF _target_staff AND _me_client IS NOT NULL THEN
    _allowed := public.is_leadership(_target_user);
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'You cannot start a conversation with this person.';
  END IF;

  _key := CASE WHEN _me::text < _target_user::text
    THEN _me::text || ':' || _target_user::text
    ELSE _target_user::text || ':' || _me::text END;

  INSERT INTO public.chat_threads(direct_key, created_by)
  VALUES (_key, _me)
  ON CONFLICT (direct_key) DO UPDATE SET updated_at = public.chat_threads.updated_at
  RETURNING id INTO _thread;

  INSERT INTO public.chat_participants(thread_id, user_id)
  VALUES (_thread, _me), (_thread, _target_user)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  RETURN _thread;
END;
$$;
REVOKE ALL ON FUNCTION public.open_direct_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_direct_chat(uuid) TO authenticated, service_role;