-- ============================================================
-- NWSC conversion, step 13: HR has administrator powers
--   HR can do everything an administrator can (requests, announcements,
--   alerts, consultations, surveys, content, staff, departments, reports)
--   EXCEPT administrator accounts: HR cannot create, edit, deactivate or
--   demote an administrator, or make anyone an administrator.
--
--   is_admin()      = "has administrator powers" (admin or HR)
--   is_full_admin() = an actual administrator (controls admin accounts)
--
-- Run AFTER migration_nwsc_12_hr.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Who has which powers ----------
create or replace function public.is_full_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin' and coalesce(is_active, true));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'hr') and coalesce(is_active, true));
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('officer', 'supervisor', 'admin', 'hr') and coalesce(is_active, true)
  );
$$;

-- ---------- 2. Administrator accounts stay with administrators ----------
create or replace function public.guard_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_full_admin() or auth.uid() is null then
    return new;
  end if;

  if public.is_hr() then
    if tg_op = 'UPDATE' and (old.role = 'admin' or new.role = 'admin') then
      raise exception 'Only an administrator can change administrator accounts';
    end if;
    if tg_op = 'INSERT' and new.role = 'admin' then
      raise exception 'Only an administrator can create administrator accounts';
    end if;
    if tg_op = 'UPDATE' and old.id = auth.uid()
       and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'You cannot change your own role or deactivate your own account';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
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

-- Step 12's narrower HR rules are covered by the administrator policies now.
drop policy if exists "hr reads staff" on public.users;
drop policy if exists "hr updates staff" on public.users;

-- Administrators' profile photos are theirs to manage, not HR's.
drop policy if exists "staff upload own avatar" on storage.objects;
create policy "staff upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text and public.is_staff()
    or public.is_full_admin()
    or public.is_admin() and not exists (select 1 from public.users u where u.id::text = (storage.foldername(name))[1] and u.role = 'admin')));
drop policy if exists "staff update own avatar" on storage.objects;
create policy "staff update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text and public.is_staff()
    or public.is_full_admin()
    or public.is_admin() and not exists (select 1 from public.users u where u.id::text = (storage.foldername(name))[1] and u.role = 'admin')));
drop policy if exists "staff delete own avatar" on storage.objects;
create policy "staff delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text and public.is_staff()
    or public.is_full_admin()
    or public.is_admin() and not exists (select 1 from public.users u where u.id::text = (storage.foldername(name))[1] and u.role = 'admin')));

-- ---------- 3. Policies that named the admin role directly ----------
drop policy if exists "staff edit announcements" on public.announcements;
create policy "staff edit announcements" on public.announcements for update
  using (public.is_staff() and (author_id = auth.uid() or public.current_role_name() in ('supervisor', 'admin', 'hr')))
  with check (public.is_staff());

-- ---------- 4. Functions: HR reviews announcements and gets admin alerts ----------
CREATE OR REPLACE FUNCTION public.announcement_after_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dept uuid;
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    select department_id into v_dept from public.users where id = new.author_id;

    insert into public.notifications (user_id, title, message, type, target_screen, target_id)
    select u.id, 'Announcement awaiting approval', new.title, 'announcement', 'StaffPortal', new.id
    from public.users u
    where u.is_active and u.id is distinct from new.author_id
      and (u.role in ('admin', 'hr') or (u.role = 'supervisor' and u.department_id is not distinct from v_dept));

    if new.category = 'Emergency' then
      insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, subject, body, html)
      select new.id, ch.channel, ch.recipient, 'review', 1,
             'URGENT: emergency notice awaiting approval',
             left('NWSC URGENT: an emergency notice needs your approval: "' || new.title || '". Please review it now in the staff portal.', 300),
             '<p><strong>An emergency notice is waiting for your approval.</strong></p><p>' ||
               replace(replace(replace(new.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
               '</p><p>Customers are only alerted once it is approved. Please review it now in the staff portal.</p>'
      from public.users u
      cross join lateral (values ('sms', u.phone), ('email', u.email)) as ch(channel, recipient)
      where u.is_active and u.id is distinct from new.author_id and ch.recipient is not null and ch.recipient <> ''
        and (u.role in ('admin', 'hr') or (u.role = 'supervisor' and u.department_id is not distinct from v_dept))
      on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    end if;
  end if;

  -- Went live: queue every alert and social post.
  if new.status = 'published' and new.notified_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.enqueue_announcement(new.id);
  end if;

  if tg_op = 'UPDATE' then
    -- Taken down before everything went out: stop what's still waiting.
    if old.status = 'published' and new.status <> 'published' then
      update public.notification_outbox set status = 'cancelled', updated_at = now()
      where announcement_id = new.id and status = 'queued';
    -- Interruption moved: move its reminders too.
    elsif new.status = 'published' and new.starts_at is distinct from old.starts_at then
      if new.starts_at is null or public.reminder_time(new.starts_at) <= now() then
        update public.notification_outbox set status = 'cancelled', updated_at = now()
        where announcement_id = new.id and purpose = 'reminder' and status = 'queued';
      else
        update public.notification_outbox
          set not_before = case when channel in ('sms', 'whatsapp') and new.category <> 'Emergency'
                                then public.after_quiet_hours(public.reminder_time(new.starts_at))
                                else public.reminder_time(new.starts_at) end,
              updated_at = now()
        where announcement_id = new.id and purpose = 'reminder' and status = 'queued';
      end if;
    end if;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.announcement_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text := public.current_role_name();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), 'NWSC staff') into new.author_name from public.users where id = new.author_id;
  end if;
  if new.category = 'Emergency' then
    new.notify_sms := true;
    new.notify_social := true;
  end if;
  if new.category <> 'Planned interruption' then
    new.starts_at := null;
  end if;
  if auth.uid() is null then
    return new; -- scheduler / service role
  end if;
  if coalesce(v_role, '') not in ('supervisor', 'admin', 'hr') then
    if new.status not in ('draft', 'pending') then
      raise exception 'Only supervisors and administrators can publish announcements';
    end if;
    if tg_op = 'UPDATE' and old.status not in ('draft', 'pending', 'rejected') then
      raise exception 'This announcement has already been reviewed; ask a supervisor to change it';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.escalate_overdue_requests()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      from public.users u where u.role in ('admin', 'hr') and u.is_active;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.feedback_unassigned_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.assigned_to is null then
    insert into public.notifications (user_id, title, message, type, target_screen, target_id)
    select u.id, 'Needs assigning: ' || new.reference_no,
           new.title || ' — no active staff in ' || coalesce((select name from public.departments where id = new.department_id), 'any department') || '. Please assign it.',
           'assignment', 'StaffRequest', new.id
    from public.users u where u.role in ('admin', 'hr') and u.is_active;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins(p_title text, p_message text, p_type text, p_screen text, p_target uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications (user_id, title, message, type, target_screen, target_id)
  select id, left(p_title, 200), left(p_message, 1000), left(p_type, 50), left(p_screen, 50), p_target
  from public.users where role in ('admin', 'hr') and is_active;
$function$;

CREATE OR REPLACE FUNCTION public.review_announcement(p_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.announcements;
  v_role text := public.current_role_name();
  v_status text;
begin
  if coalesce(v_role, '') not in ('supervisor', 'admin', 'hr') or not public.is_staff() then
    raise exception 'Only supervisors and administrators can review announcements';
  end if;
  select * into a from public.announcements where id = p_id for update;
  if not found then raise exception 'Announcement not found'; end if;
  if a.author_id = auth.uid() and v_role not in ('admin', 'hr') then
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
$function$;

notify pgrst, 'reload schema';

commit;
