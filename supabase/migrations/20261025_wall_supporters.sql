-- ─── The Wall: supporter tiles ───────────────────────────────────────────────────
--
-- Anyone signed in can buy ONE tile at a time for $2.50 (Google Play Billing product
-- `nogoon_wall_tile`, bought through RevenueCat) and put a small image on it. They pick the tile.
-- Sponsors and supporters share the same board; supporter tiles are always 1x1, show only the image
-- and have no link. The wall is also enlarged to 100 x 100 (10,000 tiles).
--
-- Life of a supporter tile (status):
--   reserved        cell held for 20 minutes while the image is chosen
--   ready           image uploaded AND passed the automatic scan; waiting for payment (held 30 minutes)
--   pending_review  paid (RevenueCat webhook); waiting for the owner to approve
--   live            showing on the wall for 12 months
--   rejected / removed / expired / cancelled   not showing
--
-- Nothing shows until the scan passed AND it was approved. To review (SQL editor):
--   select id, image_url, x, y, user_id, scan from public.wall_supporters where status = 'pending_review' order by created_at;
--   select public.supporter_approve('<id>');
--   select public.supporter_remove('<id>', 'reason');   -- then refund the purchase in Play Console
-- Reports from the app:  select * from public.wall_reports where supporter_id is not null and not handled;
--
-- Sponsor pricing ignores supporter tiles (wall_sold_tiles is unchanged), so supporters never push
-- the sponsor price up.

-- A bigger wall.
update public.wall_config set cols = 100, rows = 100 where id = 1;

create table if not exists public.wall_supporters (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  x int not null check (x >= 0),
  y int not null check (y >= 0),
  image_path     text,
  image_url      text check (image_url is null or (image_url ~* '^https://[^ ]+$' and char_length(image_url) <= 400)),
  status         text not null default 'reserved'
                   check (status in ('reserved', 'ready', 'pending_review', 'live', 'rejected', 'removed', 'expired', 'cancelled')),
  reserved_until timestamptz,
  scan           jsonb,
  txn_id         text unique,
  paid_at        timestamptz,
  starts_at      timestamptz,
  ends_at        timestamptz,
  review_note    text
);
create index if not exists idx_wall_supporters_user on public.wall_supporters (user_id, status);
create index if not exists idx_wall_supporters_status on public.wall_supporters (status, ends_at);

-- Every purchase event we receive, once each. Also catches a payment that has no matching tile
-- (so it can be refunded by hand).
create table if not exists public.supporter_purchases (
  txn_id     text primary key,
  created_at timestamptz not null default now(),
  user_id    uuid,
  product    text,
  matched    uuid references public.wall_supporters(id) on delete set null,
  refunded   boolean not null default false,
  note       text
);

alter table public.wall_reports add column if not exists supporter_id uuid references public.wall_supporters(id) on delete cascade;

alter table public.wall_supporters     enable row level security;
alter table public.supporter_purchases enable row level security;
revoke all on public.wall_supporters, public.supporter_purchases from anon, authenticated;

-- ── One check for "is this rectangle free" across sponsors and supporters ──────────
create or replace function public.wall_cells_free(p_x int, p_y int, p_w int, p_h int, p_except uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.wall_listings l
    where (l.status in ('pending_payment', 'pending_review') or (l.status = 'live' and l.ends_at > now()))
      and box(point(l.x, l.y), point(l.x + l.w - 1, l.y + l.h - 1)) && box(point(p_x, p_y), point(p_x + p_w - 1, p_y + p_h - 1))
  ) and not exists (
    select 1 from public.wall_supporters s
    where (p_except is null or s.id <> p_except)
      and ((s.status in ('reserved', 'ready') and s.reserved_until > now())
           or s.status = 'pending_review'
           or (s.status = 'live' and s.ends_at > now()))
      and box(point(s.x, s.y), point(s.x, s.y)) && box(point(p_x, p_y), point(p_x + p_w - 1, p_y + p_h - 1))
  );
$$;
revoke execute on function public.wall_cells_free(int, int, int, int, uuid) from public, anon, authenticated;

create or replace function public.wall_supporter_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.wall_config%rowtype;
begin
  select * into cfg from public.wall_config where id = 1;
  if new.x >= cfg.cols or new.y >= cfg.rows then raise exception 'That tile is outside the wall'; end if;
  if new.status in ('reserved', 'ready', 'pending_review', 'live') then
    perform pg_advisory_xact_lock(7770001);
    if not public.wall_cells_free(new.x, new.y, 1, 1, new.id) then
      raise exception 'That tile was just taken';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wall_supporters_guard on public.wall_supporters;
create trigger wall_supporters_guard before insert or update of x, y, status on public.wall_supporters
  for each row execute function public.wall_supporter_guard();

-- Sponsors can no longer be placed over a supporter tile.
create or replace function public.wall_listing_vs_supporters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('pending_payment', 'pending_review', 'live') then
    perform pg_advisory_xact_lock(7770001);
    if exists (
      select 1 from public.wall_supporters s
      where ((s.status in ('reserved', 'ready') and s.reserved_until > now())
             or s.status = 'pending_review' or (s.status = 'live' and s.ends_at > now()))
        and box(point(s.x, s.y), point(s.x, s.y)) && box(point(new.x, new.y), point(new.x + new.w - 1, new.y + new.h - 1))
    ) then
      raise exception 'Some of those tiles are taken by supporters';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wall_listings_vs_supporters on public.wall_listings;
create trigger wall_listings_vs_supporters before insert or update of x, y, w, h, status on public.wall_listings
  for each row execute function public.wall_listing_vs_supporters();

-- The sponsor quote now also refuses tiles that supporters hold.
create or replace function public.wall_quote(p_x int, p_y int, p_w int, p_h int, p_months int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg public.wall_config%rowtype; total int; sold int; n int; c numeric;
        per_month numeric; disc numeric; is_free boolean;
begin
  if p_months not in (1, 3, 12) then raise exception 'months must be 1, 3 or 12'; end if;
  select * into cfg from public.wall_config where id = 1;
  total := cfg.cols * cfg.rows;
  n := greatest(p_w, 1) * greatest(p_h, 1);
  sold := public.wall_sold_tiles();
  c := cfg.curve;
  per_month := cfg.base_cents * n
    + (cfg.top_cents - cfg.base_cents) * (power(sold + n, c + 1) - power(sold, c + 1)) / ((c + 1) * power(total, c));
  disc := case p_months when 3 then 0.10 when 12 then 0.25 else 0 end;
  is_free := p_x >= 0 and p_y >= 0 and p_w between 1 and 10 and p_h between 1 and 10
    and p_x + p_w <= cfg.cols and p_y + p_h <= cfg.rows
    and public.wall_cells_free(p_x, p_y, p_w, p_h);
  return jsonb_build_object(
    'tiles', n, 'months', p_months, 'free', is_free,
    'per_month_cents', round(per_month),
    'discount_pct', round(disc * 100),
    'total_cents', round(per_month * p_months * (1 - disc))
  );
end $$;
grant execute on function public.wall_quote(int, int, int, int, int) to anon, authenticated;

-- Stats: adds how many supporter tiles are live. "sold" (sponsor tiles) still drives sponsor pricing.
create or replace function public.wall_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg public.wall_config%rowtype; sold int; total int; sup int;
begin
  select * into cfg from public.wall_config where id = 1;
  total := cfg.cols * cfg.rows;
  sold := public.wall_sold_tiles();
  select count(*)::int into sup from public.wall_supporters where status = 'live' and ends_at > now();
  return jsonb_build_object(
    'cols', cfg.cols, 'rows', cfg.rows, 'total', total, 'sold', sold, 'supporters', sup,
    'base_cents', cfg.base_cents, 'top_cents', cfg.top_cents,
    'unit_cents_now', round(cfg.base_cents + (cfg.top_cents - cfg.base_cents) * power(sold::numeric / total, cfg.curve))
  );
end $$;
grant execute on function public.wall_stats() to anon, authenticated;

-- The public board: live sponsors and live supporters. Supporter rows carry no name and no link.
-- `kind` is appended last so older readers keep working.
create or replace view public.wall_public as
  select id, x, y, w, h, company, headline, url, image_url, color, category, region, 'sponsor'::text as kind
    from public.wall_listings
   where status = 'live' and ends_at > now()
  union all
  select id, x, y, 1, 1, 'Supporter', null, '', image_url, '#C7DFF2', 'supporter', null, 'supporter'::text
    from public.wall_supporters
   where status = 'live' and ends_at > now();
grant select on public.wall_public to anon, authenticated;

-- Review actions (SQL editor only).
create or replace function public.supporter_approve(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wall_supporters
     set status = 'live', starts_at = now(), ends_at = now() + interval '365 days'
   where id = p_id and status = 'pending_review';
  if not found then raise exception 'That tile is not waiting for review'; end if;
end $$;

create or replace function public.supporter_remove(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wall_supporters set status = 'removed', review_note = p_note
   where id = p_id and status in ('ready', 'pending_review', 'live');
  if not found then raise exception 'Nothing to remove'; end if;
end $$;
revoke execute on function public.supporter_approve(uuid), public.supporter_remove(uuid, text) from public, anon, authenticated;

-- The hourly job also frees holds and expires finished tiles.
create or replace function public.wall_maintenance() returns void
language sql security definer set search_path = public as $$
  update public.wall_listings set status = 'expired' where status = 'live' and ends_at <= now();
  update public.wall_listings set status = 'cancelled' where status = 'pending_payment' and created_at < now() - interval '1 hour';
  update public.wall_supporters set status = 'expired' where status = 'live' and ends_at <= now();
  update public.wall_supporters set status = 'cancelled' where status in ('reserved', 'ready') and reserved_until < now() - interval '1 hour';
$$;
revoke execute on function public.wall_maintenance() from public, anon, authenticated;

-- Images live in a public bucket with random file names. Only the service role (the `supporter` function)
-- writes to it. A pending image is reachable only by someone who has its exact link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall-supporters', 'wall-supporters', true, 307200, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
