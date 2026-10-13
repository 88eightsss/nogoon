-- Daily "good news" feed. One batch per day, written by the `feed-daily` edge function
-- (service role). The app only reads, so it never spends news or model quota per user.
create table if not exists public.feed_items (
  id          uuid primary key default gen_random_uuid(),
  day         date        not null,
  rank        smallint    not null default 0,          -- 0 = top pick of the day
  headline    text        not null check (char_length(headline) <= 140),
  summary     text        not null check (char_length(summary)  <= 400),
  source      text        not null default '',
  url         text        not null,
  category    text        not null default 'good',
  created_at  timestamptz not null default now(),
  unique (day, url)
);

create index if not exists feed_items_day_rank_idx on public.feed_items (day desc, rank asc);

alter table public.feed_items enable row level security;

-- Signed-in users can read. No insert/update/delete policies: only the service role writes.
drop policy if exists "feed_items readable by signed-in users" on public.feed_items;
create policy "feed_items readable by signed-in users"
  on public.feed_items for select
  to authenticated
  using (true);
