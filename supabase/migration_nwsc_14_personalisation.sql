-- ============================================================
-- NWSC conversion, step 14: personal profiles, targeting, translations
--   * citizen profiles (built on alert subscriptions, no password): area,
--     stakeholder group, interests, language, channels; managed with the
--     private link we send them
--   * announcements can target stakeholder groups and carry Luganda and
--     Lusoga versions; each subscriber gets their own language
--   * new consultations and surveys are announced to subscribers whose
--     interests match ("participation opportunities")
--
-- Run AFTER migration_nwsc_13_hr_admin_powers.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Citizen profiles ----------
alter table public.alert_subscriptions
  add column if not exists stakeholder_group text not null default 'Household',
  add column if not exists interests text[] not null default '{}',
  add column if not exists notify_participation boolean not null default true,
  add column if not exists last_seen_at timestamptz;
alter table public.alert_subscriptions drop constraint if exists alert_subscriptions_group_check;
alter table public.alert_subscriptions add constraint alert_subscriptions_group_check
  check (stakeholder_group in ('Household', 'Business', 'Institution', 'Landlord', 'Community leader', 'Other'));

drop function if exists public.subscribe_alerts(text, text, text, text[], text[], text, boolean);
create or replace function public.subscribe_alerts(
  p_name text, p_phone text, p_email text, p_areas text[], p_categories text[],
  p_language text default 'en', p_whatsapp boolean default false,
  p_group text default 'Household', p_interests text[] default '{}', p_participation boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_group text := coalesce(nullif(p_group, ''), 'Household');
  v_token uuid;
begin
  if v_phone is null and v_email is null then raise exception 'Give a phone number or an email address'; end if;
  if v_phone is not null then
    v_phone := case
      when v_phone ~ '^\+\d{10,15}$' then v_phone
      when v_phone ~ '^256\d{9}$' then '+' || v_phone
      when v_phone ~ '^0\d{9}$' then '+256' || substr(v_phone, 2)
      when v_phone ~ '^7\d{8}$' then '+256' || v_phone
      else null end;
    if v_phone is null then raise exception 'Enter a valid Ugandan phone number, e.g. 0772 123456'; end if;
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;

  select token into v_token from public.alert_subscriptions
  where (v_phone is not null and phone = v_phone) or (v_email is not null and lower(email) = v_email)
  limit 1;

  if v_token is not null then
    update public.alert_subscriptions
      set name = coalesce(nullif(trim(p_name), ''), name), phone = coalesce(v_phone, phone), email = coalesce(v_email, email),
          areas = coalesce(p_areas, '{}'), categories = coalesce(p_categories, '{}'),
          language = coalesce(nullif(p_language, ''), 'en'), whatsapp = coalesce(p_whatsapp, false) and coalesce(v_phone, phone) is not null,
          stakeholder_group = v_group, interests = coalesce(p_interests, '{}'), notify_participation = coalesce(p_participation, true),
          is_active = true, updated_at = now()
      where token = v_token;
  else
    insert into public.alert_subscriptions (name, phone, email, areas, categories, language, whatsapp, stakeholder_group, interests, notify_participation)
    values (nullif(trim(p_name), ''), v_phone, v_email, coalesce(p_areas, '{}'), coalesce(p_categories, '{}'),
            coalesce(nullif(p_language, ''), 'en'), coalesce(p_whatsapp, false) and v_phone is not null,
            v_group, coalesce(p_interests, '{}'), coalesce(p_participation, true))
    returning token into v_token;
  end if;
  return v_token;
end;
$$;
grant execute on function public.subscribe_alerts(text, text, text, text[], text[], text, boolean, text, text[], boolean) to anon, authenticated;

-- The private link (token) is the key to a profile: read it, change it.
create or replace function public.get_profile(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.alert_subscriptions;
begin
  update public.alert_subscriptions set last_seen_at = now() where token = p_token returning * into s;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', s.name, 'phone', s.phone, 'email', s.email, 'areas', s.areas, 'categories', s.categories,
    'language', s.language, 'whatsapp', s.whatsapp, 'stakeholder_group', s.stakeholder_group,
    'interests', s.interests, 'notify_participation', s.notify_participation, 'is_active', s.is_active);
end;
$$;
grant execute on function public.get_profile(uuid) to anon, authenticated;

create or replace function public.update_profile(
  p_token uuid, p_name text, p_areas text[], p_categories text[], p_language text, p_whatsapp boolean,
  p_group text, p_interests text[], p_participation boolean, p_active boolean default true
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.alert_subscriptions
    set name = nullif(trim(p_name), ''), areas = coalesce(p_areas, '{}'), categories = coalesce(p_categories, '{}'),
        language = coalesce(nullif(p_language, ''), 'en'), whatsapp = coalesce(p_whatsapp, false) and phone is not null,
        stakeholder_group = coalesce(nullif(p_group, ''), 'Household'), interests = coalesce(p_interests, '{}'),
        notify_participation = coalesce(p_participation, true), is_active = coalesce(p_active, true), updated_at = now()
    where token = p_token;
  if not found then return false; end if;
  if not coalesce(p_active, true) then
    update public.notification_outbox set status = 'cancelled', updated_at = now() where token = p_token and status = 'queued';
  end if;
  return true;
end;
$$;
grant execute on function public.update_profile(uuid, text, text[], text[], text, boolean, text, text[], boolean, boolean) to anon, authenticated;

-- ---------- 2. Targeted, multilingual announcements ----------
alter table public.announcements
  add column if not exists audiences text[] not null default '{}',   -- stakeholder groups; empty = everyone
  add column if not exists title_lg text, add column if not exists body_lg text,
  add column if not exists title_xog text, add column if not exists body_xog text;

create or replace function public.announcement_recipients(p_announcement uuid)
returns table (phone text, email text, language text, token uuid, whatsapp boolean)
language sql stable security definer set search_path = public as $$
  select s.phone, s.email, s.language, s.token, s.whatsapp
  from public.alert_subscriptions s, public.announcements a
  where a.id = p_announcement and s.is_active
    and (cardinality(a.areas) = 0 or cardinality(s.areas) = 0 or s.areas && a.areas)
    and (cardinality(s.categories) = 0 or a.category = any(s.categories) or a.category = 'Emergency')
    and (cardinality(a.audiences) = 0 or s.stakeholder_group = any(a.audiences) or a.category = 'Emergency');
$$;
revoke execute on function public.announcement_recipients(uuid) from public, anon, authenticated;

-- Each message remembers the subscriber's language.
alter table public.notification_outbox add column if not exists language text not null default 'en';

create or replace function public.queue_subscriber_messages(a public.announcements, p_purpose text, p_at timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_urgent boolean := a.category = 'Emergency';
  v_prio int := case when v_urgent then 1 when p_purpose = 'reminder' then 3 else 5 end;
  -- Texts respect quiet hours unless it's an emergency; email is silent.
  v_text_at timestamptz := case when v_urgent then p_at else public.after_quiet_hours(p_at) end;
  n int := 0; m int;
begin
  if a.notify_whatsapp then
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before, language)
    select a.id, 'whatsapp', r.phone, p_purpose, v_prio, r.token, v_text_at, r.language
    from public.announcement_recipients(a.id) r where r.phone is not null and r.whatsapp
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  if a.notify_sms then
    -- WhatsApp subscribers get SMS only if WhatsApp isn't used for this one
    -- (or later, as a fallback when WhatsApp fails).
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before, language)
    select a.id, 'sms', r.phone, p_purpose, v_prio, r.token, v_text_at, r.language
    from public.announcement_recipients(a.id) r
    where r.phone is not null and not (a.notify_whatsapp and r.whatsapp)
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  if a.notify_email then
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before, language)
    select a.id, 'email', lower(r.email), p_purpose, v_prio, r.token, p_at, r.language
    from public.announcement_recipients(a.id) r where r.email is not null
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  return n;
end;
$$;
revoke execute on function public.queue_subscriber_messages(public.announcements, text, timestamptz) from public, anon, authenticated;

create or replace function public.finish_outbox(p_results jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  o public.notification_outbox;
  n int := 0;
begin
  for r in select * from jsonb_to_recordset(p_results) as x(id uuid, status text, error text, final boolean) loop
    if r.status = 'sent' then
      update public.notification_outbox set status = 'sent', sent_at = now(), last_error = null, updated_at = now()
      where id = r.id and status = 'sending' returning * into o;
    elsif r.status = 'skipped' then
      update public.notification_outbox set status = 'skipped', last_error = left(r.error, 500), updated_at = now()
      where id = r.id and status = 'sending' returning * into o;
    else
      update public.notification_outbox
        set status = case when attempts < 3 and not coalesce(r.final, false) then 'queued' else 'failed' end,
            not_before = now() + make_interval(mins => 5 * attempts * attempts),
            last_error = left(r.error, 500), updated_at = now()
      where id = r.id and status = 'sending' returning * into o;
    end if;
    if not found then continue; end if;
    n := n + 1;

    if o.channel = 'whatsapp' and o.status in ('failed', 'skipped') and o.announcement_id is not null
       and exists (select 1 from public.announcements a where a.id = o.announcement_id and a.notify_sms and a.status = 'published') then
      insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before, language)
      values (o.announcement_id, 'sms', o.recipient, o.purpose, o.priority, o.token, now(), o.language)
      on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    end if;
  end loop;

  -- Keep "alerts sent to N people" current.
  update public.announcements a
    set notify_count = (
      select count(distinct coalesce(q.token::text, q.recipient)) from public.notification_outbox q
      where q.announcement_id = a.id and q.purpose = 'announcement' and q.status = 'sent' and q.recipient is not null)
  where a.id in (
    select distinct q.announcement_id from public.notification_outbox q
    where q.id in (select (x->>'id')::uuid from jsonb_array_elements(p_results) x) and q.announcement_id is not null);
  return n;
end;
$$;
revoke execute on function public.finish_outbox(jsonb) from public, anon, authenticated;

-- ---------- 3. Participation opportunities ----------
alter table public.consultations add column if not exists participation_notified_at timestamptz;
alter table public.surveys add column if not exists participation_notified_at timestamptz;

-- Queue a short invitation to every interested subscriber. {SITE} in the
-- text is replaced with the website address when the message is sent.
create or replace function public.queue_participation(p_kind text, p_title text, p_category text, p_path text, p_closes date)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; m int;
begin
  -- SMS (WhatsApp subscribers too: invitations aren't WhatsApp templates)
  insert into public.notification_outbox (channel, recipient, purpose, priority, token, language, body, not_before)
  select 'sms', s.phone, 'participation', 6, s.token, s.language,
    left(case s.language
      when 'lg' then 'NWSC Jinja eyagala endowooza yo: ' || p_title || '. Weetabe: {SITE}' || p_path
      when 'xog' then 'NWSC Jinja eyenda endowooza yo: ' || p_title || '. Weetabe: {SITE}' || p_path
      else 'NWSC Jinja wants your views: ' || p_title || coalesce(' (closes ' || to_char(p_closes, 'DD Mon') || ')', '') || '. Take part: {SITE}' || p_path
    end, 300),
    public.after_quiet_hours(now())
  from public.alert_subscriptions s
  where s.is_active and s.notify_participation and s.phone is not null
    and (cardinality(s.interests) = 0 or p_category = any(s.interests) or p_category is null);
  get diagnostics m = row_count; n := n + m;

  insert into public.notification_outbox (channel, recipient, purpose, priority, token, language, subject, html, not_before)
  select 'email', lower(s.email), 'participation', 6, s.token, s.language,
    'Have your say: ' || p_title,
    '<p style="font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:1px">New ' || p_kind || ' from NWSC Jinja</p>' ||
    '<h2 style="margin:4px 0 12px">' || replace(replace(replace(p_title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h2>' ||
    '<p>We would like your views' || coalesce(' before ' || to_char(p_closes, 'DD Mon YYYY'), '') || '. It only takes a few minutes.</p>' ||
    '<p><a href="{SITE}' || p_path || '">Take part now</a></p>' ||
    '<p style="font-size:12px;color:#94A3B8">You get these because you chose to hear about participation opportunities. ' ||
    '<a href="{SITE}/me?token=' || s.token || '">Change your preferences</a>.</p>',
    now()
  from public.alert_subscriptions s
  where s.is_active and s.notify_participation and s.email is not null
    and (cardinality(s.interests) = 0 or p_category = any(s.interests) or p_category is null);
  get diagnostics m = row_count; n := n + m;
  return n;
end;
$$;
revoke execute on function public.queue_participation(text, text, text, text, date) from public, anon, authenticated;

create or replace function public.consultation_participation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active and new.participation_notified_at is null
     and (new.closing_date is null or new.closing_date >= current_date) then
    perform public.queue_participation('consultation', new.title, new.category, '/consultations', new.closing_date::date);
    update public.consultations set participation_notified_at = now() where id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists consultation_participation on public.consultations;
create trigger consultation_participation after insert or update of is_active on public.consultations
  for each row execute function public.consultation_participation();

create or replace function public.survey_participation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active and new.participation_notified_at is null
     and (new.end_date is null or new.end_date >= current_date)
     and (new.start_date is null or new.start_date <= current_date) then
    perform public.queue_participation('survey', new.title, new.category, '/surveys/' || new.id, new.end_date::date);
    update public.surveys set participation_notified_at = now() where id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists survey_participation on public.surveys;
create trigger survey_participation after insert or update of is_active on public.surveys
  for each row execute function public.survey_participation();

-- Already-open consultations and surveys don't trigger a burst of messages.
update public.consultations set participation_notified_at = coalesce(participation_notified_at, now()) where is_active;
update public.surveys set participation_notified_at = coalesce(participation_notified_at, now()) where is_active;

notify pgrst, 'reload schema';

commit;
