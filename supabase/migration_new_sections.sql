-- ============================================================
-- MoES e-Participation — new sections migration
-- Adds: Opportunities, Projects, About (Leadership/Departments),
-- Institutions, Information Systems directory, News feed, and
-- Discussion Forums.
--
-- Run this in the SAME Supabase project as schema.sql (Dashboard ->
-- SQL Editor -> New query -> paste -> Run). Safe to run once; uses
-- `if not exists` throughout.
-- ============================================================

-- ---------- Opportunities (Jobs, Scholarships, Tenders, Loans, Admissions) ----------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('Job','Scholarship','Tender','Loan','Admission','TVET')),
  description text,
  organization text,
  deadline date,
  apply_url text,
  file_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- Projects (Upcoming / Ongoing / Completed) ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'Upcoming' check (status in ('Upcoming','Ongoing','Completed')),
  image_url text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ---------- About: Leadership ----------
create table if not exists public.leadership (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  bio text,
  photo_url text,
  display_order int default 0
);

-- ---------- About: Departments ----------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  display_order int default 0
);

-- ---------- Autonomous institutions directory ----------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  url text,
  logo_url text,
  display_order int default 0
);

-- ---------- Information Systems directory (external portal links) ----------
create table if not exists public.info_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  url text,
  icon text,
  display_order int default 0
);

-- ---------- News feed ----------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  image_url text,
  published_date date default current_date,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- Discussion Forums ----------
create table if not exists public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  user_id uuid references public.users(id) on delete set null,
  reply_count int default 0,
  created_at timestamptz default now()
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.forum_topics(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.opportunities enable row level security;
alter table public.projects enable row level security;
alter table public.leadership enable row level security;
alter table public.departments enable row level security;
alter table public.institutions enable row level security;
alter table public.info_systems enable row level security;
alter table public.news enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

-- Public read on everything (all browsed unauthenticated, same as existing content tables)
create policy "public read" on public.opportunities for select using (true);
create policy "public read" on public.projects for select using (true);
create policy "public read" on public.leadership for select using (true);
create policy "public read" on public.departments for select using (true);
create policy "public read" on public.institutions for select using (true);
create policy "public read" on public.info_systems for select using (true);
create policy "public read" on public.news for select using (true);
create policy "public read" on public.forum_topics for select using (true);
create policy "public read" on public.forum_posts for select using (true);

-- Admin-only content management (reuses is_admin() from schema.sql)
create policy "admin writes opportunities" on public.opportunities for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes projects" on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes leadership" on public.leadership for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes departments" on public.departments for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes institutions" on public.institutions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes info_systems" on public.info_systems for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes news" on public.news for all using (public.is_admin()) with check (public.is_admin());

-- Forums: any logged-in citizen can start a topic / reply (mirrors comments on Consultations)
create policy "logged-in users start topics" on public.forum_topics for insert with check (auth.uid() = user_id);
create policy "logged-in users reply" on public.forum_posts for insert with check (auth.uid() = user_id);
create policy "admin moderates topics" on public.forum_topics for delete using (public.is_admin());
create policy "admin moderates posts" on public.forum_posts for delete using (public.is_admin());

-- ============================================================
-- Seed data — enough that these sections aren't empty on first load.
-- Content pulled/adapted from the real MoES site (education.go.ug) for realism.
-- ============================================================
insert into public.departments (name, description, icon, display_order) values
  ('Higher Education Students Financing', 'Administers student loans and financing for higher education.', 'school-outline', 1),
  ('Education Standards', 'Sets and enforces quality standards across the education sector.', 'ribbon-outline', 2),
  ('Guidance & Counseling', 'Provides guidance and counseling support services to learners.', 'people-outline', 3),
  ('Health Education', 'Coordinates health education programs in schools.', 'medkit-outline', 4),
  ('Physical Education & Sports', 'Promotes physical education and sports development.', 'football-outline', 5),
  ('Private Schools', 'Regulates and supports private education institutions.', 'business-outline', 6),
  ('Pre-Primary & Primary', 'Oversees pre-primary and primary education policy.', 'book-outline', 7),
  ('Secondary Education', 'Oversees secondary education policy and standards.', 'library-outline', 8)
on conflict do nothing;

insert into public.institutions (name, description, url, display_order) values
  ('Uganda National Examinations Board', 'Conducts national examinations across all education levels.', 'https://www.uneb.ac.ug', 1),
  ('National Council for Higher Education', 'Regulates and licenses higher education institutions.', 'https://unche.or.ug', 2),
  ('National Council of Sports', 'Coordinates national sports development programs.', 'https://ncs.go.ug', 3)
on conflict do nothing;

insert into public.info_systems (name, description, url, icon, display_order) values
  ('EMIS', 'Education Management Information System — national school data.', 'https://emis.go.ug', 'stats-chart-outline', 1),
  ('TELA', 'Teacher licensing and accreditation portal.', 'https://telaschool.org', 'card-outline', 2),
  ('TMIS', 'Teacher Management Information System.', 'https://tmis.go.ug', 'people-circle-outline', 3),
  ('TVET MIS', 'Technical and Vocational Education & Training management system.', 'https://tvet.go.ug', 'construct-outline', 4),
  ('ULEARN', 'Online learning platform for Ugandan students.', 'https://ulearn4u.net', 'laptop-outline', 5),
  ('School Health', 'School health monitoring and reporting system.', '#', 'medkit-outline', 6),
  ('Digital Repository', 'Archive of MoES publications and research.', '#', 'file-tray-full-outline', 7),
  ('Online Public Access Catalogue', 'Searchable catalogue of MoES library resources.', '#', 'search-outline', 8)
on conflict do nothing;

insert into public.opportunities (title, type, organization, description, deadline, is_active) values
  ('Serbia Government Scholarship 2026', 'Scholarship', 'Government of Serbia', 'Fully-funded undergraduate and postgraduate scholarships for Ugandan students.', '2026-10-31', true),
  ('Egypt–Uganda Scholarship Program', 'Scholarship', 'Government of Egypt', 'Scholarships for study at Egyptian public universities.', '2026-11-15', true),
  ('MoES Procurement of School Furniture', 'Tender', 'Ministry of Education and Sports', 'Supply and delivery of desks and chairs to primary schools nationwide.', '2026-09-30', true),
  ('Education Officer — Kampala', 'Job', 'Ministry of Education and Sports', 'Vacancy for an Education Officer in the Secondary Education department.', '2026-09-15', true)
on conflict do nothing;

insert into public.projects (title, description, status) values
  ('Uganda Learning Acceleration Program', 'Accelerating foundational literacy and numeracy outcomes nationwide.', 'Upcoming'),
  ('Uganda Skills Development in Refugee Settlements', 'Expanding vocational training access in refugee-hosting districts.', 'Upcoming'),
  ('Secondary Education Expansion Project', 'Building and equipping new secondary schools across underserved districts.', 'Ongoing'),
  ('Uganda Learning Campaign', 'National campaign to promote learning continuity and school retention.', 'Ongoing'),
  ('Education Policy Review Commission', 'Comprehensive review of national education policy frameworks.', 'Completed')
on conflict do nothing;

insert into public.news (title, summary, published_date) values
  ('MoES Distributes Library Grants to 200 Schools', 'New grants aim to strengthen reading culture in primary schools.', current_date - 3),
  ('Science Mini-Laboratories Rolled Out Nationwide', 'Portable science labs delivered to rural secondary schools.', current_date - 7),
  ('Science Kits Distributed to Primary Schools', 'Hands-on science kits to boost STEM learning at primary level.', current_date - 10)
on conflict do nothing;

-- Extend the existing `resources` table with real-feeling seed content for
-- Policies, Circulars & Reports, and School Calendars — no schema change
-- needed there, it already supports arbitrary categories.
insert into public.resources (title, description, category) values
  ('The Early Childhood Care and Education Policy 2025', 'National policy guiding early childhood care and education.', 'Policies'),
  ('The National Education and Training For Health Policy', 'Policy framework for health-related education and training.', 'Policies'),
  ('Circular 05/2026 — School Fees Guidelines', 'Official circular on school fees structure for 2026.', 'Circulars'),
  ('Education Sector Performance Report 2025', 'Annual report on education sector performance.', 'Reports'),
  ('2026 School Calendar — Term Dates', 'Official term dates and school calendar for the 2026 academic year.', 'School Calendar')
on conflict do nothing;
