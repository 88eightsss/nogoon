-- Step Out, phase 2: doors, crews and postcards.  NOT APPLIED. Jordan applies migrations (CLAUDE.md).
--
-- What this adds, and what it refuses to add:
--   * doors + door_replies: a private invite. Only a "coming" reply is ever stored. "Not this time" and
--     "Look at it later" write NOTHING, so the sender can never tell who looked or declined.
--   * crews + crew_members + crew_invites: up to 8 people who go together. Not a chat.
--   * postcards: one line (140 characters) to your crew only, gone after 7 days.
--   * No counts anywhere: no view counts, no "N people are coming" read for anyone but the sender of a door
--     (and the sender sees who said yes, not how many looked).
-- Every table has row level security on, and clients only get the policies written here. Anything that must hold
-- even if a client is wrong (crew size, expiry, one reply per person) is enforced in the database.
-- The app today still runs on sample data (constants/stepOutSample.ts) and does not call any of this yet.

-- Supabase grants new functions to anon by default, so each one below is revoked from anon as well as from public.

-- ─── helpers ──────────────────────────────────────────────────────────────────────────────────

-- plpgsql, not sql: a sql function is checked when it is created, and crew_members does not exist yet.
create or replace function public.is_crew_member(p_crew uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.crew_members m where m.crew_id = p_crew and m.user_id = auth.uid());
end $$;
revoke all on function public.is_crew_member(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid) to authenticated;

-- ─── doors ────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.doors (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 3 and 120),
  host       text not null default '' check (char_length(host) <= 80),
  when_text  text not null default '' check (char_length(when_text) <= 80),
  area       text not null default '' check (char_length(area) <= 60),   -- coarse area only, never an address
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists doors_sender_idx on public.doors (sender, created_at desc);
alter table public.doors enable row level security;

drop policy if exists doors_sender_all on public.doors;
create policy doors_sender_all on public.doors
  for all to authenticated using (sender = auth.uid()) with check (sender = auth.uid());

-- A door is capped at five a day per sender, so it cannot be used to spam.
create or replace function public.doors_daily_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.doors where sender = new.sender and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Five doors a day is the limit. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists doors_daily_cap_trg on public.doors;
create trigger doors_daily_cap_trg before insert on public.doors for each row execute function public.doors_daily_cap();

-- What a friend sees when they open the link: the thing, never who else looked.
create or replace function public.door_by_id(p_door uuid)
returns table (title text, host text, when_text text, area text)
language sql stable security definer set search_path = public as $$
  select d.title, d.host, d.when_text, d.area from public.doors d where d.id = p_door and d.expires_at > now()
$$;
revoke all on function public.door_by_id(uuid) from public, anon;
grant execute on function public.door_by_id(uuid) to authenticated;

-- ─── door replies: only "coming" exists ──────────────────────────────────────────────────────

create table if not exists public.door_replies (
  door_id    uuid not null references public.doors (id) on delete cascade,
  replier    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (door_id, replier)
);
alter table public.door_replies enable row level security;
revoke insert, update, delete on public.door_replies from anon, authenticated;   -- writes go through coming_to_door()

-- The sender of a door can see who said yes. Nobody else can read replies.
drop policy if exists door_replies_sender_read on public.door_replies;
create policy door_replies_sender_read on public.door_replies
  for select to authenticated
  using (exists (select 1 from public.doors d where d.id = door_id and d.sender = auth.uid()));

create or replace function public.coming_to_door(p_door uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.door_replies (door_id, replier)
  select d.id, auth.uid() from public.doors d where d.id = p_door and d.expires_at > now()
  on conflict do nothing;
end $$;
revoke all on function public.coming_to_door(uuid) from public, anon;
grant execute on function public.coming_to_door(uuid) to authenticated;

-- ─── crews: up to eight people who go together ───────────────────────────────────────────────

create table if not exists public.crews (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default 'My crew' check (char_length(name) between 1 and 30),
  next_ref   text check (next_ref is null or char_length(next_ref) <= 80),   -- the shared next thing (event id)
  created_at timestamptz not null default now()
);
alter table public.crews enable row level security;

create table if not exists public.crew_members (
  crew_id      uuid not null references public.crews (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 24),
  joined_at    timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_user_idx on public.crew_members (user_id);
alter table public.crew_members enable row level security;

-- Eight is the cap, enforced here so no client can get around it.
create or replace function public.crew_size_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 8 then
    raise exception 'A crew has room for eight people.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists crew_size_cap_trg on public.crew_members;
create trigger crew_size_cap_trg before insert on public.crew_members for each row execute function public.crew_size_cap();

-- The person who starts a crew is its first member.
create or replace function public.crew_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.crew_members (crew_id, user_id) values (new.id, new.owner) on conflict do nothing;
  return new;
end $$;
drop trigger if exists crew_add_owner_trg on public.crews;
create trigger crew_add_owner_trg after insert on public.crews for each row execute function public.crew_add_owner();

drop policy if exists crews_member_read on public.crews;
-- The owner clause lets INSERT ... RETURNING work: the member row is added by an AFTER trigger, which has not run yet
-- when the returned row is checked against this policy.
create policy crews_member_read on public.crews for select to authenticated using (owner = auth.uid() or public.is_crew_member(id));
drop policy if exists crews_owner_insert on public.crews;
create policy crews_owner_insert on public.crews for insert to authenticated with check (owner = auth.uid());
drop policy if exists crews_member_update on public.crews;
create policy crews_member_update on public.crews for update to authenticated
  using (public.is_crew_member(id)) with check (public.is_crew_member(id));
revoke update on public.crews from anon, authenticated;
grant update (name, next_ref) on public.crews to authenticated;   -- not owner
drop policy if exists crews_owner_delete on public.crews;
create policy crews_owner_delete on public.crews for delete to authenticated using (owner = auth.uid());

drop policy if exists crew_members_read on public.crew_members;
create policy crew_members_read on public.crew_members for select to authenticated using (public.is_crew_member(crew_id));
drop policy if exists crew_members_leave on public.crew_members;
create policy crew_members_leave on public.crew_members for delete to authenticated using (user_id = auth.uid());
drop policy if exists crew_members_rename on public.crew_members;
create policy crew_members_rename on public.crew_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert on public.crew_members from anon, authenticated;   -- joining goes through join_crew()
-- A member may change only their own display name. Without this, an UPDATE could move their row into another crew
-- (skipping the invite and the size cap) or hand them ownership of a crew.
revoke update on public.crew_members from anon, authenticated;
grant update (display_name) on public.crew_members to authenticated;

-- Invites are private codes, good for three days.
create table if not exists public.crew_invites (
  code       text primary key check (char_length(code) between 8 and 32),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '3 days')
);
alter table public.crew_invites enable row level security;
drop policy if exists crew_invites_member_all on public.crew_invites;
create policy crew_invites_member_all on public.crew_invites
  for all to authenticated using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id) and created_by = auth.uid());

create or replace function public.join_crew(p_code text, p_name text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_crew uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select crew_id into v_crew from public.crew_invites where code = p_code and expires_at > now();
  if v_crew is null then raise exception 'That invite is no longer good.'; end if;
  insert into public.crew_members (crew_id, user_id, display_name)
  values (v_crew, auth.uid(), left(coalesce(p_name, ''), 24)) on conflict do nothing;
  return v_crew;
end $$;
revoke all on function public.join_crew(text, text) from public, anon;
grant execute on function public.join_crew(text, text) to authenticated;

-- ─── postcards: one line, crew only, gone after seven days ───────────────────────────────────

create table if not exists public.postcards (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  author     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  line       text not null check (char_length(line) between 1 and 140),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists postcards_crew_idx on public.postcards (crew_id, created_at desc);
alter table public.postcards enable row level security;

drop policy if exists postcards_read on public.postcards;
create policy postcards_read on public.postcards for select to authenticated
  using (public.is_crew_member(crew_id) and expires_at > now());
drop policy if exists postcards_write on public.postcards;
create policy postcards_write on public.postcards for insert to authenticated
  with check (author = auth.uid() and public.is_crew_member(crew_id));
drop policy if exists postcards_delete_own on public.postcards;
create policy postcards_delete_own on public.postcards for delete to authenticated using (author = auth.uid());

-- Expired rows are hidden by the read policy already. This actually removes them; call it from a daily schedule.
create or replace function public.purge_expired_stepout() returns void
language sql security definer set search_path = public as $$
  delete from public.postcards where expires_at < now();
  delete from public.doors where expires_at < now() - interval '30 days';
$$;
revoke all on function public.purge_expired_stepout() from public, anon, authenticated;
