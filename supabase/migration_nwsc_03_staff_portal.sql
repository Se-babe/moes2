-- ============================================================
-- NWSC conversion, step 3: staff portal & admin control
--   * staff roles linked to departments (officer / supervisor / admin)
--   * departments own request categories and a response deadline (SLA)
--   * new requests are routed to a department and auto-assigned to the
--     least-busy active officer, with a due date
--   * overdue requests escalate automatically: supervisor, then admin
--   * officers get a reminder before a deadline
--   * in-app notifications for staff
--   * row-level access: officers/supervisors see their department,
--     admins see everything; citizen contact details are never public
--
-- Run AFTER migration_nwsc_02_requests.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Departments: routing + SLA ----------
alter table public.departments
  add column if not exists categories text[] not null default '{}',
  add column if not exists sla_hours int not null default 72 check (sla_hours between 1 and 2160),
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;

update public.departments set categories = '{General}', sla_hours = 72 where name = 'Customer Service' and categories = '{}';
update public.departments set categories = '{"No Water / Supply","Leak / Burst Pipe"}', sla_hours = 24 where name = 'Water Distribution & Maintenance' and categories = '{}';
update public.departments set categories = '{"Billing & Payments"}', sla_hours = 72 where name = 'Billing & Revenue' and categories = '{}';
update public.departments set categories = '{"Water Quality"}', sla_hours = 48 where name = 'Water Quality' and categories = '{}';
update public.departments set categories = '{"Sewer & Sanitation"}', sla_hours = 48 where name = 'Sewerage Services' and categories = '{}';
update public.departments set categories = '{"New Connection"}', sla_hours = 120 where name = 'New Connections' and categories = '{}';

-- ---------- 2. Users: staff fields ----------
alter table public.users
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists job_title text,
  add column if not exists is_active boolean not null default true;

-- Role helpers (security definer = no RLS recursion)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin' and coalesce(is_active, true));
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('officer', 'supervisor', 'admin') and coalesce(is_active, true)
  );
$$;

create or replace function public.my_department()
returns uuid language sql stable security definer set search_path = public as $$
  select department_id from public.users where id = auth.uid();
$$;

-- Only an admin may change roles, departments or deactivate accounts.
create or replace function public.guard_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.role, 'citizen') not in ('citizen', 'business', 'community_leader') then
      new.role := 'citizen';
    end if;
    new.department_id := null;
    new.is_active := true;
  elsif new.role is distinct from old.role
     or new.department_id is distinct from old.department_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Only an administrator can change roles, departments or account status';
  end if;
  return new;
end;
$$;

-- Users are no longer world-readable (phone numbers and emails).
drop policy if exists "public read" on public.users;
drop policy if exists "self, staff or admin read" on public.users;
create policy "self, staff or admin read" on public.users for select using (
  id = auth.uid()
  or public.is_admin()
  or (public.is_staff() and role in ('officer', 'supervisor', 'admin'))
);

-- ---------- 3. Requests: assignment, priority, deadlines ----------
alter table public.feedback
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists assigned_to uuid references public.users(id) on delete set null,
  add column if not exists priority text not null default 'Normal',
  add column if not exists due_at timestamptz,
  add column if not exists escalation_level int not null default 0,
  add column if not exists escalated_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists reminded_at timestamptz;

alter table public.feedback drop constraint if exists feedback_priority_check;
alter table public.feedback add constraint feedback_priority_check
  check (priority in ('Low', 'Normal', 'High', 'Urgent'));

create index if not exists feedback_assigned_idx on public.feedback (assigned_to, status);
create index if not exists feedback_department_idx on public.feedback (department_id, status);
create index if not exists feedback_due_idx on public.feedback (due_at) where status not in ('Resolved', 'Closed');

create or replace function public.can_access_request(p_department uuid, p_assignee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.is_staff() and (p_assignee = auth.uid() or (p_department is not null and p_department = public.my_department())));
$$;

-- Least-busy active officer in a department (ties broken randomly).
create or replace function public.pick_officer(p_department uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
  from public.users u
  where u.department_id = p_department and u.role = 'officer' and u.is_active
  order by (
    select count(*) from public.feedback f
    where f.assigned_to = u.id and f.status not in ('Resolved', 'Closed')
  ), random()
  limit 1;
$$;

-- Runs before feedback_before_write (triggers fire in name order).
create or replace function public.feedback_route()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sla int;
begin
  if new.department_id is null then
    select id into new.department_id from public.departments
    where is_active and new.category = any(categories)
    order by display_order limit 1;
  end if;
  if new.department_id is null then
    select id into new.department_id from public.departments
    where is_active order by (name = 'Customer Service') desc, display_order limit 1;
  end if;

  if new.priority = 'Normal' and new.request_type = 'Complaint'
     and new.category in ('Leak / Burst Pipe', 'No Water / Supply') then
    new.priority := 'High';
  end if;

  select sla_hours into v_sla from public.departments where id = new.department_id;
  v_sla := coalesce(v_sla, 72);
  if new.due_at is null then
    new.due_at := now() + make_interval(hours => case
      when new.priority = 'Urgent' then greatest(v_sla / 4, 2)
      when new.priority = 'High' then greatest(v_sla / 2, 4)
      else v_sla end);
  end if;

  if new.assigned_to is null and new.department_id is not null then
    new.assigned_to := public.pick_officer(new.department_id);
  end if;
  if new.assigned_to is not null and new.status = 'Submitted' then
    new.status := 'Assigned';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_a_route on public.feedback;
create trigger feedback_a_route before insert on public.feedback
  for each row execute function public.feedback_route();

-- ---------- 4. In-app notifications for staff ----------
create or replace function public.notify_user(p_user uuid, p_title text, p_message text, p_type text, p_screen text, p_target uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, message, type, target_screen, target_id)
  select p_user, p_title, p_message, p_type, p_screen, p_target where p_user is not null;
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- Replaces the old client-side "look up an admin id, then insert" pattern,
-- which stops working once users are private.
create or replace function public.notify_admins(p_title text, p_message text, p_type text, p_screen text, p_target uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, message, type, target_screen, target_id)
  select id, left(p_title, 200), left(p_message, 1000), left(p_type, 50), left(p_screen, 50), p_target
  from public.users where role = 'admin' and is_active;
$$;
grant execute on function public.notify_admins(text, text, text, text, uuid) to anon, authenticated;

drop policy if exists "notification targets a real admin" on public.notifications;
drop policy if exists "owner or admin read" on public.notifications;
drop policy if exists "owner reads own notifications" on public.notifications;
create policy "owner reads own notifications" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "authenticated can update notifications" on public.notifications;
drop policy if exists "owner updates own notifications" on public.notifications;
create policy "owner updates own notifications" on public.notifications for update using (user_id = auth.uid());

-- Timeline + notifications on every insert / change.
create or replace function public.feedback_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dept text;
begin
  if tg_op = 'INSERT' then
    insert into public.request_updates (request_id, status, message, author_id)
    values (new.id, 'Submitted',
            'We have received your ' || lower(new.request_type) || '. Reference: ' || new.reference_no || '.', null);
    select name into v_dept from public.departments where id = new.department_id;
    if v_dept is not null then
      insert into public.request_updates (request_id, status, message, author_id)
      values (new.id, new.status, 'Your request has been passed to our ' || v_dept || ' team.', null);
    end if;
    perform public.notify_user(new.assigned_to, 'New request assigned: ' || new.reference_no,
      new.title, 'assignment', 'StaffRequest', new.id);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.request_updates (request_id, status, message, author_id)
    values (new.id, new.status, 'Status changed to ' || new.status || '.', auth.uid());
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public.notify_user(new.assigned_to, 'Request assigned to you: ' || new.reference_no,
      new.title, 'assignment', 'StaffRequest', new.id);
  end if;
  return null;
end;
$$;

-- ---------- 5. Access rules ----------
drop policy if exists "staff read requests" on public.feedback;
drop policy if exists "staff read scoped requests" on public.feedback;
create policy "staff read scoped requests" on public.feedback for select
  using (public.can_access_request(department_id, assigned_to));

drop policy if exists "staff update requests" on public.feedback;
drop policy if exists "staff update scoped requests" on public.feedback;
create policy "staff update scoped requests" on public.feedback for update
  using (public.can_access_request(department_id, assigned_to))
  with check (public.is_staff());

drop policy if exists "staff read updates" on public.request_updates;
drop policy if exists "staff read scoped updates" on public.request_updates;
create policy "staff read scoped updates" on public.request_updates for select using (
  exists (select 1 from public.feedback f where f.id = request_id and public.can_access_request(f.department_id, f.assigned_to))
);
drop policy if exists "staff add updates" on public.request_updates;
drop policy if exists "staff add scoped updates" on public.request_updates;
create policy "staff add scoped updates" on public.request_updates for insert with check (
  author_id = auth.uid()
  and exists (select 1 from public.feedback f where f.id = request_id and public.can_access_request(f.department_id, f.assigned_to))
);

drop policy if exists "staff read notification log" on public.notification_log;
drop policy if exists "scoped read notification log" on public.notification_log;
create policy "scoped read notification log" on public.notification_log for select using (
  public.is_admin()
  or exists (select 1 from public.feedback f where f.id = request_id and public.can_access_request(f.department_id, f.assigned_to))
);

-- ---------- 6. Escalation & reminders ----------
create or replace function public.escalate_overdue_requests()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  v_level int;
  v_notified int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can run escalation manually';
  end if;

  for r in
    select f.id, f.reference_no, f.title, f.department_id, f.escalation_level, coalesce(d.sla_hours, 72) as sla
    from public.feedback f
    left join public.departments d on d.id = f.department_id
    where f.status not in ('Resolved', 'Closed') and f.due_at < now() and f.escalation_level < 2
    for update of f skip locked
  loop
    v_level := r.escalation_level + 1;
    update public.feedback
      set escalation_level = v_level, status = 'Escalated', escalated_at = now(), reminded_at = null,
          due_at = now() + make_interval(hours => greatest(r.sla / 2, 4))
      where id = r.id;
    insert into public.request_updates (request_id, status, message, is_public, author_id)
      values (r.id, 'Escalated',
              'Automatically escalated to level ' || v_level || ' — the response deadline was missed.', false, null);

    v_notified := 0;
    if v_level = 1 then
      insert into public.notifications (user_id, title, message, type, target_screen, target_id)
      select u.id, 'Escalated: ' || r.reference_no, 'Overdue — ' || r.title, 'escalation', 'StaffRequest', r.id
      from public.users u
      where u.role = 'supervisor' and u.is_active and u.department_id = r.department_id;
      get diagnostics v_notified = row_count;
    end if;
    if v_level >= 2 or v_notified = 0 then
      insert into public.notifications (user_id, title, message, type, target_screen, target_id)
      select u.id, 'Escalated (level ' || v_level || '): ' || r.reference_no, 'Overdue — ' || r.title, 'escalation', 'StaffRequest', r.id
      from public.users u where u.role = 'admin' and u.is_active;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.escalate_overdue_requests() to authenticated;

create or replace function public.remind_due_requests()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with due as (
    update public.feedback f set reminded_at = now()
    where f.status not in ('Resolved', 'Closed') and f.assigned_to is not null and f.reminded_at is null
      and f.due_at between now() and now() + interval '12 hours'
    returning f.id, f.assigned_to, f.reference_no, f.title, f.due_at
  )
  insert into public.notifications (user_id, title, message, type, target_screen, target_id)
  select assigned_to, 'Due soon: ' || reference_no,
         title || ' — due ' || to_char(due_at at time zone 'Africa/Kampala', 'DD Mon HH24:MI'),
         'reminder', 'StaffRequest', id
  from due;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.remind_due_requests() from public, anon, authenticated;

-- Schedule both jobs (pg_cron). If pg_cron isn't available, enable it under
-- Database → Extensions and re-run this block.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('nwsc-escalate', 'nwsc-remind');
  perform cron.schedule('nwsc-escalate', '*/15 * * * *', 'select public.escalate_overdue_requests()');
  perform cron.schedule('nwsc-remind', '5 * * * *', 'select public.remind_due_requests()');
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;

-- ---------- 7. Forum author names (users are no longer public) ----------
alter table public.forum_topics add column if not exists author_name text;
alter table public.forum_posts add column if not exists author_name text;

create or replace function public.set_author_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(full_name, ''), 'Community member') into new.author_name
  from public.users where id = new.user_id;
  return new;
end;
$$;
drop trigger if exists forum_topics_author on public.forum_topics;
create trigger forum_topics_author before insert on public.forum_topics
  for each row execute function public.set_author_name();
drop trigger if exists forum_posts_author on public.forum_posts;
create trigger forum_posts_author before insert on public.forum_posts
  for each row execute function public.set_author_name();

update public.forum_topics t set author_name = coalesce(nullif(u.full_name, ''), 'Community member')
  from public.users u where u.id = t.user_id and t.author_name is null;
update public.forum_posts p set author_name = coalesce(nullif(u.full_name, ''), 'Community member')
  from public.users u where u.id = p.user_id and p.author_name is null;

-- ---------- 8. Staff/admin reporting view of the workload ----------
create or replace function public.staff_workload()
returns table (user_id uuid, full_name text, role text, department text, open_count bigint, overdue_count bigint)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name, u.role, d.name,
         count(f.id) filter (where f.status not in ('Resolved', 'Closed')),
         count(f.id) filter (where f.status not in ('Resolved', 'Closed') and f.due_at < now())
  from public.users u
  left join public.departments d on d.id = u.department_id
  left join public.feedback f on f.assigned_to = u.id
  where u.role in ('officer', 'supervisor', 'admin') and u.is_active
    and (public.is_admin() or (public.is_staff() and u.department_id = public.my_department()))
  group by u.id, u.full_name, u.role, d.name
  order by d.name nulls last, u.full_name;
$$;
grant execute on function public.staff_workload() to authenticated;

commit;
