create or replace function public.can_assign_leadership_work(_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_staff(_user_id)
$$;