-- Adds a real join mechanism to Virtual Town Halls: previously `location`
-- was just descriptive text ("Virtual (Zoom)") with nothing clickable, so
-- there was no actual way for a citizen to join a virtual session.
alter table public.town_halls add column if not exists meeting_link text;
