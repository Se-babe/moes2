-- ============================================================
-- NWSC conversion, step 8: staff profiles and settings
--   * profile pictures (users.avatar_url + an "avatars" storage bucket);
--     staff manage their own, administrators can manage anyone's
--   * personal preferences for the staff portal (users.preferences)
--   * storage clean-up: visitors could overwrite or delete homepage
--     slides and complaint photos; uploads are now add-only for the
--     public and everything else is admin-only
--
-- Run AFTER migration_nwsc_07_access_control.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Profile fields ----------
alter table public.users
  add column if not exists avatar_url text,
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Staff edit their own name, phone, photo and preferences; email, role,
-- department, job title and account status stay with administrators.
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
    new.job_title := null;
    new.is_active := true;
  elsif new.role is distinct from old.role
     or new.department_id is distinct from old.department_id
     or new.is_active is distinct from old.is_active
     or new.job_title is distinct from old.job_title
     or new.email is distinct from old.email then
    raise exception 'Only an administrator can change roles, departments, job titles, email or account status';
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

-- ---------- 2. Avatars bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files live at avatars/<user id>/<file>. Active staff write only their own
-- folder; administrators can manage every folder.
drop policy if exists "staff upload own avatar" on storage.objects;
create policy "staff upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff update own avatar" on storage.objects;
create policy "staff update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff delete own avatar" on storage.objects;
create policy "staff delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (public.is_admin() or (public.is_staff() and (storage.foldername(name))[1] = auth.uid()::text)));
drop policy if exists "staff list avatars" on storage.objects;
create policy "staff list avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_staff());

-- ---------- 3. Other buckets: add-only for the public ----------
drop policy if exists "Give public access to slides" on storage.objects;
drop policy if exists "Give public access to feedback_images" on storage.objects;
drop policy if exists "Give public access to consultation_images" on storage.objects;
drop policy if exists "Give users access to consultation_images" on storage.objects;

-- Complaint photos: anyone may add one (the complaint form), nobody but an
-- administrator may change or remove them.
drop policy if exists "public adds feedback photos" on storage.objects;
create policy "public adds feedback photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'feedback_images');
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  where id = 'feedback_images';

drop policy if exists "admin manages site images" on storage.objects;
create policy "admin manages site images" on storage.objects for all to authenticated
  using (bucket_id in ('slides', 'consultation_images', 'feedback_images') and public.is_admin())
  with check (bucket_id in ('slides', 'consultation_images', 'feedback_images') and public.is_admin());

notify pgrst, 'reload schema';

commit;
