-- Community events: farmers markets, volunteering, free things to do. Hand-approved.
-- Rows arrive as 'pending' (typed in by hand or drafted by the events-draft function from the
-- pages listed in event_sources). Only 'approved' rows are readable by the app.
create table if not exists public.community_events (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null check (char_length(title) <= 120),
  summary     text        not null default '' check (char_length(summary) <= 300),
  kind        text        not null default 'community'
              check (kind in ('market', 'volunteer', 'community', 'outdoors', 'class', 'music', 'other')),
  region      text        not null,                  -- e.g. 'Oahu', 'Maui', 'Hawaii (statewide)'
  place_name  text        not null default '',       -- venue or neighbourhood
  when_text   text        not null default '',       -- what people read: 'Saturdays 7:30-11 am'
  starts_at   timestamptz,                           -- first/next occurrence, if known
  ends_at     timestamptz,                           -- when it is over (one-offs)
  recurring   boolean     not null default false,    -- weekly/monthly things never "expire"
  cost        text        not null default '',       -- 'Free', '$5', ''
  url         text        not null check (url ~ '^https://'),
  source      text        not null default '',       -- who published it
  status      text        not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at  timestamptz not null default now(),
  unique (title, url, when_text)
);

create index if not exists community_events_status_region_idx on public.community_events (status, region);

alter table public.community_events enable row level security;

drop policy if exists "approved events readable" on public.community_events;
create policy "approved events readable"
  on public.community_events for select
  to authenticated
  using (status = 'approved');
-- No insert/update/delete policies: only the service role (Table Editor, SQL, edge function) writes.

-- Pages the events-draft function reads. You choose these; check each site's terms first.
create table if not exists public.event_sources (
  id        uuid primary key default gen_random_uuid(),
  region    text    not null,
  kind_hint text    not null default 'community',
  url       text    not null check (url ~ '^https://'),
  notes     text    not null default '',
  active    boolean not null default true,
  unique (url)
);
alter table public.event_sources enable row level security;   -- no policies: service role only
