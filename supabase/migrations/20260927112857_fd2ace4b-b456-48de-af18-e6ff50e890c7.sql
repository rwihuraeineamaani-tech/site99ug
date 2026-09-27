CREATE OR REPLACE FUNCTION public.start_resident_onboarding(_id uuid, _established boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE comms uuid; n integer := 0; s record; has_portal boolean;
BEGIN
  IF NOT public.can_run_onboarding(auth.uid()) THEN RAISE EXCEPTION 'Only Communications, Client Relations or leadership can start onboarding'; END IF;
  SELECT user_id INTO comms FROM public.user_roles WHERE role = 'communications' ORDER BY user_id LIMIT 1;
  has_portal := EXISTS (SELECT 1 FROM public.resident_users WHERE resident_id = _id);
  FOR s IN SELECT * FROM (VALUES
    (1,'welcome','Welcome call and kick-off meeting','Client Relations',false,'Introduce the team, agree how we will work together and set expectations.'),
    (2,'details','Collect client details and contacts','Client Relations',false,'Billing address, phone numbers, emails and the people we deal with day to day.'),
    (3,'portal','Create the portal account','Client Relations',false,'The client can sign in and see their work, invoices and files.'),
    (4,'legal','Draft and sign the contract','Legal',true,'Contract drafted, sent, signed by the client and filed in Legal.'),
    (5,'brand','Collect brand guidelines, logo and assets','Brand',false,'Logo files, colours, fonts and any brand rules saved on the client record.'),
    (6,'socials','Get access to the social accounts','Content',false,'Logins or admin access to every account we will post to.'),
    (7,'handler','Assign a Handler','Management',false,'One person owns this client day to day and answers for them.'),
    (8,'strategy','Strategy kick-off and goals','Strategy',false,'First strategy session held; goals agreed and saved on the client record.'),
    (9,'content_plan','First month content plan','Content',false,'Ideas for the first month are in the pipeline and approved.'),
    (10,'shoot','Plan the first shoot day','Content',false,'A shoot day is scheduled with a crew and a shot list.'),
    (11,'billing','Agree billing details and payment terms','Finance',false,'Who we invoice, payment terms and any mobile money or bank details.'),
    (12,'first_invoice','Raise the first invoice','Finance',false,'The first invoice is sent and the client knows how to pay.'),
    (13,'targets','Set client targets and KPIs','Management',false,'Monthly targets agreed so bonuses and progress can be measured.'),
    (14,'handover','Handover and final sign-off','Management',true,'Everything above is done; the MD signs off and the client is fully onboarded.')
  ) AS v(sort, key, title, dept, md, note) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.resident_onboarding_steps WHERE resident_id = _id AND step_key = s.key) THEN
      INSERT INTO public.resident_onboarding_steps(resident_id, step_key, title, department, owner_user_id, status, due_on, requires_md_approval, sort, completed_by, completed_at, note)
      VALUES (_id, s.key, s.title, s.dept, comms,
        CASE WHEN (_established AND s.key <> 'handover' AND NOT s.md) OR (s.key = 'portal' AND has_portal) THEN 'complete'
             ELSE 'pending' END,
        (CURRENT_DATE + (s.sort * 3)), s.md, s.sort,
        CASE WHEN _established AND NOT s.md THEN auth.uid() END,
        CASE WHEN _established AND NOT s.md THEN now() END,
        CASE WHEN _established AND NOT s.md THEN 'Established client — done before this checklist' ELSE s.note END);
      n := n + 1;
    ELSE
      UPDATE public.resident_onboarding_steps SET requires_md_approval = s.md, sort = s.sort, note = coalesce(note, s.note) WHERE resident_id = _id AND step_key = s.key;
    END IF;
  END LOOP;
  UPDATE public.residents SET onboarding_status = 'in_progress' WHERE id = _id AND coalesce(onboarding_status,'') <> 'complete';
  RETURN n;
END $$;