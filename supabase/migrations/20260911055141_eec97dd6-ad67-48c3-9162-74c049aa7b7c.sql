revoke execute on function public.chat_people() from authenticated;
revoke execute on function public.open_direct_chat(uuid) from authenticated;
revoke execute on function public.raise_recurring_invoices() from authenticated;
grant execute on function public.chat_people() to authenticated;
grant execute on function public.open_direct_chat(uuid) to authenticated;
grant execute on function public.raise_recurring_invoices() to authenticated;