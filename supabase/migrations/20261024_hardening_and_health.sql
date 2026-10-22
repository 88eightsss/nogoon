-- Backend hardening + monitoring.
--
-- 1. ad_events accepted inserts from anyone with no limits ("with check (true)"), and the app does not
--    write that table at all. Drop the open policy so nobody can fill the database with junk; the
--    service role (edge functions) can still write it if a feature needs it later.
-- 2. job_runs: one row per scheduled run (feed-daily, events-draft) so a broken job is noticed by the
--    `health` function instead of silently stopping.
-- 3. crash_reports: anonymous crash reports sent by the app through the report-crash function.
--    No user id, no account, no device identifier; only app version, phone model, the error and the screen.
-- All three tables are readable only with the service role (Table Editor / SQL).

drop policy if exists "insert_events" on public.ad_events;
revoke insert on public.ad_events from anon, authenticated;

create table if not exists public.job_runs (
  id     bigint generated always as identity primary key,
  job    text    not null check (char_length(job) <= 40),
  ok     boolean not null,
  detail jsonb   not null default '{}'::jsonb,
  ran_at timestamptz not null default now()
);
create index if not exists job_runs_job_ran_idx on public.job_runs (job, ran_at desc);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;

create table if not exists public.crash_reports (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  kind        text not null check (kind in ('js', 'boundary')),
  app_version text not null default '' check (char_length(app_version) <= 20),
  build       text not null default '' check (char_length(build) <= 12),
  platform    text not null default '' check (char_length(platform) <= 12),
  os_version  text not null default '' check (char_length(os_version) <= 20),
  device      text not null default '' check (char_length(device) <= 60),
  screen      text not null default '' check (char_length(screen) <= 80),
  message     text not null default '' check (char_length(message) <= 500),
  stack       text not null default '' check (char_length(stack) <= 3000)
);
create index if not exists crash_reports_at_idx on public.crash_reports (at desc);
alter table public.crash_reports enable row level security;
revoke all on public.crash_reports from anon, authenticated;

-- Handy to read: select message, count(*), max(at), max(app_version) from crash_reports group by message order by 2 desc;
