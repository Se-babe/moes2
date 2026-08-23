-- ============================================================
-- MoES e-Participation — full schema
-- Run this once in a NEW Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- Reconstructed from how the app code queries Supabase, since the
-- original project's schema/migrations were never checked in and
-- the original project is no longer reachable.
-- ============================================================

-- ---------- users (public profile mirror of auth.users) ----------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text default 'citizen',
  created_at timestamptz default now()
);

-- ---------- reference / admin-managed content ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text
);

create table if not exists public.settings (
  key text primary key,
  value text
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  name text,
  icon_name text,
  color text,
  url text,
  enabled boolean default true,
  display_order int default 0
);

create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  title text,
  subtitle text,
  quote text,
  display_order int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  created_at timestamptz default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  file_url text,
  created_at timestamptz default now()
);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  end_date date,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  response text not null,
  keywords text[] not null default '{}'
);

-- ---------- consultations + engagement ----------
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  closing_date date,
  proposer_email text,
  proposer_phone text,
  image_url text,
  is_active boolean default false,
  poll_votes_count int default 0,
  engagement_score numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete cascade,
  question text not null
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.polls(id) on delete cascade,
  option_text text not null,
  vote_count int default 0
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  poll_option_id uuid references public.poll_options(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, consultation_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  reaction_type text check (reaction_type in ('like','love','laugh','sad','angry')),
  created_at timestamptz default now(),
  unique (user_id, consultation_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  text text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, comment_id)
);

-- ---------- feedback (anonymous by design — see AGENTS notes) ----------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'General',
  image_url text,
  status text default 'Submitted' check (status in ('Submitted','Under Review','In Progress','Resolved')),
  user_id text, -- literal 'anonymous' string today, not a real FK — see app code
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now()
);

-- ---------- notifications (admin inbox) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text,
  message text,
  type text,
  target_screen text,
  target_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- ---------- chat ("Massa" bot — unauthenticated guest sessions) ----------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  phone text,
  email text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete cascade,
  sender text check (sender in ('user','bot')),
  message text,
  created_at timestamptz default now()
);

-- ---------- media gallery (admin-only uploads, public view-only) ----------
create table if not exists public.media_gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  display_order int default 0,
  created_at timestamptz default now()
);

-- ---------- platform changelog (admin-authored, distinct from news) ----------
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'Announcement' check (category in ('Announcement', 'Feature', 'Policy', 'Maintenance')),
  created_at timestamptz default now()
);

-- ---------- virtual town halls (admin-scheduled, external meeting link e.g. Zoom) ----------
-- Predates this session's documentation — table already existed in production
-- with real rows before schema.sql covered it; shape matched here exactly.
create table if not exists public.town_halls (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  description text,
  event_date date,
  event_time time,
  location text,
  meeting_link text,
  created_at timestamptz default now()
);

-- ============================================================
-- Admin helper: role-based (public.users.role = 'admin'), not a
-- hardcoded email — see supabase/migration_admin_roles.sql for the
-- version actually applied to the live database. Kept here too so
-- a from-scratch schema run creates it in the right shape from the
-- start.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.settings enable row level security;
alter table public.social_links enable row level security;
alter table public.slides enable row level security;
alter table public.faqs enable row level security;
alter table public.resources enable row level security;
alter table public.surveys enable row level security;
alter table public.bot_knowledge enable row level security;
alter table public.consultations enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.media_gallery enable row level security;
alter table public.updates enable row level security;
alter table public.town_halls enable row level security;

-- Public read access on everything the app browses unauthenticated
create policy "public read" on public.users for select using (true);
create policy "public read" on public.categories for select using (true);
create policy "public read" on public.settings for select using (true);
create policy "public read" on public.social_links for select using (true);
create policy "public read" on public.slides for select using (true);
create policy "public read" on public.faqs for select using (true);
create policy "public read" on public.resources for select using (true);
create policy "public read" on public.surveys for select using (true);
create policy "public read" on public.bot_knowledge for select using (true);
create policy "public read" on public.consultations for select using (true);
create policy "public read" on public.polls for select using (true);
create policy "public read" on public.poll_options for select using (true);
create policy "public read" on public.likes for select using (true);
create policy "public read" on public.comments for select using (true);
create policy "public read" on public.comment_likes for select using (true);
create policy "public read" on public.feedback for select using (true);
create policy "public read" on public.chat_sessions for select using (true);
create policy "public read" on public.chat_messages for select using (true);
create policy "public read" on public.media_gallery for select using (true);
create policy "public read" on public.updates for select using (true);
create policy "public read" on public.town_halls for select using (true);

-- notifications: admin's inbox, or the row's own recipient
create policy "owner or admin read" on public.notifications for select
  using (public.is_admin() or user_id = auth.uid());

-- Self-signup / self-profile
create policy "self insert" on public.users for insert with check (auth.uid() = id);
create policy "self update" on public.users for update using (auth.uid() = id);
create policy "admin updates any user" on public.users for update using (public.is_admin()) with check (public.is_admin());

-- Anonymous-friendly writes (match the app's actual unauthenticated flows)
-- feedback and consultations intentionally have NO client-side insert policy:
-- both go exclusively through Edge Functions (submit-feedback,
-- propose-consultation) that verify a Cloudflare Turnstile token first, then
-- write with the service role key. This is the abuse-protection fix from the
-- pre-deployment audit — see migration_abuse_protection.sql.
create policy "anyone can start a chat session" on public.chat_sessions for insert with check (true);
create policy "anyone can send a chat message" on public.chat_messages for insert with check (true);
-- every legitimate call site already looks up a real admin's id first; this
-- makes that a server-enforced rule instead of an assumption.
create policy "notification targets a real admin" on public.notifications
  for insert with check (exists (select 1 from public.users where id = user_id and role = 'admin'));

-- Logged-in engagement (likes/comments/votes require auth per app's own login checks)
create policy "logged-in users react" on public.likes for insert with check (auth.uid() = user_id);
create policy "logged-in users update own reaction" on public.likes for update using (auth.uid() = user_id);
create policy "logged-in users remove own reaction" on public.likes for delete using (auth.uid() = user_id);

create policy "logged-in users comment" on public.comments for insert with check (auth.uid() = user_id);

create policy "logged-in users like comments" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "logged-in users unlike comments" on public.comment_likes for delete using (auth.uid() = user_id);

create policy "logged-in users vote" on public.poll_votes for insert with check (auth.uid() = user_id);
create policy "logged-in users remove own vote" on public.poll_votes for delete using (auth.uid() = user_id);

-- Vote-count bookkeeping: the app increments/decrements these columns
-- client-side (no DB trigger), so any authenticated user needs UPDATE
-- on the parent rows. This is broader than ideal — see README note —
-- but matches how the client is currently written.
create policy "authenticated can update vote counts" on public.consultations
  for update using (auth.role() = 'authenticated');
create policy "authenticated can update option vote counts" on public.poll_options
  for update using (auth.role() = 'authenticated');
create policy "authenticated can update notifications" on public.notifications
  for update using (public.is_admin() or user_id = auth.uid());

-- Admin-only content management
create policy "admin writes categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes social_links" on public.social_links for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes slides" on public.slides for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes faqs" on public.faqs for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes resources" on public.resources for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes surveys" on public.surveys for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes bot_knowledge" on public.bot_knowledge for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes polls" on public.polls for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes poll_options_insert" on public.poll_options for insert with check (public.is_admin());
-- Deleting a poll cascades to poll_options and (through that) to poll_votes;
-- those cascaded deletes are still subject to each child table's own RLS, so
-- both need an explicit admin delete policy or "Delete Poll" fails midway.
create policy "admin deletes poll_options" on public.poll_options for delete using (public.is_admin());
create policy "admin deletes poll_votes" on public.poll_votes for delete using (public.is_admin());
create policy "admin approves consultations" on public.consultations for update using (auth.role() = 'authenticated');
create policy "admin deletes consultations" on public.consultations for delete using (public.is_admin());
create policy "admin writes media_gallery" on public.media_gallery for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes updates" on public.updates for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes town_halls" on public.town_halls for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage buckets (public, so getPublicUrl() works as the app expects)
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('feedback_images', 'feedback_images', true),
  ('consultation_images', 'consultation_images', true),
  ('comment_images', 'comment_images', true),
  ('slides', 'slides', true),
  ('chat_audio', 'chat_audio', true),
  ('media_gallery', 'media_gallery', true),
  ('resources', 'resources', true)
on conflict (id) do nothing;

create policy "public read feedback_images" on storage.objects for select using (bucket_id = 'feedback_images');
create policy "public read consultation_images" on storage.objects for select using (bucket_id = 'consultation_images');
create policy "public read comment_images" on storage.objects for select using (bucket_id = 'comment_images');
create policy "public read slides" on storage.objects for select using (bucket_id = 'slides');
create policy "public read chat_audio" on storage.objects for select using (bucket_id = 'chat_audio');
create policy "public read media_gallery" on storage.objects for select using (bucket_id = 'media_gallery');
create policy "public read resources" on storage.objects for select using (bucket_id = 'resources');

create policy "anyone uploads feedback_images" on storage.objects for insert with check (bucket_id = 'feedback_images');
create policy "anyone uploads consultation_images" on storage.objects for insert with check (bucket_id = 'consultation_images');
create policy "authenticated uploads comment_images" on storage.objects for insert with check (bucket_id = 'comment_images' and auth.role() = 'authenticated');
create policy "admin uploads slides" on storage.objects for insert with check (bucket_id = 'slides' and public.is_admin());
-- chat is an unauthenticated guest flow (see chat_sessions/chat_messages policies above),
-- so voice notes are uploaded without a logged-in user too.
create policy "anyone uploads chat_audio" on storage.objects for insert with check (bucket_id = 'chat_audio');
create policy "admin uploads media_gallery" on storage.objects for insert with check (bucket_id = 'media_gallery' and public.is_admin());
create policy "admin deletes media_gallery objects" on storage.objects for delete using (bucket_id = 'media_gallery' and public.is_admin());
create policy "admin uploads resources" on storage.objects for insert with check (bucket_id = 'resources' and public.is_admin());
create policy "admin deletes resources objects" on storage.objects for delete using (bucket_id = 'resources' and public.is_admin());
