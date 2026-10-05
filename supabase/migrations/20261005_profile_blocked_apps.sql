-- Sync the user's blocked Android apps (package names) across devices/reinstalls.
-- Websites already sync through the `blocklist` table; apps ride on the profile row.
alter table public.profiles
  add column if not exists blocked_apps text[] not null default '{}';
