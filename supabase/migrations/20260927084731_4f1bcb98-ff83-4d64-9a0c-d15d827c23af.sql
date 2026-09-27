DO $d$ BEGIN
EXECUTE replace(replace(replace(pg_get_functiondef('public.ops_overview()'::regprocedure),
  $a$(SELECT count(*) FROM public.residents WHERE status = 'active')$a$,
  $a$(SELECT count(*) FROM public.residents WHERE lifecycle_status IN ('active','renewal_due'))$a$),
  $a$(SELECT count(*) FROM public.contracts WHERE status = 'active')$a$,
  $a$(SELECT count(*) FROM public.resident_contracts WHERE status IN ('active','renewal_due'))$a$),
  $a$(SELECT count(*) FROM public.contracts WHERE ends_on IS NOT NULL AND ends_on BETWEEN current_date AND current_date + 60)$a$,
  $a$(SELECT count(*) FROM public.resident_contracts WHERE status = 'renewal_due')$a$);
END $d$;