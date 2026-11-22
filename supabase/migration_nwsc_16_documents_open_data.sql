-- ============================================================
-- NWSC conversion, step 16: transparency and open data
--   * document library: laws, regulations, policies, guidelines,
--     decisions, reports, tariffs and plans; searchable by title,
--     category, institution, date and subject; every revision is kept
--     as a numbered version
--   * public performance figures (no personal data) for the open
--     dashboard and downloads
--
-- Run AFTER migration_nwsc_15_training.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Document library ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 250),
  category text not null default 'Policy'
    check (category in ('Law', 'Regulation', 'Policy', 'Guideline', 'Decision', 'Report', 'Tariff', 'Plan', 'Other')),
  institution text not null default 'NWSC Jinja',
  subject text,
  summary text,
  document_date date,
  is_published boolean not null default true,
  current_version int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_search_idx on public.documents
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(summary, '')));

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  file_url text not null check (file_url ~ '^https://'),
  file_name text,
  file_size bigint,
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;

drop policy if exists "public reads published documents" on public.documents;
create policy "public reads published documents" on public.documents for select using (is_published or public.is_admin());
drop policy if exists "admin manages documents" on public.documents;
create policy "admin manages documents" on public.documents for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public reads document versions" on public.document_versions;
create policy "public reads document versions" on public.document_versions for select
  using (public.is_admin() or exists (select 1 from public.documents d where d.id = document_id and d.is_published));
-- Versions are only added through add_document_version, never edited.

-- Upload a new version; earlier versions stay available.
create or replace function public.add_document_version(p_document uuid, p_url text, p_name text, p_size bigint, p_notes text)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Only administrators and HR can publish documents'; end if;
  update public.documents set current_version = current_version + 1, updated_at = now()
  where id = p_document returning current_version into v;
  if v is null then raise exception 'Document not found'; end if;
  insert into public.document_versions (document_id, version, file_url, file_name, file_size, notes, uploaded_by, uploaded_by_name)
  values (p_document, v, p_url, p_name, p_size, nullif(trim(p_notes), ''), auth.uid(),
          (select coalesce(nullif(full_name, ''), email) from public.users where id = auth.uid()));
  return v;
end;
$$;
revoke execute on function public.add_document_version(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.add_document_version(uuid, text, text, bigint, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', true, 26214400, array[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'application/zip', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin manages documents files" on storage.objects;
create policy "admin manages documents files" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

-- ---------- 2. Public performance figures ----------
create or replace function public.public_performance(p_months int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (
    select * from public.feedback where created_at > date_trunc('month', now()) - make_interval(months => greatest(least(p_months, 36), 1) - 1)
  )
  select jsonb_build_object(
    'generated_at', now(),
    'months', p_months,
    'totals', (select jsonb_build_object(
        'received', count(*),
        'resolved', count(*) filter (where status in ('Resolved', 'Closed')),
        'open', count(*) filter (where status not in ('Resolved', 'Closed')),
        'avg_first_response_hours', round(avg(extract(epoch from first_response_at - created_at) / 3600)::numeric, 1),
        'avg_resolution_hours', round(avg(extract(epoch from resolved_at - created_at) / 3600)::numeric, 1),
        'on_time_pct', round(100.0 * count(*) filter (where resolved_at is not null and resolved_at <= due_at)
                             / nullif(count(*) filter (where resolved_at is not null), 0)),
        'satisfaction', round(avg(satisfaction_rating)::numeric, 2),
        'ratings', count(satisfaction_rating)) from f),
    'by_month', coalesce((select jsonb_agg(m order by m->>'month') from (
        select jsonb_build_object('month', to_char(g, 'YYYY-MM'),
          'received', (select count(*) from f where date_trunc('month', f.created_at) = g),
          'resolved', (select count(*) from f where date_trunc('month', f.resolved_at) = g)) m
        from generate_series(date_trunc('month', now()) - make_interval(months => greatest(least(p_months, 36), 1) - 1), date_trunc('month', now()), interval '1 month') g) x), '[]'::jsonb),
    'by_type', coalesce((select jsonb_agg(jsonb_build_object('label', request_type, 'value', n) order by n desc)
        from (select request_type, count(*) n from f group by 1) t), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('label', category, 'value', n, 'resolved', r) order by n desc)
        from (select category, count(*) n, count(*) filter (where status in ('Resolved', 'Closed')) r from f group by 1) t), '[]'::jsonb),
    'by_channel', coalesce((select jsonb_agg(jsonb_build_object('label', source, 'value', n) order by n desc)
        from (select source, count(*) n from f group by 1) t), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('label', s || ' star' || case when s = 1 then '' else 's' end, 'value', n) order by s desc)
        from (select satisfaction_rating s, count(*) n from f where satisfaction_rating is not null group by 1) t), '[]'::jsonb),
    'participation', jsonb_build_object(
        'consultations_open', (select count(*) from public.consultations where is_active),
        'surveys_open', (select count(*) from public.surveys where is_active),
        'subscribers', (select count(*) from public.alert_subscriptions where is_active),
        'announcements', (select count(*) from public.announcements where status = 'published' and published_at > now() - make_interval(months => p_months)))
  );
$$;
grant execute on function public.public_performance(int) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
