CREATE OR REPLACE FUNCTION public.queue_cash_request_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _recipient uuid; _actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' THEN
    FOR _recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'managing_director' AND ur.user_id <> NEW.requester LOOP
      PERFORM public.queue_push(_recipient,_actor,'finance','cash_request_submitted','cash_request',NEW.id,'Cash request waiting','A cash request needs review.','/app/finance/requests','cash:'||NEW.id::text||':submitted:'||_recipient::text);
    END LOOP;
  ELSIF NEW.status = 'md_approved' THEN
    FOR _recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'founder' AND ur.user_id <> NEW.requester LOOP
      PERFORM public.queue_push(_recipient,_actor,'finance','cash_request_founder_review','cash_request',NEW.id,'Founder approval waiting','A cash request needs final review.','/app/finance/requests','cash:'||NEW.id::text||':md:'||_recipient::text);
    END LOOP;
  ELSIF NEW.status IN ('approved','founder_approved','declined','rejected','paid') THEN
    PERFORM public.queue_push(NEW.requester,_actor,'finance','cash_request_decided','cash_request',NEW.id,'Cash request updated','Your cash request has been '||replace(NEW.status,'_',' ')||'.','/app/finance/requests','cash:'||NEW.id::text||':'||NEW.status||':'||NEW.requester::text);
  END IF;
  RETURN NEW;
END; $function$;