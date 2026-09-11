CREATE OR REPLACE FUNCTION public.content_items_lock_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.ref_no := OLD.ref_no;
  NEW.added_by := OLD.added_by;
  NEW.added_on := OLD.added_on;
  IF OLD.stage <> 'Idea' THEN
    NEW.title := OLD.title;
    NEW.resident_id := OLD.resident_id;
    NEW.project_id := OLD.project_id;
    NEW.content_type := OLD.content_type;
  END IF;
  RETURN NEW;
END;
$function$;