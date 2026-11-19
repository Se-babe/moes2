-- ============================================================
-- NWSC conversion, step 5: surveys, satisfaction, participation
--   * real surveys: questions (rating / single / multiple / text),
--     anonymous responses, aggregated results for staff
--   * customer satisfaction rating after a request is resolved
--   * participation recognition (badges) by reference number
--   * guest participation in forums, consultation comments and polls
--     (name + phone, via the community-action Edge Function)
--
-- Run AFTER migration_nwsc_04_announcements.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Surveys ----------
alter table public.surveys add column if not exists thank_you text;

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('rating', 'single', 'multi', 'text')),
  prompt text not null check (char_length(prompt) between 3 and 300),
  options text[] not null default '{}',
  required boolean not null default true
);
create index if not exists survey_questions_survey_idx on public.survey_questions (survey_id, position);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  answers jsonb not null,             -- { "<question id>": 4 | "option" | ["a","b"] | "text" }
  area text,
  respondent_key text,                -- hash of phone, to allow one response per person
  created_at timestamptz not null default now()
);
create unique index if not exists survey_responses_once on public.survey_responses (survey_id, respondent_key) where respondent_key is not null;

alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
drop policy if exists "public reads questions" on public.survey_questions;
create policy "public reads questions" on public.survey_questions for select using (true);
drop policy if exists "admin writes questions" on public.survey_questions;
create policy "admin writes questions" on public.survey_questions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "staff read responses" on public.survey_responses;
create policy "staff read responses" on public.survey_responses for select
  using (public.is_admin() or public.current_role_name() = 'supervisor');
drop policy if exists "admin deletes responses" on public.survey_responses;
create policy "admin deletes responses" on public.survey_responses for delete using (public.is_admin());

drop policy if exists "admin writes surveys" on public.surveys;
create policy "admin writes surveys" on public.surveys for all using (public.is_admin()) with check (public.is_admin());

-- Normalise a Ugandan phone number to +256XXXXXXXXX (null if invalid).
create or replace function public.normalize_ug_phone(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^\+\d{10,15}$' then d
    when d ~ '^256\d{9}$' then '+' || d
    when d ~ '^0\d{9}$' then '+256' || substr(d, 2)
    when d ~ '^7\d{8}$' then '+256' || d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g') as d) x;
$$;

create or replace function public.submit_survey_response(p_survey uuid, p_answers jsonb, p_area text default null, p_phone text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s public.surveys;
  q record;
  v_key text;
  v_ans jsonb;
begin
  select * into s from public.surveys where id = p_survey;
  if not found or not s.is_active or (s.end_date is not null and s.end_date < current_date) then
    raise exception 'This survey is closed';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Invalid answers'; end if;

  for q in select * from public.survey_questions where survey_id = p_survey loop
    v_ans := p_answers -> q.id::text;
    if q.required and (v_ans is null or v_ans = 'null'::jsonb or v_ans = '""'::jsonb or v_ans = '[]'::jsonb) then
      raise exception 'Please answer: %', q.prompt;
    end if;
    if v_ans is not null and v_ans <> 'null'::jsonb then
      if q.kind = 'rating' and not (jsonb_typeof(v_ans) = 'number' and (v_ans)::text::int between 1 and 5) then
        raise exception 'Invalid rating for: %', q.prompt;
      elsif q.kind = 'single' and not (jsonb_typeof(v_ans) = 'string' and (v_ans #>> '{}') = any(q.options)) then
        raise exception 'Invalid choice for: %', q.prompt;
      elsif q.kind = 'multi' and not (jsonb_typeof(v_ans) = 'array'
            and not exists (select 1 from jsonb_array_elements_text(v_ans) e where e <> all(q.options))) then
        raise exception 'Invalid choices for: %', q.prompt;
      elsif q.kind = 'text' and not (jsonb_typeof(v_ans) = 'string' and char_length(v_ans #>> '{}') <= 2000) then
        raise exception 'Answer too long for: %', q.prompt;
      end if;
    end if;
  end loop;

  if p_phone is not null and trim(p_phone) <> '' then
    if public.normalize_ug_phone(p_phone) is null then raise exception 'Enter a valid phone number or leave it empty'; end if;
    v_key := md5(p_survey::text || public.normalize_ug_phone(p_phone));
    if exists (select 1 from public.survey_responses where survey_id = p_survey and respondent_key = v_key) then
      raise exception 'You have already answered this survey — thank you!';
    end if;
  end if;

  insert into public.survey_responses (survey_id, answers, area, respondent_key)
  values (p_survey, p_answers, nullif(trim(p_area), ''), v_key);
  return true;
end;
$$;
grant execute on function public.submit_survey_response(uuid, jsonb, text, text) to anon, authenticated;

-- ---------- 2. Satisfaction ----------
alter table public.feedback
  add column if not exists satisfaction_rating int check (satisfaction_rating between 1 and 5),
  add column if not exists satisfaction_comment text,
  add column if not exists rated_at timestamptz;

create or replace function public.rate_request(p_reference text, p_rating int, p_comment text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare f public.feedback;
begin
  if p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  select * into f from public.feedback where reference_no = upper(trim(p_reference)) for update;
  if not found then raise exception 'Reference not found'; end if;
  if f.status not in ('Resolved', 'Closed') then raise exception 'You can rate the service once your request is resolved'; end if;
  if f.rated_at is not null then raise exception 'You have already rated this request — thank you!'; end if;
  update public.feedback
    set satisfaction_rating = p_rating, satisfaction_comment = left(nullif(trim(p_comment), ''), 1000), rated_at = now()
    where id = f.id;
  insert into public.request_updates (request_id, status, message, is_public, author_id)
    values (f.id, null, 'Customer rated the service ' || p_rating || '/5' ||
            coalesce(': ' || left(nullif(trim(p_comment), ''), 300), '.'), false, null);
  return true;
end;
$$;
grant execute on function public.rate_request(text, int, text) to anon, authenticated;

-- Tracking now also returns rating state and participation recognition.
create or replace function public.track_request(p_reference text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reference_no', f.reference_no,
    'request_type', f.request_type,
    'category', f.category,
    'title', f.title,
    'status', f.status,
    'created_at', f.created_at,
    'updated_at', f.updated_at,
    'resolved_at', f.resolved_at,
    'satisfaction_rating', f.satisfaction_rating,
    'can_rate', f.status in ('Resolved', 'Closed') and f.rated_at is null,
    'participation', (
      select count(*) from public.feedback g
      where (f.contact_phone is not null and public.normalize_ug_phone(g.contact_phone) = public.normalize_ug_phone(f.contact_phone))
         or (f.contact_email is not null and lower(g.contact_email) = lower(f.contact_email))
    ),
    'timeline', coalesce((
      select json_agg(json_build_object('status', u.status, 'message', u.message, 'created_at', u.created_at)
                      order by u.created_at)
      from public.request_updates u
      where u.request_id = f.id and u.is_public
    ), '[]'::json)
  )
  from public.feedback f
  where f.reference_no = upper(trim(p_reference));
$$;
grant execute on function public.track_request(text) to anon, authenticated;

-- ---------- 3. Guest participation ----------
alter table public.forum_topics add column if not exists guest_key text;
alter table public.forum_posts add column if not exists guest_key text;
alter table public.comments add column if not exists author_name text, add column if not exists guest_key text;
alter table public.poll_votes add column if not exists voter_key text;
create unique index if not exists poll_votes_guest_once on public.poll_votes (consultation_id, voter_key) where voter_key is not null;
alter table public.forum_topics add column if not exists created_by_guest boolean not null default false;

-- Keep a guest's own display name; only look up names for signed-in authors.
create or replace function public.set_author_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    select coalesce(nullif(full_name, ''), 'Community member') into new.author_name
    from public.users where id = new.user_id;
  end if;
  new.author_name := coalesce(nullif(trim(new.author_name), ''), 'Community member');
  return new;
end;
$$;
drop trigger if exists comments_author on public.comments;
create trigger comments_author before insert on public.comments
  for each row execute function public.set_author_name();
update public.comments c set author_name = coalesce(nullif(u.full_name, ''), 'Community member')
  from public.users u where u.id = c.user_id and c.author_name is null;

-- Used by community-action (service role) to count a vote safely.
create or replace function public.cast_guest_vote(p_option uuid, p_voter_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_consultation uuid;
begin
  select p.consultation_id into v_consultation
  from public.poll_options o join public.polls p on p.id = o.poll_id where o.id = p_option;
  if v_consultation is null then raise exception 'Poll not found'; end if;
  insert into public.poll_votes (poll_option_id, consultation_id, voter_key) values (p_option, v_consultation, p_voter_key);
  update public.poll_options set vote_count = coalesce(vote_count, 0) + 1 where id = p_option;
  update public.consultations set poll_votes_count = coalesce(poll_votes_count, 0) + 1 where id = v_consultation;
  return true;
exception when unique_violation then
  raise exception 'You have already voted in this poll — thank you!';
end;
$$;
revoke execute on function public.cast_guest_vote(uuid, text) from public, anon, authenticated;

-- Make the API pick up the new columns and functions immediately.
notify pgrst, 'reload schema';

commit;
