-- Post once, AI step: who may use it, and a daily limit.  NOT APPLIED. Jordan applies migrations (CLAUDE.md).
--
--   verified_hosts : the hosts you have checked by hand (a group's name, who you spoke to). The edge function
--                    `post-once-write` refuses everyone else. Add a row yourself, from the SQL editor, after you
--                    have verified a host:
--                      insert into public.verified_hosts (user_id, org_name, note)
--                      values ('<their auth user id>', 'Harbor Street Kitchen', 'Spoke with Pat, Nov 5');
--   ai_usage       : how many AI calls each person made today, so cost cannot run away.
-- Both tables are readable and writable only by the service role (the edge function). No policies on purpose.

create table if not exists public.verified_hosts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  org_name    text not null check (char_length(org_name) between 2 and 80),
  note        text not null default '' check (char_length(note) <= 300),
  verified_at timestamptz not null default now()
);
alter table public.verified_hosts enable row level security;
revoke all on public.verified_hosts from anon, authenticated;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  calls   integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Adds one call for today and says whether it was inside the limit. Called by the edge function only.
create or replace function public.bump_ai_usage(p_user uuid, p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_calls integer;
begin
  insert into public.ai_usage (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  return v_calls <= p_limit;
end $$;
revoke all on function public.bump_ai_usage(uuid, integer) from public, anon, authenticated;
