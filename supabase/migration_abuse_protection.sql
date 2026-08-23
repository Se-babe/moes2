-- Closes the two highest-value open-write abuse vectors flagged in the
-- pre-deployment audit: feedback and consultation proposals were insertable
-- by anyone with zero verification (the anon key is necessarily public, so
-- this was scriptable at will). Writes for both now happen exclusively
-- through new Edge Functions (submit-feedback, propose-consultation) that
-- verify a Cloudflare Turnstile token first, then insert using the service
-- role key — which is why the direct client-side insert policies below are
-- removed rather than just tightened; there is no longer a legitimate path
-- for the client to insert into these tables directly.

drop policy if exists "anyone can submit feedback" on public.feedback;
drop policy if exists "anyone can propose a consultation" on public.consultations;

-- notifications: left open for anonymous insert (the guest chat flow in
-- ChatBotScreen.js needs it), but every legitimate call site already looks
-- up a real admin's id first — this just makes that a server-enforced rule
-- instead of an assumption, raising the bar against generic spam bots.
-- (chat_sessions/chat_messages are intentionally left as-is: a CAPTCHA on
-- every chat message would break the conversational UX, and the actual
-- cost-sensitive part — the Groq call — is a separate, accepted risk.)
drop policy if exists "anyone can create a notification" on public.notifications;
create policy "notification targets a real admin" on public.notifications
  for insert with check (
    exists (select 1 from public.users where id = user_id and role = 'admin')
  );
