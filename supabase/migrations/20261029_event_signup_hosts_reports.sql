-- Sign-up links, host submissions and reports for community events.
--
-- The app NEVER takes sign-ups. An event can carry a `signup_url` to the organiser's own form; the app
-- opens it and says plainly that opening it does not sign anyone up. We store no names or emails of attendees.
--
-- Hardened at the database, not just in the app (like the blocker, it must hold even if a client is wrong):
--   * url_ok(): https only, no user@ tricks, no bare IP addresses, no link shorteners that hide the destination.
--   * Every write path to community_events is checked by it (NOT VALID so old rows are untouched, but every new
--     or changed row is enforced).
--   * Hosts submit through the `event-submit` function into `event_submissions` (always 'pending'); only you
--     approve, with approve_event_submission(id) from the SQL editor.
--   * report_event(): three reports in a week pull a listing back to 'pending' (hidden from the app) for review.
-- Review: select * from event_submissions where status = 'pending' order by created_at;
--         select public.approve_event_submission('<id>');
--         update event_submissions set status = 'rejected' where id = '<id>';

create or replace function public.url_ok(u text) returns boolean
language sql immutable as $$
  select u is not null
     and char_length(u) <= 500
     and u ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]+)?(/|\?|#|$)'
     and u !~* '^https://[0-9.]+(:[0-9]+)?(/|\?|#|$)'
     and u !~* '^https://([a-z0-9-]+\.)*(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|t\.ly|lnkd\.in)(:[0-9]+)?(/|\?|#|$)'
$$;

alter table public.community_events add column if not exists signup_url text;
alter table public.community_events add column if not exists host_org  text not null default '';
alter table public.community_events drop constraint if exists community_events_signup_url_ok;
alter table public.community_events add constraint community_events_signup_url_ok
  check (signup_url is null or public.url_ok(signup_url)) not valid;
alter table public.community_events drop constraint if exists community_events_url_ok;
alter table public.community_events add constraint community_events_url_ok
  check (public.url_ok(url)) not valid;
alter table public.community_events drop constraint if exists community_events_host_org_len;
alter table public.community_events add constraint community_events_host_org_len check (char_length(host_org) <= 80);

create table if not exists public.event_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  org_name      text not null check (char_length(org_name) between 2 and 80),
  contact_email text not null check (contact_email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' and char_length(contact_email) <= 120),
  title         text not null check (char_length(title) between 3 and 120),
  summary       text not null default '' check (char_length(summary) <= 300),
  kind          text not null default 'community' check (kind in ('market', 'volunteer', 'community', 'outdoors', 'class', 'music', 'other')),
  region        text not null check (char_length(region) between 2 and 60),
  place_name    text not null default '' check (char_length(place_name) <= 120),
  when_text     text not null default '' check (char_length(when_text) <= 120),
  starts_at     timestamptz,
  ends_at       timestamptz,
  recurring     boolean not null default false,
  cost          text not null default '' check (char_length(cost) <= 40),
  url           text not null check (public.url_ok(url)),
  signup_url    text check (signup_url is null or public.url_ok(signup_url)),
  ip_hash       text not null default '' check (char_length(ip_hash) <= 64)
);
create index if not exists event_submissions_status_idx on public.event_submissions (status, created_at);
create index if not exists event_submissions_ip_idx on public.event_submissions (ip_hash, created_at);
alter table public.event_submissions enable row level security;     -- no policies: only the function (service role) writes
revoke all on public.event_submissions from anon, authenticated;

create or replace function public.approve_event_submission(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into public.community_events
    (title, summary, kind, region, place_name, when_text, starts_at, ends_at, recurring, cost, url, signup_url, host_org, source, status)
  select title, summary, kind, region, place_name, when_text, starts_at, ends_at, recurring, cost, url, signup_url, org_name, 'host', 'approved'
    from public.event_submissions where id = p_id and status = 'pending'
  on conflict (title, url, when_text) do nothing
  returning id into v;
  if v is null then raise exception 'nothing approved: not pending, or already listed'; end if;
  update public.event_submissions set status = 'approved' where id = p_id;
  return v;
end $$;
revoke all on function public.approve_event_submission(uuid) from public, anon, authenticated;

create table if not exists public.event_reports (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references public.community_events(id) on delete cascade,
  reason     text not null check (reason in ('wrong', 'unsafe', 'spam', 'other')),
  created_at timestamptz not null default now()
);
create index if not exists event_reports_event_idx on public.event_reports (event_id, created_at);
alter table public.event_reports enable row level security;
revoke all on public.event_reports from anon, authenticated;

create or replace function public.report_event(p_event uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_reason not in ('wrong', 'unsafe', 'spam', 'other') then return; end if;
  if not exists (select 1 from public.community_events where id = p_event and status = 'approved') then return; end if;
  insert into public.event_reports (event_id, reason) values (p_event, p_reason);
  -- Three reports in a week send it back for review. It is hidden, not deleted: set status = 'approved' to restore it.
  if (select count(*) from public.event_reports where event_id = p_event and created_at > now() - interval '7 days') >= 3 then
    update public.community_events set status = 'pending' where id = p_event and status = 'approved';
  end if;
end $$;
revoke all on function public.report_event(uuid, text) from public;
grant execute on function public.report_event(uuid, text) to anon, authenticated;
