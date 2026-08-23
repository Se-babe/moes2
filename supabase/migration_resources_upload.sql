-- Resources upload: admin-only uploads of circulars/policies/reports (PDFs
-- etc.), public download-only. The public.resources table and its
-- "admin writes resources" RLS policy already exist in schema.sql — this
-- migration only adds the storage bucket the new AdminResources.js screen
-- uploads into.

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

create policy "public read resources" on storage.objects
  for select using (bucket_id = 'resources');
create policy "admin uploads resources" on storage.objects
  for insert with check (bucket_id = 'resources' and public.is_admin());
create policy "admin deletes resources objects" on storage.objects
  for delete using (bucket_id = 'resources' and public.is_admin());
