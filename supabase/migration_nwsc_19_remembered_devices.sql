-- ============================================================
-- NWSC conversion, step 19: remembered devices for citizen sign-in
--   After the first SMS code, a phone or computer can be remembered:
--   next time the citizen only types their number on that device.
--   A new device still needs a code. Each remembered device holds a
--   random secret; only its hash is stored here. Unused for 180 days,
--   a device must use a code again.
--
-- Run AFTER migration_nwsc_18_citizen_signin.sql. Safe to re-run.
-- ============================================================

begin;

create table if not exists public.citizen_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  secret_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists citizen_devices_user_idx on public.citizen_devices (user_id);
alter table public.citizen_devices enable row level security;

-- Citizens can see how many devices are remembered on their account.
drop policy if exists "own devices" on public.citizen_devices;
create policy "own devices" on public.citizen_devices for select using (user_id = auth.uid());

-- Deleting an account forgets its devices too.
create or replace function public.forget_citizen(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users where id = p_user and role = 'citizen') then
    raise exception 'Only citizen accounts can be deleted this way';
  end if;
  delete from public.citizen_devices where user_id = p_user;
  update public.feedback set user_id = 'anonymous' where user_id = p_user::text;
  update public.notification_outbox set status = 'cancelled', updated_at = now()
  where status = 'queued' and token in (select token from public.alert_subscriptions where user_id = p_user);
  delete from public.alert_subscriptions where user_id = p_user;
  begin
    delete from public.users where id = p_user;
  exception when foreign_key_violation then
    update public.users set full_name = null, phone = null, avatar_url = null, preferences = '{}', is_active = false,
      email = 'deleted-' || p_user || '@deleted.invalid' where id = p_user;
  end;
end;
$$;
revoke execute on function public.forget_citizen(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
