-- ============================================================
-- NWSC conversion, step 6: inclusion
--   * remember each request's language so messages to the citizen
--     (acknowledgements) are sent in English, Luganda or Lusoga
--
-- Run AFTER migration_nwsc_05_engagement.sql. Safe to re-run.
-- ============================================================

begin;

alter table public.feedback add column if not exists language text not null default 'en';
alter table public.feedback drop constraint if exists feedback_language_check;
alter table public.feedback add constraint feedback_language_check check (language in ('en', 'lg', 'xog'));

-- Make the API pick up the new columns and functions immediately.
notify pgrst, 'reload schema';

commit;
