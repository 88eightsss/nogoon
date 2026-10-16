-- ─── The Wall: region tag and anonymous tap counts ───────────────────────────────
--
-- region: where the business is (a town, island or "Online"). The app uses it to put nearby
--   sponsors first. It is free text typed by the buyer; the app matches it loosely.
-- taps: how many times people opened a tile's link. No user id, no device id, no timestamp
--   finer than the day. Advertisers are shown these totals.
--
-- Report for an advertiser (SQL editor):
--   select l.company, l.taps, d.day, d.taps as taps_that_day
--     from public.wall_listings l left join public.wall_tap_days d on d.listing_id = l.id
--    where l.id = '<id>' order by d.day;

alter table public.wall_listings add column if not exists region text
  check (region is null or char_length(region) between 2 and 40);
alter table public.wall_listings add column if not exists taps int not null default 0;

create table if not exists public.wall_tap_days (
  listing_id uuid not null references public.wall_listings(id) on delete cascade,
  day        date not null,
  taps       int  not null default 0,
  primary key (listing_id, day)
);
alter table public.wall_tap_days enable row level security;
revoke all on public.wall_tap_days from anon, authenticated;

-- Appending a column at the end keeps the old view's columns in place.
create or replace view public.wall_public as
  select id, x, y, w, h, company, headline, url, image_url, color, category, region
  from public.wall_listings
  where status = 'live' and ends_at > now();
grant select on public.wall_public to anon, authenticated;

-- Called by the app when someone opens a tile's link. Only live listings count.
create or replace function public.wall_tap(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wall_listings set taps = taps + 1
   where id = p_id and status = 'live' and ends_at > now();
  if found then
    insert into public.wall_tap_days (listing_id, day, taps) values (p_id, current_date, 1)
    on conflict (listing_id, day) do update set taps = public.wall_tap_days.taps + 1;
  end if;
end $$;
grant execute on function public.wall_tap(uuid) to anon, authenticated;
