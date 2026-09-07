REVOKE EXECUTE ON FUNCTION public.client_pay_overview() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_retainer_shares() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_resident_handler(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_resident_contact(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_resident_assignment_columns() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.client_pay_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_retainer_shares() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_resident_handler(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_resident_contact(uuid, uuid) TO authenticated;