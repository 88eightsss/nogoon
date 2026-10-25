-- Step Out: a short local-news list and a "request this place" counter.
--
-- local_news: HEADLINES ONLY (title, link, outlet, date) read daily from the public RSS feeds listed in
-- news_sources. No article text is stored; every row links to the publisher. Rows older than 14 days are
-- deleted by the job. To pull one: update local_news set status = 'hidden' where id = '...';
-- To stop an outlet:               update news_sources set active = false where url = '...';
-- To add one:                      insert into news_sources (region, name, url) values ('Oahu', 'Outlet', 'https://.../feed');
--
-- place_requests: how many people asked for a place we do not cover yet. No user id, no device id, just a
-- place name and a count, so we know where to build next.

create table if not exists public.news_sources (
  id     bigint generated always as identity primary key,
  region text not null check (char_length(region) <= 60),
  name   text not null check (char_length(name) <= 60),
  url    text not null unique check (url ~ '^https://'),
  active boolean not null default true
);
alter table public.news_sources enable row level security;      -- no policies: service role only

create table if not exists public.local_news (
  id           uuid primary key default gen_random_uuid(),
  region       text not null check (char_length(region) <= 60),
  title        text not null check (char_length(title) between 1 and 200),
  url          text not null unique check (url ~ '^https://'),
  source       text not null check (char_length(source) <= 60),
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  status       text not null default 'approved' check (status in ('approved', 'hidden'))
);
create index if not exists local_news_region_pub_idx on public.local_news (region, published_at desc);
alter table public.local_news enable row level security;
drop policy if exists "read_approved_news" on public.local_news;
create policy "read_approved_news" on public.local_news for select to anon, authenticated using (status = 'approved');
revoke all on public.local_news from anon, authenticated;
grant select (id, region, title, url, source, published_at) on public.local_news to anon, authenticated;

insert into public.news_sources (region, name, url) values
  ('Maui', 'Maui Now',            'https://mauinow.com/feed/'),
  ('Oahu', 'Honolulu Civil Beat', 'https://www.civilbeat.org/feed/'),
  ('Oahu', 'Star-Advertiser',     'https://www.staradvertiser.com/feed/')
on conflict (url) do nothing;

create table if not exists public.place_requests (
  place      text primary key check (char_length(place) between 2 and 100),
  requests   integer not null default 1,
  last_asked timestamptz not null default now()
);
alter table public.place_requests enable row level security;    -- no policies: only the function below writes
revoke all on public.place_requests from anon, authenticated;

-- One call from the app. Counts at most one request per place per call; no rows are readable by the app.
create or replace function public.request_place(p_place text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := lower(btrim(regexp_replace(coalesce(p_place, ''), '\s+', ' ', 'g')));
begin
  if char_length(v) < 2 or char_length(v) > 100 then return; end if;
  insert into public.place_requests (place) values (v)
  on conflict (place) do update set requests = place_requests.requests + 1, last_asked = now();
end $$;
revoke all on function public.request_place(text) from public;
grant execute on function public.request_place(text) to anon, authenticated;
