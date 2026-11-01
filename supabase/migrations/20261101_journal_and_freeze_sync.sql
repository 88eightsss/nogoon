-- Restore journal entries and streak freeze tokens on a reinstall or new phone.
--
-- Freeze tokens ride on the profile row, like blocked_apps. The app falls back
-- to upserting without this column if it is missing, so it is safe to ship the
-- app before this runs.
alter table public.profiles
  add column if not exists streak_freeze_tokens integer not null default 0;

-- The app reads journal entries back newest first. Make sure the timestamp it
-- orders by exists (no-op if the table already has it).
alter table public.journal_entries
  add column if not exists created_at timestamptz not null default now();

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

-- No new tables, so no new RLS policies: profiles and journal_entries keep the
-- row-level security they already have (users read/write only their own rows).
