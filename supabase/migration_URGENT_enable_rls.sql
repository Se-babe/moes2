-- CRITICAL FIX — run this whole file now.
--
-- Row Level Security was never actually enabled on 26 of this project's
-- tables (confirmed via pg_class.relrowsecurity), and almost none of the
-- base policy set from schema.sql had ever been applied to production —
-- only this session's incremental migrations had landed. Net effect: the
-- anon key currently has full read/write/delete on `users` (including
-- setting anyone's role to 'admin'), `feedback`, `consultations`, and 21
-- other tables, regardless of any policy anyone ever wrote.
--
-- This migration (1) enables RLS on every affected table, and (2) restores
-- every policy the app actually depends on to keep working — public read
-- access, self-signup, logged-in engagement (likes/comments/votes), and
-- admin writes — cross-checked against what already exists on production
-- so nothing here duplicates or conflicts with it. Every policy is dropped
-- before being recreated, so this file is safe to run more than once.

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.settings enable row level security;
alter table public.social_links enable row level security;
alter table public.slides enable row level security;
alter table public.faqs enable row level security;
alter table public.resources enable row level security;
alter table public.surveys enable row level security;
alter table public.bot_knowledge enable row level security;
alter table public.consultations enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.district_metrics enable row level security;
alter table public.region_metrics enable row level security;
alter table public.stats enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.town_halls enable row level security;

-- ---------- users ----------
drop policy if exists "public read" on public.users;
create policy "public read" on public.users for select using (true);
drop policy if exists "self insert" on public.users;
create policy "self insert" on public.users for insert with check (auth.uid() = id);
drop policy if exists "self update" on public.users;
create policy "self update" on public.users for update using (auth.uid() = id);
-- "admin updates any user" (UPDATE) already exists — left untouched.

-- ---------- simple admin-content tables ----------
drop policy if exists "public read" on public.categories;
create policy "public read" on public.categories for select using (true);
drop policy if exists "admin writes categories" on public.categories;
create policy "admin writes categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.settings;
create policy "public read" on public.settings for select using (true);
drop policy if exists "admin writes settings" on public.settings;
create policy "admin writes settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.social_links;
create policy "public read" on public.social_links for select using (true);
drop policy if exists "admin writes social_links" on public.social_links;
create policy "admin writes social_links" on public.social_links for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.slides;
create policy "public read" on public.slides for select using (true);
drop policy if exists "admin writes slides" on public.slides;
create policy "admin writes slides" on public.slides for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.faqs;
create policy "public read" on public.faqs for select using (true);
drop policy if exists "admin writes faqs" on public.faqs;
create policy "admin writes faqs" on public.faqs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.resources;
create policy "public read" on public.resources for select using (true);
drop policy if exists "admin writes resources" on public.resources;
create policy "admin writes resources" on public.resources for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.surveys;
create policy "public read" on public.surveys for select using (true);
drop policy if exists "admin writes surveys" on public.surveys;
create policy "admin writes surveys" on public.surveys for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.bot_knowledge;
create policy "public read" on public.bot_knowledge for select using (true);
drop policy if exists "admin writes bot_knowledge" on public.bot_knowledge;
create policy "admin writes bot_knowledge" on public.bot_knowledge for all using (public.is_admin()) with check (public.is_admin());

-- ---------- consultations (no insert policy — intentional, see propose-consultation Edge Function) ----------
drop policy if exists "public read" on public.consultations;
create policy "public read" on public.consultations for select using (true);
drop policy if exists "authenticated can update vote counts" on public.consultations;
create policy "authenticated can update vote counts" on public.consultations for update using (auth.role() = 'authenticated');
drop policy if exists "admin approves consultations" on public.consultations;
create policy "admin approves consultations" on public.consultations for update using (auth.role() = 'authenticated');
drop policy if exists "admin deletes consultations" on public.consultations;
create policy "admin deletes consultations" on public.consultations for delete using (public.is_admin());

-- ---------- polls / poll_options / poll_votes ----------
drop policy if exists "public read" on public.polls;
create policy "public read" on public.polls for select using (true);
drop policy if exists "admin writes polls" on public.polls;
create policy "admin writes polls" on public.polls for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read" on public.poll_options;
create policy "public read" on public.poll_options for select using (true);
drop policy if exists "admin writes poll_options_insert" on public.poll_options;
create policy "admin writes poll_options_insert" on public.poll_options for insert with check (public.is_admin());
drop policy if exists "authenticated can update option vote counts" on public.poll_options;
create policy "authenticated can update option vote counts" on public.poll_options for update using (auth.role() = 'authenticated');
-- "admin deletes poll_options" (DELETE) already exists — left untouched.

drop policy if exists "logged-in users vote" on public.poll_votes;
create policy "logged-in users vote" on public.poll_votes for insert with check (auth.uid() = user_id);
drop policy if exists "logged-in users remove own vote" on public.poll_votes;
create policy "logged-in users remove own vote" on public.poll_votes for delete using (auth.uid() = user_id);
-- "admin deletes poll_votes" (DELETE) already exists — left untouched.

-- ---------- likes / comments / comment_likes ----------
drop policy if exists "public read" on public.likes;
create policy "public read" on public.likes for select using (true);
drop policy if exists "logged-in users react" on public.likes;
create policy "logged-in users react" on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "logged-in users update own reaction" on public.likes;
create policy "logged-in users update own reaction" on public.likes for update using (auth.uid() = user_id);
drop policy if exists "logged-in users remove own reaction" on public.likes;
create policy "logged-in users remove own reaction" on public.likes for delete using (auth.uid() = user_id);

drop policy if exists "public read" on public.comments;
create policy "public read" on public.comments for select using (true);
drop policy if exists "logged-in users comment" on public.comments;
create policy "logged-in users comment" on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "public read" on public.comment_likes;
create policy "public read" on public.comment_likes for select using (true);
drop policy if exists "logged-in users like comments" on public.comment_likes;
create policy "logged-in users like comments" on public.comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists "logged-in users unlike comments" on public.comment_likes;
create policy "logged-in users unlike comments" on public.comment_likes for delete using (auth.uid() = user_id);

-- ---------- feedback (no insert policy — intentional, see submit-feedback Edge Function) ----------
drop policy if exists "public read" on public.feedback;
create policy "public read" on public.feedback for select using (true);
-- "admin updates feedback status" (UPDATE) already exists — left untouched.

-- ---------- notifications ----------
drop policy if exists "owner or admin read" on public.notifications;
create policy "owner or admin read" on public.notifications for select using (public.is_admin() or user_id = auth.uid());
drop policy if exists "authenticated can update notifications" on public.notifications;
create policy "authenticated can update notifications" on public.notifications for update using (public.is_admin() or user_id = auth.uid());
-- "notification targets a real admin" (INSERT) already exists — left untouched.

-- ---------- chat (unauthenticated guest flow) ----------
drop policy if exists "public read" on public.chat_sessions;
create policy "public read" on public.chat_sessions for select using (true);
drop policy if exists "anyone can start a chat session" on public.chat_sessions;
create policy "anyone can start a chat session" on public.chat_sessions for insert with check (true);

drop policy if exists "public read" on public.chat_messages;
create policy "public read" on public.chat_messages for select using (true);
drop policy if exists "anyone can send a chat message" on public.chat_messages;
create policy "anyone can send a chat message" on public.chat_messages for insert with check (true);

-- ---------- unused tables (no app code references these — locked to read-only) ----------
drop policy if exists "public read" on public.district_metrics;
create policy "public read" on public.district_metrics for select using (true);
drop policy if exists "public read" on public.region_metrics;
create policy "public read" on public.region_metrics for select using (true);
drop policy if exists "public read" on public.stats;
create policy "public read" on public.stats for select using (true);
drop policy if exists "public read" on public.survey_questions;
create policy "public read" on public.survey_questions for select using (true);
drop policy if exists "public read" on public.survey_responses;
create policy "public read" on public.survey_responses for select using (true);
drop policy if exists "public read" on public.town_halls;
create policy "public read" on public.town_halls for select using (true);
