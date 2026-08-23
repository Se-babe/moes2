-- ============================================================
-- Admin panel migration — fixes one real gap found while building
-- the admin panel: there was no UPDATE policy on `feedback` at all,
-- so admin status changes (Submitted -> In Progress -> Resolved)
-- would have failed under RLS with zero policies matching.
-- ============================================================
create policy "admin updates feedback status" on public.feedback
  for update using (public.is_admin()) with check (public.is_admin());
