-- ============================================================
-- NWSC conversion, step 2: enquiries & complaints
--   * reference numbers (generated in the database)
--   * request type, contact details, location
--   * public status timeline (request_updates)
--   * tracking by reference number without exposing private data
--   * notification log (acknowledgements, SMS/email delivery audit)
--   * closes the role self-escalation hole before staff roles matter
--
-- Run AFTER migration_nwsc_01_rebrand.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 0. Role helpers + lock down role changes ----------
create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('officer', 'supervisor', 'admin'), false);
$$;

-- Citizens may only ever give themselves a citizen-type role; only an
-- admin may set or change a staff role. Without this, the existing
-- "self insert"/"self update" policies let anyone make themselves admin.
create or replace function public.guard_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new; -- admins, and service-role/SQL-editor writes, are trusted
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.role, 'citizen') not in ('citizen', 'business', 'community_leader') then
      new.role := 'citizen';
    end if;
  elsif new.role is distinct from old.role then
    raise exception 'Only an administrator can change a user role';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_role on public.users;
create trigger guard_user_role before insert or update on public.users
  for each row execute function public.guard_user_role();

-- ---------- 1. Extend feedback into a full request record ----------
alter table public.feedback
  add column if not exists reference_no text,
  add column if not exists request_type text not null default 'Complaint',
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists location_text text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check
  check (status in ('Submitted', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed'));

alter table public.feedback drop constraint if exists feedback_request_type_check;
alter table public.feedback add constraint feedback_request_type_check
  check (request_type in ('Enquiry', 'Complaint', 'Suggestion', 'Compliment'));

create unique index if not exists feedback_reference_no_key on public.feedback (reference_no);

-- Reference format: NW-YYMM-XXXXXX  (e.g. NW-2611-7KQ4XP)
-- Random suffix (no 0/O/1/I) so references can't be guessed by counting.
create or replace function public.generate_reference_no()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := 'NW-' || to_char(now() at time zone 'Africa/Kampala', 'YYMM') || '-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.feedback where reference_no = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.feedback_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.reference_no is null then
    new.reference_no := public.generate_reference_no();
  end if;
  if new.status = 'Resolved' and (tg_op = 'INSERT' or old.status is distinct from 'Resolved') then
    new.resolved_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feedback_before_write on public.feedback;
create trigger feedback_before_write before insert or update on public.feedback
  for each row execute function public.feedback_before_write();

-- ---------- 2. Status timeline ----------
create table if not exists public.request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feedback(id) on delete cascade,
  status text,
  message text not null,
  is_public boolean not null default true,   -- false = internal staff note
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists request_updates_request_idx on public.request_updates (request_id, created_at);

alter table public.request_updates enable row level security;
drop policy if exists "staff read updates" on public.request_updates;
create policy "staff read updates" on public.request_updates for select using (public.is_staff());
drop policy if exists "staff add updates" on public.request_updates;
create policy "staff add updates" on public.request_updates for insert
  with check (public.is_staff() and author_id = auth.uid());

-- Every status change is recorded on the timeline automatically, whoever
-- (or whatever) makes it.
create or replace function public.feedback_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_updates (request_id, status, message, author_id)
    values (new.id, new.status,
            'We have received your ' || lower(new.request_type) || '. Reference: ' || new.reference_no || '.',
            null);
  elsif new.status is distinct from old.status then
    insert into public.request_updates (request_id, status, message, author_id)
    values (new.id, new.status, 'Status changed to ' || new.status || '.', auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists feedback_after_write on public.feedback;
create trigger feedback_after_write after insert or update on public.feedback
  for each row execute function public.feedback_after_write();

-- ---------- 3. Privacy: feedback is no longer world-readable ----------
drop policy if exists "public read" on public.feedback;
drop policy if exists "staff read requests" on public.feedback;
create policy "staff read requests" on public.feedback for select using (public.is_staff());
drop policy if exists "owner reads own requests" on public.feedback;
create policy "owner reads own requests" on public.feedback for select
  using (auth.uid() is not null and user_id = auth.uid()::text);

drop policy if exists "admin updates feedback status" on public.feedback;
drop policy if exists "staff update requests" on public.feedback;
create policy "staff update requests" on public.feedback for update
  using (public.is_staff()) with check (public.is_staff());

-- Public tracking: reference number in, safe fields + public timeline out.
create or replace function public.track_request(p_reference text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reference_no', f.reference_no,
    'request_type', f.request_type,
    'category', f.category,
    'title', f.title,
    'status', f.status,
    'created_at', f.created_at,
    'updated_at', f.updated_at,
    'resolved_at', f.resolved_at,
    'timeline', coalesce((
      select json_agg(json_build_object('status', u.status, 'message', u.message, 'created_at', u.created_at)
                      order by u.created_at)
      from public.request_updates u
      where u.request_id = f.id and u.is_public
    ), '[]'::json)
  )
  from public.feedback f
  where f.reference_no = upper(trim(p_reference));
$$;
grant execute on function public.track_request(text) to anon, authenticated;

-- Public aggregate numbers for the home page / assistant (no row data).
create or replace function public.public_request_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'resolved', count(*) filter (where status in ('Resolved', 'Closed')),
    'open', count(*) filter (where status not in ('Resolved', 'Closed'))
  ) from public.feedback;
$$;
grant execute on function public.public_request_stats() to anon, authenticated;

-- ---------- 4. Notification log (written by Edge Functions) ----------
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.feedback(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  recipient text not null,
  purpose text,             -- e.g. 'acknowledgement', 'status_update', 'announcement'
  status text not null,     -- 'sent' | 'failed' | 'skipped'
  detail text,
  created_at timestamptz default now()
);
alter table public.notification_log enable row level security;
drop policy if exists "staff read notification log" on public.notification_log;
create policy "staff read notification log" on public.notification_log for select using (public.is_staff());

commit;
