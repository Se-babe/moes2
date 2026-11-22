-- ============================================================
-- NWSC conversion, step 12: Human Resources role
--   HR manages the workforce, below the administrator:
--   * staff accounts: add (invite), edit, move department, change role
--     between officer / supervisor / HR, deactivate, profile photos
--   * departments and request routing (SLA targets, categories)
--   * team performance (workload, resolution times, satisfaction)
--   * a record of every staff change (who changed what, when)
--   HR cannot touch administrator accounts or make anyone an
--   administrator, and does not see citizens' requests or contact details.
--
-- Run AFTER migration_nwsc_11_assignment.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Who is HR ----------
create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'hr' and coalesce(is_active, true));
$$;

-- Administrators and HR both manage staff.
create or replace function public.can_manage_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_hr();
$$;

-- ---------- 2. Staff accounts ----------
drop policy if exists "hr reads staff" on public.users;
create policy "hr reads staff" on public.users for select
  using (public.is_hr() and role in ('officer', 'supervisor', 'hr', 'admin'));

drop policy if exists "hr updates staff" on public.users;
create policy "hr updates staff" on public.users for update
  using (public.is_hr() and role in ('officer', 'supervisor', 'hr'))
  with check (public.is_hr() and role in ('officer', 'supervisor', 'hr'));

-- Field rules (same as step 8 for everyone else, plus HR's limits).
create or replace function public.guard_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if public.is_hr() and tg_op = 'UPDATE' and old.id <> auth.uid() then
    if old.role not in ('officer', 'supervisor', 'hr') or new.role not in ('officer', 'supervisor', 'hr') then
      raise exception 'HR can manage officers, supervisors and HR staff only — ask an administrator';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email addresses are changed by an administrator';
    end if;
    if new.role in ('officer', 'supervisor') and new.department_id is null then
      raise exception 'Officers and supervisors need a department';
    end if;
  elsif tg_op = 'INSERT' then
    if coalesce(new.role, 'citizen') not in ('citizen', 'business', 'community_leader') then
      new.role := 'citizen';
    end if;
    new.department_id := null;
    new.job_title := null;
    new.is_active := true;
  elsif new.role is distinct from old.role
     or new.department_id is distinct from old.department_id
     or new.is_active is distinct from old.is_active
     or new.job_title is distinct from old.job_title
     or new.email is distinct from old.email then
    raise exception 'Only an administrator or HR can change roles, departments, job titles, email or account status';
  end if;

  if new.avatar_url is not null and new.avatar_url !~ '^https://[^ ]+/storage/v1/object/public/avatars/' then
    raise exception 'Profile pictures must be uploaded through the app';
  end if;
  if jsonb_typeof(new.preferences) <> 'object' or length(new.preferences::text) > 2000 then
    raise exception 'Invalid preferences';
  end if;
  return new;
end;
$$;

-- Profile photos: HR may set them for staff, like administrators.
drop policy if exists "staff upload own avatar" on storage.objects;
create policy "staff upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (public.can_manage_staff() or ((public.is_staff() or public.is_hr()) and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff update own avatar" on storage.objects;
create policy "staff update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (public.can_manage_staff() or ((public.is_staff() or public.is_hr()) and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff delete own avatar" on storage.objects;
create policy "staff delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (public.can_manage_staff() or ((public.is_staff() or public.is_hr()) and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff list avatars" on storage.objects;
create policy "staff list avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (public.is_staff() or public.is_hr()));

-- ---------- 3. Departments and routing ----------
drop policy if exists "hr writes departments" on public.departments;
create policy "hr writes departments" on public.departments for all
  using (public.is_hr()) with check (public.is_hr());

-- ---------- 4. Record of staff changes ----------
create table if not exists public.staff_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  user_name text,
  changed_by uuid references public.users(id) on delete set null,
  changed_by_name text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists staff_changes_recent_idx on public.staff_changes (created_at desc);
alter table public.staff_changes enable row level security;
drop policy if exists "admin and hr read staff changes" on public.staff_changes;
create policy "admin and hr read staff changes" on public.staff_changes for select using (public.can_manage_staff());

create or replace function public.record_staff_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_by text := (select coalesce(nullif(full_name, ''), email) from public.users where id = auth.uid());
  v_name text := coalesce(nullif(new.full_name, ''), new.email);
  dept_old text; dept_new text;
begin
  if tg_op = 'INSERT' then
    if new.role in ('officer', 'supervisor', 'hr', 'admin') then
      insert into public.staff_changes (user_id, user_name, changed_by, changed_by_name, field, new_value)
      values (new.id, v_name, auth.uid(), v_by, 'added', new.role);
    end if;
    return null;
  end if;
  if not (old.role in ('officer', 'supervisor', 'hr', 'admin') or new.role in ('officer', 'supervisor', 'hr', 'admin')) then
    return null;
  end if;
  if new.role is distinct from old.role then
    insert into public.staff_changes (user_id, user_name, changed_by, changed_by_name, field, old_value, new_value)
    values (new.id, v_name, auth.uid(), v_by, 'role', old.role, new.role);
  end if;
  if new.department_id is distinct from old.department_id then
    select name into dept_old from public.departments where id = old.department_id;
    select name into dept_new from public.departments where id = new.department_id;
    insert into public.staff_changes (user_id, user_name, changed_by, changed_by_name, field, old_value, new_value)
    values (new.id, v_name, auth.uid(), v_by, 'department', dept_old, dept_new);
  end if;
  if new.is_active is distinct from old.is_active then
    insert into public.staff_changes (user_id, user_name, changed_by, changed_by_name, field, old_value, new_value)
    values (new.id, v_name, auth.uid(), v_by, 'status', case when old.is_active then 'active' else 'deactivated' end,
            case when new.is_active then 'active' else 'deactivated' end);
  end if;
  if new.job_title is distinct from old.job_title then
    insert into public.staff_changes (user_id, user_name, changed_by, changed_by_name, field, old_value, new_value)
    values (new.id, v_name, auth.uid(), v_by, 'job title', old.job_title, new.job_title);
  end if;
  return null;
end;
$$;
drop trigger if exists users_record_staff_change on public.users;
create trigger users_record_staff_change after insert or update of role, department_id, is_active, job_title on public.users
  for each row execute function public.record_staff_change();

-- ---------- 5. Team performance (no citizen details) ----------
create or replace function public.staff_performance(p_days int default 30)
returns table (
  user_id uuid, full_name text, avatar_url text, role text, job_title text, department text, is_active boolean,
  open_count bigint, overdue_count bigint, resolved_count bigint,
  avg_first_response_hours numeric, avg_resolution_hours numeric, avg_rating numeric, rated_count bigint
) language sql stable security definer set search_path = public as $$
  select u.id, u.full_name, u.avatar_url, u.role, u.job_title, d.name, u.is_active,
    count(f.id) filter (where f.status not in ('Resolved', 'Closed')),
    count(f.id) filter (where f.status not in ('Resolved', 'Closed') and f.due_at < now()),
    count(f.id) filter (where f.resolved_at > now() - make_interval(days => p_days)),
    round(avg(extract(epoch from f.first_response_at - f.created_at) / 3600)
          filter (where f.first_response_at is not null and f.created_at > now() - make_interval(days => p_days))::numeric, 1),
    round(avg(extract(epoch from f.resolved_at - f.created_at) / 3600)
          filter (where f.resolved_at > now() - make_interval(days => p_days))::numeric, 1),
    round(avg(f.satisfaction_rating) filter (where f.rated_at > now() - make_interval(days => p_days))::numeric, 2),
    count(f.id) filter (where f.rated_at > now() - make_interval(days => p_days))
  from public.users u
  left join public.departments d on d.id = u.department_id
  left join public.feedback f on f.assigned_to = u.id
  where public.can_manage_staff() and u.role in ('officer', 'supervisor')
  group by u.id, u.full_name, u.avatar_url, u.role, u.job_title, d.name, u.is_active
  order by d.name nulls last, u.full_name;
$$;
revoke execute on function public.staff_performance(int) from public, anon;
grant execute on function public.staff_performance(int) to authenticated;

-- Departments with the people who handle them, for staffing gaps.
create or replace function public.department_staffing()
returns table (department_id uuid, department text, is_active boolean, sla_hours int,
               officers bigint, supervisors bigint, open_requests bigint, unassigned_requests bigint)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, d.is_active, d.sla_hours,
    (select count(*) from public.users u where u.department_id = d.id and u.role = 'officer' and u.is_active),
    (select count(*) from public.users u where u.department_id = d.id and u.role = 'supervisor' and u.is_active),
    (select count(*) from public.feedback f where f.department_id = d.id and f.status not in ('Resolved', 'Closed')),
    (select count(*) from public.feedback f where f.department_id = d.id and f.status not in ('Resolved', 'Closed') and f.assigned_to is null)
  from public.departments d
  where public.can_manage_staff()
  order by d.display_order, d.name;
$$;
revoke execute on function public.department_staffing() from public, anon;
grant execute on function public.department_staffing() to authenticated;

notify pgrst, 'reload schema';

commit;
