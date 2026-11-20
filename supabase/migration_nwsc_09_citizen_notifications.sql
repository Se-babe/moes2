-- ============================================================
-- NWSC conversion, step 9: automatic citizen notifications
--   * one delivery queue (notification_outbox) for every channel:
--     SMS, email, WhatsApp, and posts to the NWSC Telegram channel,
--     Facebook page and X account
--   * the queue fills itself when an announcement goes live, retries
--     failed sends, and falls back from WhatsApp to SMS
--   * quiet hours: non-emergency SMS/WhatsApp wait until 07:00
--   * emergencies always go by SMS and social media, and reviewers get an
--     SMS the moment an emergency notice is waiting for approval
--   * planned interruptions can carry a start time; subscribers get a
--     reminder about two hours before
--   * the scheduler checks every minute and only calls the sender when
--     something is due
--
-- Run AFTER migration_nwsc_08_staff_profiles.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Channels ----------
alter table public.notification_log drop constraint if exists notification_log_channel_check;
alter table public.notification_log add constraint notification_log_channel_check
  check (channel in ('sms', 'email', 'whatsapp', 'telegram', 'facebook', 'x'));

alter table public.announcements
  add column if not exists notify_whatsapp boolean not null default false,
  add column if not exists notify_social boolean not null default false,
  add column if not exists starts_at timestamptz;          -- when a planned interruption begins

alter table public.alert_subscriptions
  add column if not exists whatsapp boolean not null default false;  -- prefer WhatsApp over SMS

-- ---------- 2. The delivery queue ----------
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements(id) on delete cascade,
  request_id uuid references public.feedback(id) on delete set null,
  channel text not null check (channel in ('sms', 'email', 'whatsapp', 'telegram', 'facebook', 'x')),
  recipient text,                 -- phone / email; null for social posts
  purpose text not null,          -- announcement | reminder | review | acknowledgement | status_update
  priority int not null default 5, -- 1 = emergency, goes first
  subject text,                   -- prepared messages (retries, reviewer alerts);
  body text,                      -- announcement messages are written at send time
  html text,
  token uuid,                     -- subscriber's manage/unsubscribe token
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts int not null default 0,
  not_before timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_outbox_due_idx on public.notification_outbox (priority, not_before) where status = 'queued';
create index if not exists notification_outbox_announcement_idx on public.notification_outbox (announcement_id);
create unique index if not exists notification_outbox_once on public.notification_outbox (announcement_id, channel, recipient, purpose)
  where announcement_id is not null and recipient is not null;

alter table public.notification_outbox enable row level security;
-- Holds subscribers' phone numbers and emails: administrators only.
drop policy if exists "admin reads outbox" on public.notification_outbox;
create policy "admin reads outbox" on public.notification_outbox for select using (public.is_admin());

-- ---------- 3. Timing helpers (Africa/Kampala) ----------
-- Non-emergency texts are held between 21:00 and 07:00.
create or replace function public.after_quiet_hours(p_at timestamptz)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_local timestamp := p_at at time zone 'Africa/Kampala';
  v_hour int := extract(hour from v_local);
begin
  if v_hour >= 21 then
    return (date_trunc('day', v_local) + interval '1 day 7 hours') at time zone 'Africa/Kampala';
  elsif v_hour < 7 then
    return (date_trunc('day', v_local) + interval '7 hours') at time zone 'Africa/Kampala';
  end if;
  return p_at;
end;
$$;

-- Reminder about two hours before an interruption; if that falls in quiet
-- hours, send it at 20:00 the evening before instead.
create or replace function public.reminder_time(p_starts timestamptz)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_at timestamptz := p_starts - interval '2 hours';
  v_local timestamp := v_at at time zone 'Africa/Kampala';
  v_hour int := extract(hour from v_local);
begin
  if v_hour >= 21 then
    return (date_trunc('day', v_local) + interval '20 hours') at time zone 'Africa/Kampala';
  elsif v_hour < 7 then
    return (date_trunc('day', v_local) - interval '4 hours') at time zone 'Africa/Kampala';
  end if;
  return v_at;
end;
$$;

-- ---------- 4. Recipients ----------
drop function if exists public.announcement_recipients(uuid);
create function public.announcement_recipients(p_announcement uuid)
returns table (phone text, email text, language text, token uuid, whatsapp boolean)
language sql stable security definer set search_path = public as $$
  select s.phone, s.email, s.language, s.token, s.whatsapp
  from public.alert_subscriptions s, public.announcements a
  where a.id = p_announcement and s.is_active
    and (cardinality(a.areas) = 0 or cardinality(s.areas) = 0 or s.areas && a.areas)
    and (cardinality(s.categories) = 0 or a.category = any(s.categories) or a.category = 'Emergency');
$$;
revoke execute on function public.announcement_recipients(uuid) from public, anon, authenticated;

-- Queue one purpose (announcement / reminder) for every subscriber channel.
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
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before)
    select a.id, 'whatsapp', r.phone, p_purpose, v_prio, r.token, v_text_at
    from public.announcement_recipients(a.id) r where r.phone is not null and r.whatsapp
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  if a.notify_sms then
    -- WhatsApp subscribers get SMS only if WhatsApp isn't used for this one
    -- (or later, as a fallback when WhatsApp fails).
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before)
    select a.id, 'sms', r.phone, p_purpose, v_prio, r.token, v_text_at
    from public.announcement_recipients(a.id) r
    where r.phone is not null and not (a.notify_whatsapp and r.whatsapp)
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  if a.notify_email then
    insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before)
    select a.id, 'email', lower(r.email), p_purpose, v_prio, r.token, p_at
    from public.announcement_recipients(a.id) r where r.email is not null
    on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    get diagnostics m = row_count; n := n + m;
  end if;
  return n;
end;
$$;
revoke execute on function public.queue_subscriber_messages(public.announcements, text, timestamptz) from public, anon, authenticated;

-- Everything an announcement should send, queued once when it goes live.
create or replace function public.enqueue_announcement(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  a public.announcements;
  v_prio int;
  v_rem timestamptz;
  n int := 0;
begin
  select * into a from public.announcements where id = p_id for update;
  if not found or a.status <> 'published' or a.notified_at is not null then return 0; end if;
  v_prio := case when a.category = 'Emergency' then 1 else 5 end;

  n := public.queue_subscriber_messages(a, 'announcement', now());

  if a.notify_social then
    insert into public.notification_outbox (announcement_id, channel, purpose, priority)
    select a.id, c, 'announcement', v_prio from unnest(array['telegram', 'facebook', 'x']) c;
    n := n + 3;
  end if;

  -- Reminder before a planned interruption starts.
  if a.category = 'Planned interruption' and a.starts_at is not null then
    v_rem := public.reminder_time(a.starts_at);
    if v_rem > now() + interval '30 minutes' then
      n := n + public.queue_subscriber_messages(a, 'reminder', v_rem);
      if a.notify_social then
        insert into public.notification_outbox (announcement_id, channel, purpose, priority, not_before)
        values (a.id, 'telegram', 'reminder', 3, v_rem);
        n := n + 1;
      end if;
    end if;
  end if;

  update public.announcements set notified_at = now() where id = a.id;
  return n;
end;
$$;
revoke execute on function public.enqueue_announcement(uuid) from public, anon, authenticated;

-- ---------- 5. Announcement triggers ----------
-- Same rules as step 4, plus: emergencies always go by SMS and social media.
create or replace function public.announcement_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.current_role_name();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), 'NWSC staff') into new.author_name from public.users where id = new.author_id;
  end if;
  if new.category = 'Emergency' then
    new.notify_sms := true;
    new.notify_social := true;
  end if;
  if new.category <> 'Planned interruption' then
    new.starts_at := null;
  end if;
  if auth.uid() is null then
    return new; -- scheduler / service role
  end if;
  if coalesce(v_role, '') not in ('supervisor', 'admin') then
    if new.status not in ('draft', 'pending') then
      raise exception 'Only supervisors and administrators can publish announcements';
    end if;
    if tg_op = 'UPDATE' and old.status not in ('draft', 'pending', 'rejected') then
      raise exception 'This announcement has already been reviewed; ask a supervisor to change it';
    end if;
  end if;
  return new;
end;
$$;

-- Reviewers: in-app notice for everything; an SMS and email straight away
-- when the notice is an emergency.
create or replace function public.announcement_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dept uuid;
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    select department_id into v_dept from public.users where id = new.author_id;

    insert into public.notifications (user_id, title, message, type, target_screen, target_id)
    select u.id, 'Announcement awaiting approval', new.title, 'announcement', 'StaffPortal', new.id
    from public.users u
    where u.is_active and u.id is distinct from new.author_id
      and (u.role = 'admin' or (u.role = 'supervisor' and u.department_id is not distinct from v_dept));

    if new.category = 'Emergency' then
      insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, subject, body, html)
      select new.id, ch.channel, ch.recipient, 'review', 1,
             'URGENT: emergency notice awaiting approval',
             left('NWSC URGENT: an emergency notice needs your approval: "' || new.title || '". Please review it now in the staff portal.', 300),
             '<p><strong>An emergency notice is waiting for your approval.</strong></p><p>' ||
               replace(replace(replace(new.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
               '</p><p>Customers are only alerted once it is approved. Please review it now in the staff portal.</p>'
      from public.users u
      cross join lateral (values ('sms', u.phone), ('email', u.email)) as ch(channel, recipient)
      where u.is_active and u.id is distinct from new.author_id and ch.recipient is not null and ch.recipient <> ''
        and (u.role = 'admin' or (u.role = 'supervisor' and u.department_id is not distinct from v_dept))
      on conflict (announcement_id, channel, recipient, purpose) where announcement_id is not null and recipient is not null do nothing;
    end if;
  end if;

  -- Went live: queue every alert and social post.
  if new.status = 'published' and new.notified_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.enqueue_announcement(new.id);
  end if;

  if tg_op = 'UPDATE' then
    -- Taken down before everything went out: stop what's still waiting.
    if old.status = 'published' and new.status <> 'published' then
      update public.notification_outbox set status = 'cancelled', updated_at = now()
      where announcement_id = new.id and status = 'queued';
    -- Interruption moved: move its reminders too.
    elsif new.status = 'published' and new.starts_at is distinct from old.starts_at then
      if new.starts_at is null or public.reminder_time(new.starts_at) <= now() then
        update public.notification_outbox set status = 'cancelled', updated_at = now()
        where announcement_id = new.id and purpose = 'reminder' and status = 'queued';
      else
        update public.notification_outbox
          set not_before = case when channel in ('sms', 'whatsapp') and new.category <> 'Emergency'
                                then public.after_quiet_hours(public.reminder_time(new.starts_at))
                                else public.reminder_time(new.starts_at) end,
              updated_at = now()
        where announcement_id = new.id and purpose = 'reminder' and status = 'queued';
      end if;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists announcement_after_write on public.announcements;
create trigger announcement_after_write after insert or update on public.announcements
  for each row execute function public.announcement_after_write();

-- The old one-shot claim is replaced by the queue.
drop function if exists public.claim_announcements_to_notify();

-- ---------- 6. Sender API (service role only) ----------
create or replace function public.claim_outbox(p_limit int default 200)
returns setof public.notification_outbox language plpgsql security definer set search_path = public as $$
begin
  -- A sender that crashed mid-way: put its rows back.
  update public.notification_outbox set status = 'queued', updated_at = now()
  where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
  with picked as (
    select id from public.notification_outbox
    where status = 'queued' and not_before <= now()
    order by priority, not_before
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  update public.notification_outbox o
    set status = 'sending', attempts = o.attempts + 1, updated_at = now()
  from picked where o.id = picked.id
  returning o.*;
end;
$$;
revoke execute on function public.claim_outbox(int) from public, anon, authenticated;

-- Results: [{ "id": uuid, "status": "sent"|"failed"|"skipped", "error": text, "final": bool }]
-- Failures retry after 5, 20 and 45 minutes, then stop. WhatsApp that can't
-- be delivered falls back to SMS when the announcement allows SMS.
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
      insert into public.notification_outbox (announcement_id, channel, recipient, purpose, priority, token, not_before)
      values (o.announcement_id, 'sms', o.recipient, o.purpose, o.priority, o.token, now())
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

-- ---------- 7. Staff and admin views ----------
-- Per-announcement delivery counts (no contact details) for the staff portal.
create or replace function public.announcement_delivery(p_ids uuid[])
returns table (announcement_id uuid, channel text, purpose text, queued int, sent int, failed int, skipped int, next_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.announcement_id, q.channel, q.purpose,
         count(*) filter (where q.status in ('queued', 'sending'))::int,
         count(*) filter (where q.status = 'sent')::int,
         count(*) filter (where q.status = 'failed')::int,
         count(*) filter (where q.status = 'skipped')::int,
         min(q.not_before) filter (where q.status = 'queued')
  from public.notification_outbox q
  where public.is_staff() and q.announcement_id = any(p_ids)
  group by 1, 2, 3;
$$;
revoke execute on function public.announcement_delivery(uuid[]) from public, anon;
grant execute on function public.announcement_delivery(uuid[]) to authenticated;

-- Admin overview: deliveries by channel, the queue, and subscribers.
create or replace function public.notification_summary(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  return jsonb_build_object(
    'log', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'status', status, 'count', c))
      from (select channel, status, count(*) c from public.notification_log
            where created_at > now() - make_interval(days => greatest(p_days, 1)) group by 1, 2) t), '[]'::jsonb),
    'queue', jsonb_build_object(
      'queued', (select count(*) from public.notification_outbox where status in ('queued', 'sending')),
      'due', (select count(*) from public.notification_outbox where status = 'queued' and not_before <= now()),
      'next_at', (select min(not_before) from public.notification_outbox where status = 'queued'),
      'failed', (select count(*) from public.notification_outbox where status = 'failed')),
    'subscribers', (select jsonb_build_object(
      'total', count(*), 'sms', count(phone) filter (where not whatsapp), 'whatsapp', count(*) filter (where whatsapp and phone is not null),
      'email', count(email)) from public.alert_subscriptions where is_active)
  );
end;
$$;
revoke execute on function public.notification_summary(int) from public, anon;
grant execute on function public.notification_summary(int) to authenticated;

create or replace function public.retry_failed_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  update public.notification_outbox set status = 'queued', attempts = 0, not_before = now(), updated_at = now()
  where status = 'failed';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.retry_failed_notifications() from public, anon;
grant execute on function public.retry_failed_notifications() to authenticated;

-- ---------- 8. Sign-up with WhatsApp ----------
drop function if exists public.subscribe_alerts(text, text, text, text[], text[], text);
create or replace function public.subscribe_alerts(
  p_name text, p_phone text, p_email text, p_areas text[], p_categories text[],
  p_language text default 'en', p_whatsapp boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
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
          is_active = true, updated_at = now()
      where token = v_token;
  else
    insert into public.alert_subscriptions (name, phone, email, areas, categories, language, whatsapp)
    values (nullif(trim(p_name), ''), v_phone, v_email, coalesce(p_areas, '{}'), coalesce(p_categories, '{}'),
            coalesce(nullif(p_language, ''), 'en'), coalesce(p_whatsapp, false) and v_phone is not null)
    returning token into v_token;
  end if;
  return v_token;
end;
$$;
grant execute on function public.subscribe_alerts(text, text, text, text[], text[], text, boolean) to anon, authenticated;

-- Unsubscribing also stops anything still queued for that person.
create or replace function public.unsubscribe_alerts(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.alert_subscriptions set is_active = false, updated_at = now() where token = p_token;
  if not found then return false; end if;
  update public.notification_outbox set status = 'cancelled', updated_at = now() where token = p_token and status = 'queued';
  return true;
end;
$$;
grant execute on function public.unsubscribe_alerts(uuid) to anon, authenticated;

-- ---------- 9. Scheduler: every minute, only call the sender when due ----------
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'nwsc-announcements';
  perform cron.schedule('nwsc-announcements', '* * * * *', $job$
    select public.publish_due_announcements();
    select net.http_post(
      url := 'https://sjsavaijgoazitnrjtab.supabase.co/functions/v1/announcement-dispatch',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) where exists (select 1 from public.notification_outbox where status = 'queued' and not_before <= now());
  $job$);
exception when others then
  raise notice 'Notification scheduler not set up: %', sqlerrm;
end;
$$;

notify pgrst, 'reload schema';

commit;
