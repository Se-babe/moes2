-- town_halls had RLS enabled with only a "public read" policy (it was
-- unused by any app code during the RLS lockdown, so it was locked to
-- read-only as a safe default). Now that Virtual Town Halls is a real
-- admin-managed feature, add the write policy.
create policy "admin writes town_halls" on public.town_halls
  for all using (public.is_admin()) with check (public.is_admin());
