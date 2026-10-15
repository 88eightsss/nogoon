-- Briefing sections. 'good' = positive news (existing rows), 'curious' = what the world is looking up,
-- 'world' = a short, calm summary of major news. The app shows 'world' only if the user turns it on.
alter table public.feed_items
  add column if not exists section text not null default 'good'
  check (section in ('good', 'curious', 'world'));

create index if not exists feed_items_day_section_idx on public.feed_items (day desc, section, rank asc);
