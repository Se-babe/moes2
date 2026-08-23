-- Media Gallery: admin-only uploads (photos/short video clips), public view-only.
-- Mirrors the slides pattern (admin CRUD + public read), extended with a
-- media_type discriminator since a gallery item can be an image or a video.

create table if not exists public.media_gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  display_order int default 0,
  created_at timestamptz default now()
);

alter table public.media_gallery enable row level security;

create policy "public read" on public.media_gallery for select using (true);
create policy "admin writes media_gallery" on public.media_gallery
  for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('media_gallery', 'media_gallery', true)
on conflict (id) do nothing;

create policy "public read media_gallery" on storage.objects
  for select using (bucket_id = 'media_gallery');
create policy "admin uploads media_gallery" on storage.objects
  for insert with check (bucket_id = 'media_gallery' and public.is_admin());
create policy "admin deletes media_gallery objects" on storage.objects
  for delete using (bucket_id = 'media_gallery' and public.is_admin());
