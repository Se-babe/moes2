-- ============================================================
-- NWSC conversion, step 1: replace MoES content with NWSC Jinja
-- starter content, and drop the MoES-only tables.
--
-- Run once in the Supabase SQL editor. This DELETES the old MoES
-- content (slides, FAQs, consultations, feedback, news, etc.).
-- User accounts are kept.
-- ============================================================

begin;

-- ---------- 1. Drop MoES-only tables (no longer used by the app) ----------
drop table if exists public.opportunity_applications cascade;
drop table if exists public.opportunities cascade;
drop table if exists public.projects cascade;
drop table if exists public.institutions cascade;
drop table if exists public.info_systems cascade;
drop table if exists public.resources cascade;

-- ---------- 2. Clear MoES content ----------
-- consultations cascade to polls, poll_options, poll_votes, likes, comments
delete from public.consultations;
delete from public.feedback;
delete from public.surveys;
delete from public.slides;
delete from public.faqs;
delete from public.news;
delete from public.updates;
delete from public.town_halls;
delete from public.media_gallery;
delete from public.leadership;
delete from public.departments;
delete from public.categories;
delete from public.bot_knowledge;
delete from public.forum_topics; -- cascades to forum_posts

-- Old MoES citizen sub-roles collapse into 'citizen'.
update public.users set role = 'citizen'
  where role in ('student', 'teacher', 'parent', 'innovator', 'health_worker');

-- ---------- 3. Site settings ----------
insert into public.settings (key, value) values
  ('phone1', 'Toll Free: 0800-200-977'),
  ('phone2', 'Customer Care: +256 (0)313-315-000'),
  ('phone3', ''),
  ('email', 'info@nwsc.co.ug'),
  ('address', 'NWSC Jinja Area Office, Jinja, Uganda'),
  ('office_hours', 'Monday – Friday, 8:00 AM – 5:00 PM')
on conflict (key) do update set value = excluded.value;

-- ---------- 4. Home slides ----------
insert into public.slides (image_url, title, subtitle, quote, display_order, active) values
  ('https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1200&q=80',
   'NWSC Jinja e-Participation', 'Your voice on water and sewerage services', 'Water is life — let''s protect it together.', 1, true),
  ('https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200&q=80',
   'Report a Leak or Burst', 'Every drop counts — tell us and track the fix', 'Report it. Track it. See it fixed.', 2, true),
  ('https://images.unsplash.com/photo-1527100673774-cce25eafaf7f?w=1200&q=80',
   'Service Updates', 'Planned interruptions and restorations in your area', 'Stay informed, plan ahead.', 3, true);

-- ---------- 5. Departments (also used for routing complaints in step 3) ----------
insert into public.departments (name, description, icon, display_order) values
  ('Customer Service', 'Enquiries, account changes, and general customer support.', 'people-outline', 1),
  ('Water Distribution & Maintenance', 'Supply interruptions, leaks, bursts, and low pressure.', 'water-outline', 2),
  ('Billing & Revenue', 'Bills, payments, meter readings, and disputes.', 'receipt-outline', 3),
  ('Water Quality', 'Colour, taste, smell, and water safety concerns.', 'beaker-outline', 4),
  ('Sewerage Services', 'Blocked sewers, overflows, and sanitation.', 'construct-outline', 5),
  ('New Connections', 'Applications for new water and sewer connections.', 'git-branch-outline', 6);

-- ---------- 6. FAQs ----------
insert into public.faqs (question, answer) values
  ('How do I report a leak or burst pipe?', 'Use "Enquiries & Complaints" and choose "Leak / Burst Pipe". Add a photo and your location if you can. You will get a reference number to track the repair. For emergencies, also call the toll-free line 0800-200-977.'),
  ('How do I track my complaint?', 'Open "Track My Request" and enter the reference number you received when you submitted it.'),
  ('Why is there no water in my area?', 'Check "Service Updates" for planned interruptions. If none is listed, report it under "No Water / Supply".'),
  ('How do I query my bill?', 'Submit an enquiry under "Billing & Payments" with your account number. A billing officer will respond.'),
  ('How do I apply for a new connection?', 'Submit an enquiry under "New Connection" and the New Connections team will contact you with the requirements.');

-- ---------- 7. Assistant knowledge ----------
insert into public.bot_knowledge (response, keywords) values
  ('For a burst pipe or major leak, report it under Enquiries & Complaints → Leak / Burst Pipe, and call the toll-free line 0800-200-977.', array['burst','leak','pipe','flood']),
  ('You can track any request with its reference number on the Track My Request page.', array['track','reference','status','complaint']),
  ('Planned interruptions and restorations are posted on the Service Updates page.', array['no water','interruption','supply','outage']);

-- ---------- 8. Categories ----------
insert into public.categories (name, icon) values
  ('No Water / Supply', 'water-outline'),
  ('Leak / Burst Pipe', 'warning-outline'),
  ('Billing & Payments', 'receipt-outline'),
  ('Water Quality', 'beaker-outline'),
  ('Sewer & Sanitation', 'construct-outline'),
  ('New Connection', 'git-branch-outline'),
  ('General', 'chatbubble-outline');

commit;
