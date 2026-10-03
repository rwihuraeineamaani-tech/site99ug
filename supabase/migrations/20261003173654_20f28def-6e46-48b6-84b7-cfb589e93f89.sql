CREATE OR REPLACE FUNCTION public.is_client_role(_r public.app_role) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT _r IN ('client','resident') $$;

CREATE OR REPLACE FUNCTION public.guard_account_kind() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.role = 'user' THEN RETURN NEW; END IF;
  IF public.is_client_role(NEW.role) THEN
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id=NEW.user_id AND role <> 'user' AND NOT public.is_client_role(role)) THEN
      RAISE EXCEPTION 'This is a staff account. Client portals need their own separate login with a different email.';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id=NEW.user_id AND public.is_client_role(role))
       OR EXISTS (SELECT 1 FROM resident_users WHERE user_id=NEW.user_id) THEN
      RAISE EXCEPTION 'This is a client account. Staff need their own separate login with a different email.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_resident_user_kind() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles WHERE user_id=NEW.user_id AND role <> 'user' AND NOT public.is_client_role(role)) THEN
    RAISE EXCEPTION 'This is a staff account. Client portals need their own separate login with a different email.';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.guard_account_kind() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_resident_user_kind() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS guard_account_kind ON public.user_roles;
CREATE TRIGGER guard_account_kind BEFORE INSERT OR UPDATE OF role ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_account_kind();
DROP TRIGGER IF EXISTS guard_resident_user_kind ON public.resident_users;
CREATE TRIGGER guard_resident_user_kind BEFORE INSERT OR UPDATE OF user_id ON public.resident_users FOR EACH ROW EXECUTE FUNCTION public.guard_resident_user_kind();