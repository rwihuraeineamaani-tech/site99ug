REVOKE EXECUTE ON FUNCTION public.kpi_target_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_kpi_manager(uuid) FROM PUBLIC, anon;