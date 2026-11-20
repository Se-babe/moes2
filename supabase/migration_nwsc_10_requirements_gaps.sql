-- ============================================================
-- NWSC conversion, step 10: remaining requirements
--   * offline–online integration: requests record how they came in
--     (online, phone call, walk-in, community meeting, field visit, letter,
--     social media); staff log offline ones into the same system
--   * contribution impact feedback: consultations publish "what we did
--     with your views"
--   * forum Q&A: replies from NWSC staff are marked as official answers
--   * privacy: consultation proposals are hidden until approved
--
-- Run AFTER migration_nwsc_09_citizen_notifications.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Where a request came from ----------
alter table public.feedback add column if not exists source text not null default 'Online';
alter table public.feedback drop constraint if exists feedback_source_check;
alter table public.feedback add constraint feedback_source_check
  check (source in ('Online', 'Phone call', 'Walk-in', 'Community meeting', 'Field visit', 'Letter', 'Social media'));
alter table public.feedback add column if not exists logged_by uuid references public.users(id) on delete set null;

-- Staff may not rewrite how a request arrived.
create or replace function public.feedback_source_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.source is distinct from old.source or new.logged_by is distinct from old.logged_by) then
    raise exception 'How a request was received cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_source_guard on public.feedback;
create trigger feedback_source_guard before update on public.feedback
  for each row execute function public.feedback_source_guard();

-- ---------- 2. Consultation outcomes ("you said, we did") ----------
alter table public.consultations
  add column if not exists outcome text check (outcome is null or char_length(outcome) <= 4000),
  add column if not exists outcome_at timestamptz;

create or replace function public.consultation_outcome_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.outcome, '') is distinct from coalesce(old.outcome, '') then
    new.outcome := nullif(trim(new.outcome), '');
    new.outcome_at := case when new.outcome is null then null else now() end;
  end if;
  return new;
end;
$$;
drop trigger if exists consultation_outcome_stamp on public.consultations;
create trigger consultation_outcome_stamp before update on public.consultations
  for each row execute function public.consultation_outcome_stamp();

-- ---------- 3. Official answers in the forum ----------
alter table public.forum_posts add column if not exists is_official boolean not null default false;

create or replace function public.forum_post_official()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Set by the database, never by the browser.
  new.is_official := auth.uid() is not null and public.is_staff();
  return new;
end;
$$;
drop trigger if exists forum_post_official on public.forum_posts;
create trigger forum_post_official before insert on public.forum_posts
  for each row execute function public.forum_post_official();

-- ---------- 4. Privacy: unapproved proposals stay private ----------
-- Proposals (with the proposer's phone and email) were readable by anyone
-- before approval. The public now sees live consultations and ones with a
-- published outcome; administrators see everything.
drop policy if exists "public read" on public.consultations;
drop policy if exists "public reads live consultations" on public.consultations;
create policy "public reads live consultations" on public.consultations for select
  using (is_active or outcome is not null or public.is_admin());

notify pgrst, 'reload schema';

commit;
