DO $d$ BEGIN
EXECUTE replace(pg_get_functiondef('public.recompute_resident_lifecycle(uuid)'::regprocedure),
  $a$status IN ('complete','renewed')) THEN life := 'complete'$a$,
  $a$status IN ('complete','renewed','archived')) THEN life := 'complete'$a$);
END $d$;
SELECT public.recompute_resident_lifecycle(id) FROM public.residents WHERE name = 'Catalyst UG';