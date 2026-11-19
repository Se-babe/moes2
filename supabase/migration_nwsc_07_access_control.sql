-- ============================================================
-- NWSC conversion, step 7: tighten who can do what
--   * a deactivated account loses every staff/supervisor power
--   * consultations and polls: only administrators can edit them;
--     vote counts are kept by the database, not by the browser
--   * requests: officers and supervisors can only change what their
--     job needs; assignments stay inside the request's department
--   * deactivating or demoting a staff member hands their open
--     requests to someone else in the team
--   * internal helper functions are no longer callable from the API
--
-- Run AFTER migration_nwsc_06_inclusion.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Deactivated accounts have no role ----------
create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and coalesce(is_active, true);
$$;

create or replace function public.my_department()
returns uuid language sql stable security definer set search_path = public as $$
  select department_id from public.users where id = auth.uid() and coalesce(is_active, true);
$$;

-- ---------- 2. Consultations and polls: admin only ----------
drop policy if exists "admin approves consultations" on public.consultations;
drop policy if exists "authenticated can update vote counts" on public.consultations;
drop policy if exists "admin writes consultations" on public.consultations;
create policy "admin writes consultations" on public.consultations for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated can update option vote counts" on public.poll_options;
drop policy if exists "admin updates poll_options" on public.poll_options;
create policy "admin updates poll_options" on public.poll_options for update
  using (public.is_admin()) with check (public.is_admin());

-- Vote counts follow the poll_votes rows, whoever casts the vote.
create or replace function public.poll_vote_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set vote_count = coalesce(vote_count, 0) + 1 where id = new.poll_option_id;
    update public.consultations set poll_votes_count = coalesce(poll_votes_count, 0) + 1 where id = new.consultation_id;
    return new;
  end if;
  update public.poll_options set vote_count = greatest(coalesce(vote_count, 0) - 1, 0) where id = old.poll_option_id;
  update public.consultations set poll_votes_count = greatest(coalesce(poll_votes_count, 0) - 1, 0) where id = old.consultation_id;
  return old;
end;
$$;
drop trigger if exists poll_votes_count on public.poll_votes;
create trigger poll_votes_count after insert or delete on public.poll_votes
  for each row execute function public.poll_vote_counts();

-- Guest votes now only insert; the trigger above does the counting.
create or replace function public.cast_guest_vote(p_option uuid, p_voter_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_consultation uuid;
begin
  select p.consultation_id into v_consultation
  from public.poll_options o join public.polls p on p.id = o.poll_id where o.id = p_option;
  if v_consultation is null then raise exception 'Poll not found'; end if;
  insert into public.poll_votes (poll_option_id, consultation_id, voter_key) values (p_option, v_consultation, p_voter_key);
  return true;
exception when unique_violation then
  raise exception 'You have already voted in this poll — thank you!';
end;
$$;
revoke execute on function public.cast_guest_vote(uuid, text) from public, anon, authenticated;

-- ---------- 3. Requests: what staff may change ----------
create or replace function public.feedback_staff_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.current_role_name();
begin
  -- Service role (Edge Functions after their own checks), the scheduler and
  -- administrators are not limited here.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.reference_no is distinct from old.reference_no
     or new.user_id is distinct from old.user_id
     or new.request_type is distinct from old.request_type
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.contact_name is distinct from old.contact_name
     or new.contact_phone is distinct from old.contact_phone
     or new.contact_email is distinct from old.contact_email
     or new.satisfaction_rating is distinct from old.satisfaction_rating
     or new.satisfaction_comment is distinct from old.satisfaction_comment
     or new.rated_at is distinct from old.rated_at
     or new.created_at is distinct from old.created_at then
    raise exception 'The customer''s original request cannot be edited';
  end if;

  if new.department_id is distinct from old.department_id then
    raise exception 'Only supervisors and administrators can move a request to another department';
  end if;

  if new.due_at is distinct from old.due_at
     or new.escalation_level is distinct from old.escalation_level then
    raise exception 'Deadlines and escalation are managed by the system';
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
     and not exists (
       select 1 from public.users u
       where u.id = new.assigned_to and u.is_active
         and u.role in ('officer', 'supervisor')
         and u.department_id = new.department_id
     ) then
    raise exception 'A request can only be assigned to active staff in its own department';
  end if;

  if coalesce(v_role, '') = 'officer' and new.assigned_to is null and old.assigned_to is not null then
    raise exception 'Ask a supervisor to unassign this request';
  end if;

  return new;
end;
$$;
drop trigger if exists feedback_staff_guard on public.feedback;
create trigger feedback_staff_guard before update on public.feedback
  for each row execute function public.feedback_staff_guard();

-- ---------- 4. Deactivating / demoting staff reassigns their work ----------
create or replace function public.staff_offboard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_next uuid;
begin
  if (new.is_active is distinct from old.is_active and not coalesce(new.is_active, true))
     or (old.role in ('officer', 'supervisor') and new.role not in ('officer', 'supervisor', 'admin'))
     or (new.department_id is distinct from old.department_id and new.role in ('officer', 'supervisor')) then
    for r in
      select id, department_id from public.feedback
      where assigned_to = new.id and status not in ('Resolved', 'Closed')
    loop
      v_next := public.pick_officer(r.department_id);
      if v_next = new.id then v_next := null; end if;
      update public.feedback set assigned_to = v_next where id = r.id;
      insert into public.request_updates (request_id, status, message, is_public, author_id)
        values (r.id, null, 'Reassigned automatically because the previous officer left the team.', false, auth.uid());
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists users_staff_offboard on public.users;
create trigger users_staff_offboard after update of is_active, role, department_id on public.users
  for each row execute function public.staff_offboard();

-- ---------- 5. Internal helpers are not part of the public API ----------
revoke execute on function public.pick_officer(uuid) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.staff_workload() from public, anon;
grant execute on function public.staff_workload() to authenticated;
revoke execute on function public.review_announcement(uuid, text, text) from public, anon;
grant execute on function public.review_announcement(uuid, text, text) to authenticated;
revoke execute on function public.escalate_overdue_requests() from public, anon;
grant execute on function public.escalate_overdue_requests() to authenticated;

notify pgrst, 'reload schema';

commit;
