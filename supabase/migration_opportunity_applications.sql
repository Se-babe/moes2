-- ============================================================
-- Opportunity applications — lets citizens apply in-app to a posted
-- opportunity (job/scholarship/tender/etc.) and lets MoES staff see
-- who applied, without needing a separate document/CV upload flow.
-- ============================================================
create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'New' check (status in ('New','Reviewed','Contacted')),
  created_at timestamptz default now()
);

alter table public.opportunity_applications enable row level security;

-- Anyone can apply (matches feedback's anonymous-submission precedent — no
-- login required to apply to a job/scholarship/tender posting).
create policy "anyone can apply" on public.opportunity_applications
  for insert with check (true);

-- Only MoES admin can see who applied and update review status.
create policy "admin reads applications" on public.opportunity_applications
  for select using (public.is_admin());
create policy "admin updates applications" on public.opportunity_applications
  for update using (public.is_admin()) with check (public.is_admin());
