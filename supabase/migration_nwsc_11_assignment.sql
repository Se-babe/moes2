-- ============================================================
-- NWSC conversion, step 11: no request left without an owner
--   * automatic assignment falls back to the department's supervisor when
--     it has no active officer
--   * if a department has no active staff at all, administrators are told
--     straight away so they can assign the request by hand
--
-- Run AFTER migration_nwsc_10_requirements_gaps.sql. Safe to re-run.
-- ============================================================

begin;

create or replace function public.pick_officer(p_department uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
  from public.users u
  where u.department_id = p_department and u.role in ('officer', 'supervisor') and u.is_active
  order by (u.role = 'officer') desc,
           (select count(*) from public.feedback f
            where f.assigned_to = u.id and f.status not in ('Resolved', 'Closed')),
           random()
  limit 1;
$$;
revoke execute on function public.pick_officer(uuid) from public, anon, authenticated;

create or replace function public.feedback_unassigned_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is null then
    insert into public.notifications (user_id, title, message, type, target_screen, target_id)
    select u.id, 'Needs assigning: ' || new.reference_no,
           new.title || ' — no active staff in ' || coalesce((select name from public.departments where id = new.department_id), 'any department') || '. Please assign it.',
           'assignment', 'StaffRequest', new.id
    from public.users u where u.role = 'admin' and u.is_active;
  end if;
  return null;
end;
$$;
drop trigger if exists feedback_unassigned_alert on public.feedback;
create trigger feedback_unassigned_alert after insert on public.feedback
  for each row execute function public.feedback_unassigned_alert();

notify pgrst, 'reload schema';

commit;
