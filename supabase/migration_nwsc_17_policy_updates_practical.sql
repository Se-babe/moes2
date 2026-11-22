-- ============================================================
-- NWSC conversion, step 17: targeted policy updates, staff practicals
--   * documents carry a topic and the customer groups they concern;
--     publishing one (or a revised version) notifies subscribers whose
--     topics and group match
--   * a hands-on data-quality exercise for staff, marked and recorded
--     like the other training modules
--
-- Run AFTER migration_nwsc_16_documents_open_data.sql. Safe to re-run.
-- ============================================================

begin;

-- ---------- 1. Targeted policy updates ----------
alter table public.documents
  add column if not exists topic text,                                  -- one of the profile interests
  add column if not exists audiences text[] not null default '{}',      -- stakeholder groups; empty = everyone
  add column if not exists notify_subscribers boolean not null default true,
  add column if not exists notified_version int not null default 0;

create or replace function public.queue_policy_update(d public.documents)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_what text := lower(d.category);
  v_verb text := case when d.current_version > 1 then 'updated' else 'published' end;
  n int := 0; m int;
begin
  insert into public.notification_outbox (channel, recipient, purpose, priority, token, language, body, not_before)
  select 'sms', s.phone, 'policy_update', 6, s.token, s.language,
    left(case s.language
      when 'lg' then 'NWSC Jinja efulumizza ' || v_what || ': ' || d.title || '. Soma: {SITE}/documents'
      when 'xog' then 'NWSC Jinja efulumizza ' || v_what || ': ' || d.title || '. Soma: {SITE}/documents'
      else 'NWSC Jinja has ' || v_verb || ' a ' || v_what || ': ' || d.title || '. Read it: {SITE}/documents'
    end, 300),
    public.after_quiet_hours(now())
  from public.alert_subscriptions s
  where s.is_active and s.notify_participation and s.phone is not null
    and (d.topic is null or cardinality(s.interests) = 0 or d.topic = any(s.interests))
    and (cardinality(d.audiences) = 0 or s.stakeholder_group = any(d.audiences));
  get diagnostics m = row_count; n := n + m;

  insert into public.notification_outbox (channel, recipient, purpose, priority, token, language, subject, html, not_before)
  select 'email', lower(s.email), 'policy_update', 6, s.token, s.language,
    'NWSC Jinja ' || v_verb || ' a ' || v_what || ': ' || d.title,
    '<p style="font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:1px">' || initcap(v_verb) || ' ' || v_what || ' · ' ||
      replace(replace(d.institution, '<', '&lt;'), '>', '&gt;') || '</p>' ||
    '<h2 style="margin:4px 0 12px">' || replace(replace(replace(d.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h2>' ||
    coalesce('<p>' || replace(replace(replace(d.summary, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>', '') ||
    '<p><a href="{SITE}/documents">Read it in the NWSC document library</a></p>' ||
    '<p style="font-size:12px;color:#94A3B8">You get these because of the topics in your profile. ' ||
    '<a href="{SITE}/me?token=' || s.token || '">Change your preferences</a>.</p>',
    now()
  from public.alert_subscriptions s
  where s.is_active and s.notify_participation and s.email is not null
    and (d.topic is null or cardinality(s.interests) = 0 or d.topic = any(s.interests))
    and (cardinality(d.audiences) = 0 or s.stakeholder_group = any(d.audiences));
  get diagnostics m = row_count; n := n + m;
  return n;
end;
$$;
revoke execute on function public.queue_policy_update(public.documents) from public, anon, authenticated;

-- A published document with a file it hasn't announced yet: tell people once.
create or replace function public.document_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and new.notify_subscribers and new.current_version > new.notified_version then
    perform public.queue_policy_update(new);
    update public.documents set notified_version = new.current_version where id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists document_notify on public.documents;
create trigger document_notify after insert or update of current_version, is_published on public.documents
  for each row execute function public.document_notify();

-- Documents already in the library don't trigger a burst of messages.
update public.documents set notified_version = current_version where notified_version < current_version;

-- ---------- 2. Practical exercise for staff ----------

do $$
declare v_id uuid;
begin
  if exists (select 1 from public.training_modules where slug = 'practical-data-quality') then return; end if;
  insert into public.training_modules (slug, title, summary, audience, topic, minutes, position, pass_mark, body)
  values ('practical-data-quality', 'Practical: check five real-style records',
    'Hands-on exercise: review sample requests the way you would at your desk, and find what is wrong.',
    'staff', 'Data management', 15, 7, 80,
$b$## How this exercise works
Below are five requests as they might arrive at the front desk or by phone. For each one, decide what — if anything — needs fixing before it can be routed and handled. Then answer the questions. This is the same checking you should do every day.

## Record A
- Type: Complaint · Category: Leak / burst pipe
- Title: "Pipe burst"
- Location: (blank)
- Phone: 0772 456 123

## Record B
- Type: Enquiry · Category: Billing & payments
- Title: "Why is my bill so high this month?"
- Location: Walukuba, plot 14, account 2201-5567
- Phone: 772 45

## Record C
- Type: Compliment · Category: Leak / burst pipe
- Title: "Water has been off in Masese since yesterday"
- Location: Masese III, near the mosque
- Phone: 0701 222 333

## Record D
- Type: Complaint · Category: Water quality
- Title: "Brown water from the tap"
- Description: "Customer is rude and always complaining. Water is brown since Monday."
- Location: Bugembe, Kiira road
- Phone: 0782 111 999

## Record E
- Type: Complaint · Category: Sewer & sanitation
- Title: "Sewer overflow behind the market"
- Location: Jinja Central market, back gate
- Phone: 0757 000 111 · Received via: Walk-in

## Tip
Work through the records one at a time. When you finish, read every explanation — even for the ones you got right.$b$)
  returning id into v_id;

  insert into public.training_questions (module_id, position, prompt, options, answer, explanation) values
  (v_id, 0, 'Record A: what must be fixed before it can be routed?', array['Nothing — it is complete', 'The location is missing', 'The phone number is invalid', 'It should be a compliment'], 1,
   'A burst pipe cannot be found without a location. Call the customer back and add the area, street and a landmark.'),
  (v_id, 1, 'Record B: what is wrong?', array['The category', 'The phone number is too short to be valid', 'The location', 'Nothing'], 1,
   '"772 45" is not a valid number, so the customer will not get their reference or updates. Ugandan mobiles have 10 digits starting 07.'),
  (v_id, 2, 'Record C: what needs correcting?', array['Nothing', 'Type should be Complaint and category No water / supply', 'Only the location', 'Only the phone number'], 1,
   'No water since yesterday is a complaint about supply, not a compliment about a leak. Wrong type and category send it to the wrong team and distort reports.'),
  (v_id, 3, 'Record D: what must you change?', array['Remove the personal remark about the customer', 'Change the category to Billing', 'Delete the record', 'Nothing'], 0,
   'Requests are official records. Keep them factual: "Brown water from the tap since Monday."'),
  (v_id, 4, 'Record E: is it ready to route?', array['Yes — it is complete and correctly logged as a walk-in', 'No — walk-ins cannot be logged', 'No — the phone is invalid', 'No — sewer issues are enquiries'], 0,
   'Complete type, category, location and contact, and the channel is recorded. Ready to go.');
end;
$$;

notify pgrst, 'reload schema';

commit;
