-- ============================================================
-- NWSC conversion, step 15: learning and training
--   * training modules: lessons (text + optional video) with a short
--     assessment; for staff (data management skills) or the public
--     (how to use the platform, why open government matters)
--   * answers are marked by the database; the correct answers are never
--     sent to the browser before someone submits
--   * staff progress (started, attempts, best score, passed) is recorded
--     and reported by person and department to HR and administrators
--
-- Run AFTER migration_nwsc_14_personalisation.sql. Safe to re-run.
-- ============================================================

begin;

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  audience text not null default 'staff' check (audience in ('staff', 'public')),
  topic text not null default 'Data management',
  body text not null default '',      -- paragraphs; lines starting "## " are headings, "- " are bullets
  video_url text,
  minutes int not null default 10,
  position int not null default 0,
  pass_mark int not null default 70 check (pass_mark between 0 and 100),
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.training_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  options text[] not null check (cardinality(options) between 2 and 6),
  answer int not null,                -- index into options (0-based)
  explanation text
);
create index if not exists training_questions_module_idx on public.training_questions (module_id, position);

create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  attempts int not null default 0,
  best_score int,
  passed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, module_id)
);

alter table public.training_modules enable row level security;
alter table public.training_questions enable row level security;
alter table public.training_progress enable row level security;

drop policy if exists "read published modules" on public.training_modules;
create policy "read published modules" on public.training_modules for select
  using (public.is_admin() or (is_published and (audience = 'public' or public.is_staff())));
drop policy if exists "admin manages modules" on public.training_modules;
create policy "admin manages modules" on public.training_modules for all
  using (public.is_admin()) with check (public.is_admin());

-- Questions (with answers) are for administrators/HR only; learners use get_quiz.
drop policy if exists "admin manages questions" on public.training_questions;
create policy "admin manages questions" on public.training_questions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own or admin reads progress" on public.training_progress;
create policy "own or admin reads progress" on public.training_progress for select
  using (user_id = auth.uid() or public.is_admin());

-- Questions without the answers.
create or replace function public.get_quiz(p_module uuid)
returns table (id uuid, prompt text, options text[])
language sql stable security definer set search_path = public as $$
  select q.id, q.prompt, q.options
  from public.training_questions q join public.training_modules m on m.id = q.module_id
  where q.module_id = p_module and m.is_published
    and (m.audience = 'public' or public.is_staff())
  order by q.position;
$$;
grant execute on function public.get_quiz(uuid) to anon, authenticated;

-- Staff opened a lesson.
create or replace function public.start_module(p_module uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.training_progress (user_id, module_id)
  select auth.uid(), p_module where public.is_staff()
  on conflict (user_id, module_id) do nothing;
$$;
grant execute on function public.start_module(uuid) to authenticated;

-- Mark answers; staff results are recorded. Returns the score and, now that
-- they've answered, the correct answers with explanations.
create or replace function public.submit_quiz(p_module uuid, p_answers int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.training_modules;
  v_total int; v_right int; v_score int; v_passed boolean;
  v_review jsonb;
begin
  select * into m from public.training_modules where id = p_module and is_published;
  if not found or (m.audience = 'staff' and not public.is_staff()) then
    raise exception 'Module not found';
  end if;

  with q as (
    select (row_number() over (order by position))::int as n, * from public.training_questions where module_id = p_module
  )
  select count(*), count(*) filter (where p_answers[q.n] = q.answer),
         coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'chosen', p_answers[q.n], 'answer', q.answer,
           'correct', p_answers[q.n] = q.answer, 'explanation', q.explanation) order by q.n), '[]'::jsonb)
    into v_total, v_right, v_review
  from q;

  if v_total = 0 then raise exception 'This module has no questions yet'; end if;
  v_score := round(100.0 * v_right / v_total);
  v_passed := v_score >= m.pass_mark;

  if auth.uid() is not null and public.is_staff() then
    insert into public.training_progress (user_id, module_id, last_attempt_at, attempts, best_score, passed, completed_at)
    values (auth.uid(), p_module, now(), 1, v_score, v_passed, case when v_passed then now() end)
    on conflict (user_id, module_id) do update
      set last_attempt_at = now(), attempts = training_progress.attempts + 1,
          best_score = greatest(coalesce(training_progress.best_score, 0), v_score),
          passed = training_progress.passed or v_passed,
          completed_at = coalesce(training_progress.completed_at, case when v_passed then now() end);
  end if;

  return jsonb_build_object('score', v_score, 'right', v_right, 'total', v_total, 'passed', v_passed,
                            'pass_mark', m.pass_mark, 'review', v_review);
end;
$$;
grant execute on function public.submit_quiz(uuid, int[]) to anon, authenticated;

-- Training report: one row per staff member per staff module.
create or replace function public.training_report()
returns table (user_id uuid, full_name text, role text, department text, is_active boolean,
               module_id uuid, module_title text, status text, best_score int, attempts int, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name, u.role, d.name, u.is_active, m.id, m.title,
         case when p.passed then 'Completed' when p.attempts > 0 then 'Not yet passed' when p.id is not null then 'In progress' else 'Not started' end,
         p.best_score, coalesce(p.attempts, 0), p.completed_at
  from public.users u
  cross join public.training_modules m
  left join public.departments d on d.id = u.department_id
  left join public.training_progress p on p.user_id = u.id and p.module_id = m.id
  where public.is_admin() and u.role in ('officer', 'supervisor', 'hr', 'admin')
    and m.audience = 'staff' and m.is_published
  order by d.name nulls last, u.full_name, m.position;
$$;
revoke execute on function public.training_report() from public, anon;
grant execute on function public.training_report() to authenticated;

-- ---------- Starter content ----------
create or replace function pg_temp.add_module(p_slug text, p_title text, p_summary text, p_audience text, p_topic text,
  p_minutes int, p_position int, p_body text, p_questions jsonb)
returns void language plpgsql as $$
declare v_id uuid; q jsonb; i int := 0;
begin
  if exists (select 1 from public.training_modules where slug = p_slug) then return; end if;
  insert into public.training_modules (slug, title, summary, audience, topic, minutes, position, body)
  values (p_slug, p_title, p_summary, p_audience, p_topic, p_minutes, p_position, p_body) returning id into v_id;
  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.training_questions (module_id, position, prompt, options, answer, explanation)
    values (v_id, i, q->>'q', array(select jsonb_array_elements_text(q->'o')), (q->>'a')::int, q->>'e');
    i := i + 1;
  end loop;
end;
$$;

select pg_temp.add_module('data-collection', 'Collecting customer data correctly', 'Capture complete, accurate information the first time a customer contacts us.', 'staff', 'Data management', 12, 1,
$b$## Why it matters
Every request is only as good as the information captured when it arrives. Missing locations, wrong phone numbers or vague descriptions slow down field teams and leave customers without updates.

## What to capture
- The customer's name and a working phone number or email, so they receive their reference number and updates.
- A clear title and description: what is wrong, since when, and how many people are affected.
- The exact location: area, street, landmark, and the meter or account number if it is a billing matter.
- The right type (complaint, enquiry, suggestion or compliment) and category.

## Good habits
- Read the details back to the customer before you submit.
- When you log a call or walk-in, choose how it reached us so reports show offline demand.
- Never write personal opinions about the customer in the request.$b$,
'[{"q":"A customer calls about a leak. What is the most important extra detail to capture?","o":["Their favourite branch","The exact location and a landmark","Their monthly income","The weather"],"a":1,"e":"Field teams need an exact location to find and fix the leak quickly."},
  {"q":"Why must every request have a working phone number or email?","o":["To send the reference number and progress updates","To sell other services","It is optional and not needed","For the customer survey only"],"a":0,"e":"The customer gets their reference and every update by SMS or email."},
  {"q":"When you log a walk-in complaint, what should you also record?","o":["Nothing else","That it was received as a walk-in","Your own phone number","The customer''s ID number"],"a":1,"e":"Recording the channel lets reports show how many requests come in offline."},
  {"q":"Which of these should never go into a request description?","o":["When the problem started","How many homes are affected","Personal opinions about the customer","The meter number"],"a":2,"e":"Requests are official records; keep them factual and respectful."}]'::jsonb);

select pg_temp.add_module('data-entry-quality', 'Data entry and quality checks', 'Enter data consistently and catch errors before they spread.', 'staff', 'Data management', 10, 2,
$b$## Consistent entry
Use the lists the system gives you (categories, areas, departments) instead of typing your own words. Consistent values make searching and reporting reliable.

## Check before you save
- Phone numbers: 10 digits starting with 07, or +256.
- Dates and times: in East Africa Time.
- Status: move a request forward only when the work has really happened, and always write a reply to the customer when you resolve it.

## Fixing mistakes
If you spot an error in a request, add an internal note explaining the correction. The timeline keeps a record of who changed what and when, which protects you and the customer.$b$,
'[{"q":"Why should you choose from the system''s lists instead of typing your own category?","o":["It looks nicer","Consistent values make search and reports reliable","Typing is not allowed","Lists are faster to print"],"a":1,"e":"Free-typed variations (e.g. \"Billing\", \"bills\", \"billing issue\") break reports."},
  {"q":"Which phone number is in a valid Ugandan format?","o":["772 12","0772123456","+1 555 0100","07721234567890"],"a":1,"e":"Ugandan mobile numbers have 10 digits starting 07 (or +2567…)."},
  {"q":"What must you do when marking a request Resolved?","o":["Nothing else","Write a reply explaining the outcome to the customer","Delete the request","Change its category"],"a":1,"e":"The system requires an outcome message so the customer knows what was done."},
  {"q":"You notice a wrong location on a request. What is the best action?","o":["Ignore it","Correct it and add an internal note explaining the change","Close the request","Ask the customer to submit again"],"a":1,"e":"The note keeps an honest record of the correction."}]'::jsonb);

select pg_temp.add_module('data-storage-security', 'Storing and protecting data', 'Keep customer information safe, private and in the right place.', 'staff', 'Data management', 12, 3,
$b$## One central record
All requests, announcements and survey results live in the central NWSC e-Participation database. Do not keep customer lists in personal notebooks, spreadsheets or phones.

## Privacy rules
- Uganda's Data Protection and Privacy Act, 2019 applies to all customer data.
- Only look at requests you need for your work. Access is limited by department.
- Never share a customer's phone number, email or address outside NWSC.

## Account security
- Use a strong password that you do not use anywhere else, and never share it.
- Sign out on shared computers. Use "Sign out other devices" in Settings if you lose a phone.
- Report anything suspicious to your supervisor or ICT immediately.$b$,
'[{"q":"Where should customer request information be kept?","o":["In your personal phone contacts","In the central e-Participation system","In a notebook at the front desk","In a WhatsApp group"],"a":1,"e":"The central system is secured, backed up and access-controlled."},
  {"q":"Which law governs customer personal data in Uganda?","o":["The Data Protection and Privacy Act, 2019","The Traffic Act","The Land Act","There is none"],"a":0,"e":"The Data Protection and Privacy Act, 2019 sets the rules for personal data."},
  {"q":"A colleague asks for your password to finish your work. What do you do?","o":["Share it once","Refuse; each person uses their own account","Write it on a sticky note","Email it to them"],"a":1,"e":"Shared passwords break accountability and security."},
  {"q":"You lost your phone, which was signed in. What should you do first?","o":["Nothing","Use \"Sign out other devices\" and change your password","Buy a new phone","Create a new account"],"a":1,"e":"Signing out other devices ends sessions on the lost phone."}]'::jsonb);

select pg_temp.add_module('data-processing-analysis', 'Processing data and reading reports', 'Turn request data into decisions with the reports and dashboards.', 'staff', 'Data management', 12, 4,
$b$## What the reports show
- Volumes: how many enquiries, complaints, suggestions and compliments arrive, by category, department and channel.
- Speed: time to first response and time to resolve, against each department's target.
- Quality: resolution rates and customer satisfaction ratings.

## Reading them well
- Compare like with like: the same period, the same department.
- Look for patterns, such as many leak reports from one area, which can point to a failing main.
- A rising number of overdue requests is an early warning for staffing or process problems.

## Sharing results
Export reports as CSV for further analysis. Share summaries, not customer details.$b$,
'[{"q":"Many leak complaints come from one area in a week. What might this show?","o":["Nothing useful","A possible failing main that needs attention","That customers like complaining","A reporting error only"],"a":1,"e":"Clusters of reports often reveal an underlying network problem."},
  {"q":"Which measure tells you how quickly customers hear back?","o":["Total requests","Time to first response","Number of departments","Satisfaction rating"],"a":1,"e":"Time to first response measures how fast we acknowledge and act."},
  {"q":"When sharing a report outside your team, what should you remove?","o":["Totals","Charts","Customer personal details","Dates"],"a":2,"e":"Share summaries; personal details stay in the system."},
  {"q":"Overdue requests have doubled this month. What is the best first step?","o":["Ignore it","Check workloads and staffing in the affected department","Delete old requests","Change the targets"],"a":1,"e":"Rising backlogs usually point to capacity or process issues."}]'::jsonb);

select pg_temp.add_module('data-management-records', 'Managing records and following up', 'Keep requests moving, close them properly and learn from feedback.', 'staff', 'Data management', 10, 5,
$b$## Keep requests moving
- Check your queue every day, starting with overdue and escalated requests.
- Update the status as work progresses and send short public replies so customers are not left guessing.
- Hand over to a colleague or supervisor before leave; never let requests sit unassigned.

## Closing properly
Resolve only when the problem is fixed, explain what was done, and invite the customer to rate the service. Closed requests remain on record for reporting and audits.

## Learning from feedback
Low ratings and repeated complaints show where processes need to change. Share lessons with your team.$b$,
'[{"q":"Which requests should you look at first each day?","o":["The newest","Overdue and escalated ones","The shortest","Compliments"],"a":1,"e":"Overdue and escalated requests are already late for the customer."},
  {"q":"What should happen before you go on leave?","o":["Nothing","Hand over your open requests","Close all your requests","Delete your notes"],"a":1,"e":"Handing over keeps customers from waiting while you are away."},
  {"q":"When is it right to mark a request Resolved?","o":["As soon as you read it","When the problem is fixed and you have explained the outcome","When the customer stops calling","At the end of the month"],"a":1,"e":"Resolve only real fixes, with an explanation to the customer."},
  {"q":"What do repeated low satisfaction ratings tell you?","o":["Customers are always unhappy","Where a process or service needs to improve","Nothing useful","The rating system is broken"],"a":1,"e":"Feedback points to where change is needed."}]'::jsonb);

select pg_temp.add_module('open-government-platform', 'The e-Participation platform: benefits and use', 'Why NWSC Jinja runs an open, participatory platform and how each part works.', 'staff', 'Platform', 8, 6,
$b$## Why it matters
Open government means customers can see what we are doing, take part in decisions and hold us to account. The platform turns that into daily practice: every request has a reference number, every update is visible, and every customer can have their say.

## What each part does
- Enquiries and complaints, with reference numbers and tracking.
- Service updates and alerts by SMS, WhatsApp, email and social media.
- Consultations, surveys, polls and forums for public views.
- Reports and dashboards that show our performance openly.
- A document library of policies, decisions and reports.

## Your role
Respond promptly, write clearly, keep data accurate and treat every contribution with respect.$b$,
'[{"q":"What does every customer request receive automatically?","o":["A discount","A unique reference number","A visit from the MD","Nothing"],"a":1,"e":"The reference number lets the customer track progress."},
  {"q":"Which is a benefit of publishing performance data openly?","o":["Customers can hold us to account","It hides problems","It replaces customer service","It costs nothing"],"a":0,"e":"Transparency builds trust and accountability."},
  {"q":"Where can the public find NWSC policies and decisions?","o":["Only by visiting the office","In the platform''s document library","On private WhatsApp groups","Nowhere"],"a":1,"e":"The document library publishes policies, decisions and reports."}]'::jsonb);

-- Public guides
select pg_temp.add_module('guide-report-track', 'How to report a problem and track it', 'Report a leak, a billing issue or anything else, and follow it to the end.', 'public', 'Using the platform', 4, 101,
$b$## 1. Choose what you want to do
Open "Report a problem" or "Make an enquiry". Pick the type: complaint, enquiry, suggestion or compliment, then the category.

## 2. Tell us about it
Give a short title and describe what is happening, where, and since when. Add a photo if you can. Prefer to talk? Use the microphone button to speak instead of typing.

## 3. Give your contact
Enter your phone number or email. We send your reference number straight away, and updates as your request moves.

## 4. Track it
Open "Track my request" and enter your reference number to see every step. When it is resolved, rate our service.

## Tip
Your form is saved on your phone as you type, so you can finish it later.$b$,
'[{"q":"What do you receive right after you submit a request?","o":["A bill","A reference number","Nothing","A password"],"a":1,"e":"The reference number lets you track your request."},
  {"q":"Where do you check progress?","o":["Track my request","The FAQ page","Community meetings","Nowhere"],"a":0,"e":"Enter your reference on Track my request."},
  {"q":"Can you finish a half-filled form later on the same phone?","o":["Yes, it is saved as you type","No, you must start again"],"a":0,"e":"Save-and-resume keeps your draft on your device."}]'::jsonb);

select pg_temp.add_module('guide-have-your-say', 'How to have your say', 'Take part in consultations, surveys, polls and forums.', 'public', 'Using the platform', 4, 102,
$b$## Consultations
NWSC publishes proposals, such as tariff reviews or new projects, before decisions are made. Read the proposal, vote in the poll and leave a comment. When it closes, see "You said, we did" to learn what changed.

## Surveys and polls
Short questionnaires about our services. Most take a few minutes and need no account.

## Forums
Ask questions and share ideas with other residents. Answers marked "Official NWSC answer" come from our staff.

## Get invited
Create your profile and choose your topics. We will let you know when a new consultation or survey on those topics opens.$b$,
'[{"q":"What does \"You said, we did\" show?","o":["Bills","What NWSC changed because of public views","Job adverts","Weather"],"a":1,"e":"It shows the impact of your contributions."},
  {"q":"How do you know a forum answer comes from NWSC staff?","o":["It is in capital letters","It is marked \"Official NWSC answer\"","It is the longest","You can''t tell"],"a":1,"e":"Staff replies carry the official badge."},
  {"q":"How can you be told about new consultations on topics you care about?","o":["Create a profile and choose your topics","Call every day","There is no way"],"a":0,"e":"Your profile''s topics decide which invitations you receive."}]'::jsonb);

select pg_temp.add_module('guide-alerts-profile', 'Alerts and your personal page', 'Get notices for your area in your language, and use My NWSC.', 'public', 'Using the platform', 3, 103,
$b$## Create your profile
Open "Alerts & my profile". Choose who you are (household, business, landlord…), your areas, the notices and topics you care about, and your language. Add a phone number for SMS or WhatsApp, an email, or both. No password is needed.

## My NWSC
Your personal page shows notices for your area, consultations and surveys picked for you, and the progress of your requests on this device.

## Change or stop anytime
Use "My NWSC" or the link in any email to change your preferences or stop alerts.$b$,
'[{"q":"Do you need a password for your profile?","o":["Yes","No"],"a":1,"e":"Your private link and this device open your profile."},
  {"q":"What does My NWSC show?","o":["Notices for your area, activities for you and your requests","Only bills","Staff salaries"],"a":0,"e":"It brings together what matters to you."}]'::jsonb);

select pg_temp.add_module('guide-access', 'Language, text size and saving data', 'Make the site easier to read and lighter on your bundle.', 'public', 'Using the platform', 3, 104,
$b$## Your language
Choose English, Luganda or Lusoga from the language menu at the top. Alerts are sent in the language you pick in your profile.

## Easier reading
Open "Display" to make text larger or switch on high contrast. The site works with screen readers.

## Save data
Lite mode loads fewer images and is switched on automatically on slow connections. Documents and data can be downloaded as compressed files.$b$,
'[{"q":"Which languages can you choose?","o":["English, Luganda and Lusoga","English only","French and Swahili"],"a":0,"e":"Pick your language from the top menu."},
  {"q":"What does Lite mode do?","o":["Loads fewer images to save data","Deletes your account","Doubles the text size"],"a":0,"e":"It keeps pages light on slow or expensive connections."}]'::jsonb);

notify pgrst, 'reload schema';

commit;
