-- ============================================================
-- Role-based admin access — replaces the hardcoded admin email
-- check with a real `role = 'admin'` check on public.users, so
-- admin status can be granted/revoked through the new Users
-- management screen instead of being baked into the app code.
-- ============================================================

-- is_admin() is already used by every admin-only RLS policy across
-- the app (opportunities, content tables, forum moderation, feedback
-- status, consultation approval, etc.) — replacing its body here
-- automatically updates all of them in one shot.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- Previously only a user could update their own row (self-signup,
-- profile edits). Admin now also needs to update OTHER users' roles
-- from the new Users management screen.
create policy "admin updates any user" on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- One-time: promote the account you're actually going to use as
-- admin. Only takes effect once that account has signed up (i.e. a
-- row already exists in public.users with this email) — if it
-- hasn't yet, sign up first, then re-run just this line.
update public.users set role = 'admin' where email = 'sebabeabdu9@gmail.com';
