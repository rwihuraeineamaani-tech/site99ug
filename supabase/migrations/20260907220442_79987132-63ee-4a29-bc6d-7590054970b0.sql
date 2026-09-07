ALTER FUNCTION public.block_occurs_on(public.availability_blocks, date) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.availability_conflicts(uuid[], uuid, date, time, time) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.availability_conflicts(uuid[], uuid, date, time, time) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.block_occurs_on(public.availability_blocks, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.block_occurs_on(public.availability_blocks, date) TO authenticated, service_role;