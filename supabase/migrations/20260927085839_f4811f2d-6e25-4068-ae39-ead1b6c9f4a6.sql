REVOKE ALL ON FUNCTION public.bill_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bill_paid_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.raise_bill_for_source(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_client_handler(uuid, uuid) FROM anon;