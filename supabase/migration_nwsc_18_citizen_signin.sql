-- ============================================================
-- NWSC conversion, step 18: optional citizen sign-in (phone + SMS code)
--   * citizens may sign in with their phone number and a one-time code;
--     reporting, consultations, surveys and forums stay open to guests
--   * signing in links the person's alert profile and the requests made
--     from that phone number, so "My NWSC" works on any device
--   * codes are stored hashed, expire after 10 minutes, allow 5 tries and
--     are rate-limited per phone (handled by the citizen-auth function)
--
-- Run AFTER migration_nwsc_17_policy_updates_practical.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. One-time codes (server only) ----------
create table if not exists public.citizen_otp (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists citizen_otp_phone_idx on public.citizen_otp (phone, created_at desc);
alter table public.citizen_otp enable row level security;   -- no policies: only the server function reads it

-- ---------- 2. Profiles and requests belong to the signed-in citizen ----------
alter table public.alert_subscriptions add column if not exists user_id uuid references public.users(id) on delete set null;
create unique index if not exists alert_subscriptions_user_key on public.alert_subscriptions (user_id) where user_id is not null;

-- Called by the function after a correct code: attach what this phone already has.
create or replace function public.link_citizen(p_user uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_subs int; v_reqs int;
begin
  update public.alert_subscriptions set user_id = p_user, updated_at = now()
  where user_id is null and public.normalize_ug_phone(phone) = public.normalize_ug_phone(p_phone)
    and not exists (select 1 from public.alert_subscriptions x where x.user_id = p_user);
  get diagnostics v_subs = row_count;
  update public.feedback set user_id = p_user::text
  where user_id = 'anonymous' and source = 'Online'
    and public.normalize_ug_phone(contact_phone) = public.normalize_ug_phone(p_phone);
  get diagnostics v_reqs = row_count;
  return jsonb_build_object('profile_linked', v_subs > 0, 'requests_linked', v_reqs);
end;
$$;
revoke execute on function public.link_citizen(uuid, text) from public, anon, authenticated;

-- The signed-in citizen's profile link (token), if they have a profile.
create or replace function public.my_profile_token()
returns uuid language sql stable security definer set search_path = public as $$
  select token from public.alert_subscriptions where user_id = auth.uid() limit 1;
$$;
grant execute on function public.my_profile_token() to authenticated;

-- Claim a profile just created on this account (same phone number only).
create or replace function public.claim_profile(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_phone text := (select phone from public.users where id = auth.uid() and role = 'citizen');
begin
  if v_phone is null then return false; end if;
  update public.alert_subscriptions set user_id = auth.uid(), updated_at = now()
  where token = p_token and user_id is null
    and public.normalize_ug_phone(phone) = public.normalize_ug_phone(v_phone)
    and not exists (select 1 from public.alert_subscriptions x where x.user_id = auth.uid());
  return found;
end;
$$;
grant execute on function public.claim_profile(uuid) to authenticated;

-- All of the signed-in citizen's requests, on any device.
create or replace function public.my_requests()
returns table (reference_no text, title text, status text, request_type text, category text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.reference_no, f.title, f.status, f.request_type, f.category, f.created_at, f.updated_at
  from public.feedback f
  where auth.uid() is not null and f.user_id = auth.uid()::text
  order by f.created_at desc
  limit 50;
$$;
grant execute on function public.my_requests() to authenticated;

-- Account deletion: requests stay on record (they are official) but are
-- no longer tied to the person; the alert profile is removed.
create or replace function public.forget_citizen(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users where id = p_user and role = 'citizen') then
    raise exception 'Only citizen accounts can be deleted this way';
  end if;
  update public.feedback set user_id = 'anonymous' where user_id = p_user::text;
  update public.notification_outbox set status = 'cancelled', updated_at = now()
  where status = 'queued' and token in (select token from public.alert_subscriptions where user_id = p_user);
  delete from public.alert_subscriptions where user_id = p_user;
  begin
    delete from public.users where id = p_user;
  exception when foreign_key_violation then
    -- Still referenced (e.g. forum posts): keep the row but erase the person.
    update public.users set full_name = null, phone = null, avatar_url = null, preferences = '{}', is_active = false,
      email = 'deleted-' || p_user || '@deleted.invalid' where id = p_user;
  end;
end;
$$;
revoke execute on function public.forget_citizen(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
