-- Keep the user's NoGoon start date ("Day N" on the Me tab) with their account,
-- so it survives a reinstall or new phone and never carries over between accounts.
-- Stored as the local calendar day the user started ('YYYY-MM-DD').
-- No new table: profiles already has row-level security limiting rows to their owner.
alter table public.profiles
  add column if not exists start_date date;
