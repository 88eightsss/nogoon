-- Anonymous usage counts.
--
-- Answers "does the app work and do people stay" without knowing who anyone is.
--   usage_daily   one row per day, event and app version, with a count.
--   usage_active  one row per day per RANDOM token. The phone makes a new random token every day and
--                 keeps no link between days, so this counts how many phones were active that day (daily
--                 active users) but cannot follow a person from one day to the next.
-- No account, email, device id or location is ever stored. Both tables are closed to the public; the
-- app can only call report_usage(), which accepts a short fixed list of event names and clamps counts.
-- Read the numbers in the Supabase SQL editor:  select * from public.usage_overview;

create table if not exists public.usage_daily (
  day         date    not null,
  event       text    not null check (event in ('onboarded','demo_done','accessibility_on','gate_open','walk_away','outing')),
  app_version text    not null default '' check (char_length(app_version) <= 20),
  n           bigint  not null default 0 check (n >= 0),
  primary key (day, event, app_version)
);

create table if not exists public.usage_active (
  day         date not null,
  token       text not null check (char_length(token) between 16 and 40),
  app_version text not null default '' check (char_length(app_version) <= 20),
  primary key (day, token)
);

alter table public.usage_daily  enable row level security;
alter table public.usage_active enable row level security;
revoke all on public.usage_daily, public.usage_active from anon, authenticated;

create or replace function public.report_usage(p_token text, p_version text, p_counts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  v numeric;
  ver text := left(coalesce(p_version, ''), 20);
  today date := (now() at time zone 'utc')::date;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 40 then return; end if;
  -- Stop a flood from filling the table: at most 200000 active tokens per day.
  if (select count(*) from public.usage_active where day = today) < 200000 then
    insert into public.usage_active(day, token, app_version) values (today, p_token, ver) on conflict do nothing;
  end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'object' then return; end if;
  for k in select jsonb_object_keys(p_counts) loop
    if k in ('onboarded','demo_done','accessibility_on','gate_open','walk_away','outing') then
      begin
        v := (p_counts ->> k)::numeric;
      exception when others then
        v := 0;
      end;
      v := least(greatest(coalesce(v, 0), 0), 500);
      if v >= 1 then
        insert into public.usage_daily(day, event, app_version, n) values (today, k, ver, floor(v))
        on conflict (day, event, app_version) do update set n = public.usage_daily.n + excluded.n;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.report_usage(text, text, jsonb) from public;
grant execute on function public.report_usage(text, text, jsonb) to anon, authenticated;

-- One row per day for reading in the SQL editor (service role only).
create or replace view public.usage_overview as
select d.day,
       (select count(*) from public.usage_active a where a.day = d.day) as active_phones,
       sum(n) filter (where event = 'onboarded')        as onboarded,
       sum(n) filter (where event = 'demo_done')        as saw_gate_preview,
       sum(n) filter (where event = 'accessibility_on') as turned_on_blocking,
       sum(n) filter (where event = 'gate_open')        as gate_opens,
       sum(n) filter (where event = 'walk_away')        as walk_aways,
       sum(n) filter (where event = 'outing')           as outings
from public.usage_daily d
group by d.day
order by d.day desc;
revoke all on public.usage_overview from anon, authenticated;
