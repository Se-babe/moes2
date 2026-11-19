-- ============================================================
-- NWSC conversion, step 4: announcements & citizen alerts
--   * announcements with a draft -> approval -> publish/schedule workflow
--   * service areas (Jinja zones) for targeting
--   * citizen alert subscriptions (SMS/email, by area and topic)
--   * scheduled publishing + expiry (pg_cron), and a hook that asks the
--     announcement-dispatch Edge Function to send alerts (pg_net)
--
-- Run AFTER migration_nwsc_03_staff_portal.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Service areas ----------
create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  is_active boolean not null default true
);
alter table public.service_areas enable row level security;
drop policy if exists "public read areas" on public.service_areas;
create policy "public read areas" on public.service_areas for select using (true);
drop policy if exists "admin writes areas" on public.service_areas;
create policy "admin writes areas" on public.service_areas for all using (public.is_admin()) with check (public.is_admin());

insert into public.service_areas (name, display_order) values
  ('Jinja Central', 1), ('Walukuba', 2), ('Mpumudde', 3), ('Masese', 4), ('Kimaka', 5),
  ('Mafubira', 6), ('Bugembe', 7), ('Njeru', 8), ('Budondo', 9), ('Kakira', 10)
on conflict (name) do nothing;

-- ---------- 2. Announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  category text not null default 'Service notice'
    check (category in ('Planned interruption', 'Emergency', 'Restoration', 'Service notice', 'Tariffs & billing', 'General')),
  areas text[] not null default '{}',             -- empty = all areas
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'scheduled', 'published', 'rejected', 'archived')),
  publish_at timestamptz,                          -- null = publish as soon as approved
  expires_at timestamptz,                          -- auto-archived after this
  published_at timestamptz,
  notify_sms boolean not null default false,
  notify_email boolean not null default true,
  notified_at timestamptz,
  notify_count int not null default 0,
  author_id uuid references public.users(id) on delete set null,
  author_name text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_public_idx on public.announcements (status, published_at desc);

alter table public.announcements enable row level security;

drop policy if exists "public reads published" on public.announcements;
create policy "public reads published" on public.announcements for select using (status = 'published');
drop policy if exists "staff read all announcements" on public.announcements;
create policy "staff read all announcements" on public.announcements for select using (public.is_staff());
drop policy if exists "staff create announcements" on public.announcements;
create policy "staff create announcements" on public.announcements for insert
  with check (public.is_staff() and author_id = auth.uid() and status in ('draft', 'pending'));
drop policy if exists "staff edit announcements" on public.announcements;
create policy "staff edit announcements" on public.announcements for update
  using (public.is_staff() and (author_id = auth.uid() or public.current_role_name() in ('supervisor', 'admin')))
  with check (public.is_staff());
drop policy if exists "admin deletes announcements" on public.announcements;
create policy "admin deletes announcements" on public.announcements for delete
  using (public.is_admin() or (author_id = auth.uid() and status in ('draft', 'rejected')));

-- Officers may only draft and submit; publishing goes through review.
create or replace function public.announcement_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.current_role_name();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), 'NWSC staff') into new.author_name from public.users where id = new.author_id;
  end if;
  if auth.uid() is null then
    return new; -- scheduler / service role
  end if;
  if coalesce(v_role, '') not in ('supervisor', 'admin') then
    if new.status not in ('draft', 'pending') then
      raise exception 'Only supervisors and administrators can publish announcements';
    end if;
    if tg_op = 'UPDATE' and old.status not in ('draft', 'pending', 'rejected') then
      raise exception 'This announcement has already been reviewed; ask a supervisor to change it';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists announcement_guard on public.announcements;
create trigger announcement_guard before insert or update on public.announcements
  for each row execute function public.announcement_guard();

-- Approve or reject. Approval publishes now, or schedules for publish_at.
create or replace function public.review_announcement(p_id uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.announcements;
  v_role text := public.current_role_name();
  v_status text;
begin
  if coalesce(v_role, '') not in ('supervisor', 'admin') or not public.is_staff() then
    raise exception 'Only supervisors and administrators can review announcements';
  end if;
  select * into a from public.announcements where id = p_id for update;
  if not found then raise exception 'Announcement not found'; end if;
  if a.author_id = auth.uid() and v_role <> 'admin' then
    raise exception 'Another supervisor or an administrator must approve your own announcement';
  end if;

  if p_decision = 'approve' then
    if a.publish_at is not null and a.publish_at > now() then
      v_status := 'scheduled';
    else
      v_status := 'published';
    end if;
    update public.announcements
      set status = v_status, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note,
          published_at = case when v_status = 'published' then now() else null end
      where id = p_id;
  elsif p_decision = 'reject' then
    if coalesce(trim(p_note), '') = '' then raise exception 'Give a reason so the author can fix it'; end if;
    v_status := 'rejected';
    update public.announcements
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
      where id = p_id;
    perform public.notify_user(a.author_id, 'Announcement needs changes', a.title || ' — ' || p_note, 'announcement', 'StaffPortal', a.id);
  elsif p_decision = 'archive' then
    v_status := 'archived';
    update public.announcements set status = 'archived', reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  else
    raise exception 'Unknown decision %', p_decision;
  end if;
  return v_status;
end;
$$;
grant execute on function public.review_announcement(uuid, text, text) to authenticated;

-- Tell reviewers when something is waiting for them.
create or replace function public.announcement_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into public.notifications (user_id, title, message, type, target_screen, target_id)
    select u.id, 'Announcement awaiting approval', new.title, 'announcement', 'StaffPortal', new.id
    from public.users u
    where u.is_active and u.id is distinct from new.author_id
      and (u.role = 'admin' or (u.role = 'supervisor' and u.department_id is not distinct from
           (select department_id from public.users where id = new.author_id)));
  end if;
  return null;
end;
$$;
drop trigger if exists announcement_after_write on public.announcements;
create trigger announcement_after_write after insert or update on public.announcements
  for each row execute function public.announcement_after_write();

-- Carry over the old "updates" posts as published announcements.
insert into public.announcements (title, body, category, status, published_at, created_at, notify_email)
select u.title, coalesce(nullif(u.description, ''), u.title),
       case u.category when 'Maintenance' then 'Planned interruption' when 'Policy' then 'Tariffs & billing' else 'General' end,
       'published', u.created_at, u.created_at, false
from public.updates u
where not exists (select 1 from public.announcements a where a.title = u.title and a.created_at = u.created_at);

-- ---------- 3. Citizen alert subscriptions ----------
create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  areas text[] not null default '{}',        -- empty = all areas
  categories text[] not null default '{}',   -- empty = all topics
  language text not null default 'en',
  is_active boolean not null default true,
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_contact check (phone is not null or email is not null)
);
create unique index if not exists alert_subscriptions_phone_key on public.alert_subscriptions (phone) where phone is not null;
create unique index if not exists alert_subscriptions_email_key on public.alert_subscriptions (lower(email)) where email is not null;
alter table public.alert_subscriptions enable row level security;
drop policy if exists "admin reads subscriptions" on public.alert_subscriptions;
create policy "admin reads subscriptions" on public.alert_subscriptions for select using (public.is_admin());

-- Public sign-up / update (by phone or email). Returns the manage token.
create or replace function public.subscribe_alerts(
  p_name text, p_phone text, p_email text, p_areas text[], p_categories text[], p_language text default 'en'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_token uuid;
begin
  if v_phone is null and v_email is null then raise exception 'Give a phone number or an email address'; end if;
  if v_phone is not null then
    v_phone := case
      when v_phone ~ '^\+\d{10,15}$' then v_phone
      when v_phone ~ '^256\d{9}$' then '+' || v_phone
      when v_phone ~ '^0\d{9}$' then '+256' || substr(v_phone, 2)
      when v_phone ~ '^7\d{8}$' then '+256' || v_phone
      else null end;
    if v_phone is null then raise exception 'Enter a valid Ugandan phone number, e.g. 0772 123456'; end if;
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;

  select token into v_token from public.alert_subscriptions
  where (v_phone is not null and phone = v_phone) or (v_email is not null and lower(email) = v_email)
  limit 1;

  if v_token is not null then
    update public.alert_subscriptions
      set name = coalesce(nullif(trim(p_name), ''), name), phone = coalesce(v_phone, phone), email = coalesce(v_email, email),
          areas = coalesce(p_areas, '{}'), categories = coalesce(p_categories, '{}'),
          language = coalesce(nullif(p_language, ''), 'en'), is_active = true, updated_at = now()
      where token = v_token;
  else
    insert into public.alert_subscriptions (name, phone, email, areas, categories, language)
    values (nullif(trim(p_name), ''), v_phone, v_email, coalesce(p_areas, '{}'), coalesce(p_categories, '{}'), coalesce(nullif(p_language, ''), 'en'))
    returning token into v_token;
  end if;
  return v_token;
end;
$$;
grant execute on function public.subscribe_alerts(text, text, text, text[], text[], text) to anon, authenticated;

create or replace function public.unsubscribe_alerts(p_token uuid)
returns boolean language sql security definer set search_path = public as $$
  update public.alert_subscriptions set is_active = false, updated_at = now() where token = p_token returning true;
$$;
grant execute on function public.unsubscribe_alerts(uuid) to anon, authenticated;

-- Who should hear about an announcement (used by the dispatch function).
create or replace function public.announcement_recipients(p_announcement uuid)
returns table (phone text, email text, language text, token uuid)
language sql stable security definer set search_path = public as $$
  select s.phone, s.email, s.language, s.token
  from public.alert_subscriptions s, public.announcements a
  where a.id = p_announcement and s.is_active
    and (cardinality(a.areas) = 0 or cardinality(s.areas) = 0 or s.areas && a.areas)
    and (cardinality(s.categories) = 0 or a.category = any(s.categories) or a.category = 'Emergency');
$$;
revoke execute on function public.announcement_recipients(uuid) from public, anon, authenticated;

-- Atomically claim published announcements that still need alerts sent.
create or replace function public.claim_announcements_to_notify()
returns setof public.announcements language sql security definer set search_path = public as $$
  update public.announcements set notified_at = now()
  where status = 'published' and notified_at is null and (notify_sms or notify_email)
  returning *;
$$;
revoke execute on function public.claim_announcements_to_notify() from public, anon, authenticated;

alter table public.notification_log add column if not exists announcement_id uuid references public.announcements(id) on delete set null;

-- ---------- 4. Scheduling ----------
create or replace function public.publish_due_announcements()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.announcements set status = 'published', published_at = now()
  where status = 'scheduled' and publish_at <= now();
  get diagnostics n = row_count;
  update public.announcements set status = 'archived'
  where status = 'published' and expires_at is not null and expires_at < now();
  return n;
end;
$$;
revoke execute on function public.publish_due_announcements() from public, anon, authenticated;

-- Every 5 minutes: publish what's due, then ask the dispatch function to send
-- alerts. pg_net makes the HTTP call; the function only sends alerts that
-- haven't been sent yet, so calling it when there is nothing to do is harmless.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(jobid) from cron.job where jobname = 'nwsc-announcements';
  perform cron.schedule('nwsc-announcements', '*/5 * * * *', $job$
    select public.publish_due_announcements();
    select net.http_post(
      url := 'https://sjsavaijgoazitnrjtab.supabase.co/functions/v1/announcement-dispatch',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $job$);
exception when others then
  raise notice 'Announcement scheduler not set up: %', sqlerrm;
end;
$$;

-- Make the API pick up the new columns and functions immediately.
notify pgrst, 'reload schema';

commit;
