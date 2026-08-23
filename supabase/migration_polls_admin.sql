-- Admins can now create polls (via AdminConsultations.js "Add Poll") and
-- delete them. Deleting a poll cascades to poll_options and (through that)
-- to poll_votes — those cascaded deletes are still subject to RLS on the
-- child tables, so without these policies an admin's "Delete Poll" would
-- fail with a foreign-key/permission error partway through the cascade.

create policy "admin deletes poll_options" on public.poll_options
  for delete using (public.is_admin());

create policy "admin deletes poll_votes" on public.poll_votes
  for delete using (public.is_admin());
