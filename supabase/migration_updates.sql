-- Platform changelog: a lightweight, admin-authored timeline of updates
-- about the ministry/platform (features, policy changes, announcements,
-- maintenance notices) — distinct from News, which is photo-story/impact
-- content. Public read-only, admin-authored via AdminSimpleList.

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'Announcement' check (category in ('Announcement', 'Feature', 'Policy', 'Maintenance')),
  created_at timestamptz default now()
);

alter table public.updates enable row level security;

create policy "public read" on public.updates for select using (true);
create policy "admin writes updates" on public.updates
  for all using (public.is_admin()) with check (public.is_admin());
