-- ─── The Wall: earned perks ──────────────────────────────────────────────────────
--
-- A sponsor can attach a short perk ("10% off a coffee, show this screen") to their tile. The app shows
-- ONE perk, labelled Sponsored, as a thank-you after someone finishes a walk (never in the gate, never
-- as an interruption). The perk is redeemed in person; nothing about the person is sent or tracked.
--
-- Review: when you approve a listing, read the perk text too (it is shown to everyone who finishes a walk).
--   select id, company, perk, url from public.wall_listings where status = 'pending_review';

alter table public.wall_listings add column if not exists perk text
  check (perk is null or char_length(perk) between 4 and 80);

-- Same view as before with `perk` added as the LAST column (a view can only grow at the end).
create or replace view public.wall_public as
  select id, x, y, w, h, company, headline, url, image_url, color, category, region, 'sponsor'::text as kind, perk
    from public.wall_listings
   where status = 'live' and ends_at > now()
  union all
  select id, x, y, 1, 1, 'Supporter', null, '', image_url, '#C7DFF2', 'supporter', null, 'supporter'::text, null::text
    from public.wall_supporters
   where status = 'live' and ends_at > now();
grant select on public.wall_public to anon, authenticated;
