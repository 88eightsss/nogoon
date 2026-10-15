-- ─── The Wall: a finite, sold-by-the-tile sponsor board ──────────────────────────
--
-- 3,000 tiles (60 x 50). A company buys a rectangle of tiles (its banner: name, line,
-- link, colour) for 1, 3 or 12 months. The price per tile follows a fixed curve that rises
-- as the wall fills (no bidding). Every listing is reviewed by hand before it goes live.
-- Separate from public.ad_campaigns (those are in-game placements).
--
-- Tunable settings live in wall_config (one row): base_cents = price per tile per month on an
-- empty wall, top_cents = price on a full wall, curve = 1 linear, >1 stays cheaper for longer.
--
-- Clients never read the tables. The app and the web page read the view wall_public and the
-- functions wall_stats / wall_quote; writes go through the `wall` edge function (service role).
--
-- Review (SQL editor):
--   select id, company, headline, url, category, x, y, w, h, months, contact_email
--     from public.wall_listings where status = 'pending_review' order by created_at;
--   select public.wall_approve('<id>');          -- goes live now, runs for the months bought
--   select public.wall_reject('<id>', 'reason'); -- then refund the card payment in Stripe
--
-- Housekeeping (pg_cron, hourly): select cron.schedule('wall-maintenance', '5 * * * *', $$ select public.wall_maintenance(); $$);

create table if not exists public.wall_config (
  id          int primary key default 1 check (id = 1),
  cols        int not null default 60 check (cols between 1 and 200),
  rows        int not null default 50 check (rows between 1 and 200),
  base_cents  int not null default 50   check (base_cents >= 50),   -- per tile per month, empty wall
  top_cents   int not null default 500  check (top_cents >= 50),    -- per tile per month, full wall
  curve       numeric not null default 2 check (curve >= 1 and curve <= 6)
);
insert into public.wall_config (id) values (1) on conflict do nothing;

create table if not exists public.wall_listings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  x int not null, y int not null, w int not null, h int not null,
  constraint wall_size check (x >= 0 and y >= 0 and w between 1 and 10 and h between 1 and 10),

  company       text not null check (char_length(company) between 2 and 40),
  headline      text check (headline is null or char_length(headline) <= 60),
  url           text not null check (url ~* '^https://[^ ]+$' and char_length(url) <= 300),
  image_url     text check (image_url is null or (image_url ~* '^https://[^ ]+$' and char_length(image_url) <= 300)),
  color         text not null default '#1B62C2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Only these categories can be bought. Adult, gambling, dating, alcohol, crypto and
  -- social / short-video apps are not offered, and are refused in review if mislabelled.
  category      text not null check (category in (
    'food_drink', 'local_business', 'health_wellness', 'books_media', 'education',
    'tech_tools', 'art_craft', 'services', 'nonprofit', 'other')),
  contact_email text not null check (contact_email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),

  months        int not null check (months in (1, 3, 12)),
  price_cents   int not null check (price_cents >= 50),
  status        text not null default 'pending_payment'
                  check (status in ('pending_payment', 'pending_review', 'live', 'rejected', 'expired', 'cancelled')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  paid_at       timestamptz,
  stripe_session_id text unique,
  review_note   text
);

-- No two active listings may share a tile.
alter table public.wall_listings drop constraint if exists wall_no_overlap;
alter table public.wall_listings add constraint wall_no_overlap
  exclude using gist (box(point(x, y), point(x + w - 1, y + h - 1)) with &&)
  where (status in ('pending_payment', 'pending_review', 'live'));

create index if not exists idx_wall_listings_status on public.wall_listings (status, ends_at);

create or replace function public.wall_check_bounds() returns trigger
language plpgsql as $$
declare cfg public.wall_config%rowtype;
begin
  select * into cfg from public.wall_config where id = 1;
  if new.x + new.w > cfg.cols or new.y + new.h > cfg.rows then
    raise exception 'Those tiles are outside the wall';
  end if;
  return new;
end $$;
drop trigger if exists wall_listings_bounds on public.wall_listings;
create trigger wall_listings_bounds before insert or update of x, y, w, h on public.wall_listings
  for each row execute function public.wall_check_bounds();

create table if not exists public.wall_inquiries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company    text not null check (char_length(company) between 2 and 80),
  email      text not null check (email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
  message    text check (message is null or char_length(message) <= 1000),
  handled    boolean not null default false
);

create table if not exists public.wall_reports (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  listing_id uuid references public.wall_listings(id) on delete cascade,
  reason     text check (reason is null or char_length(reason) <= 300),
  handled    boolean not null default false
);

-- Tables are closed to clients; only the service role (edge functions) and the views/functions below.
alter table public.wall_config    enable row level security;
alter table public.wall_listings  enable row level security;
alter table public.wall_inquiries enable row level security;
alter table public.wall_reports   enable row level security;
revoke all on public.wall_config, public.wall_listings, public.wall_inquiries, public.wall_reports from anon, authenticated;

-- What the app and the web page may see: live listings, no contact details.
create or replace view public.wall_public as
  select id, x, y, w, h, company, headline, url, image_url, color, category
  from public.wall_listings
  where status = 'live' and ends_at > now();
grant select on public.wall_public to anon, authenticated;

-- Tiles that count toward the price: paid and waiting for review, or live.
create or replace function public.wall_sold_tiles() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(w * h), 0)::int from public.wall_listings
  where status = 'pending_review' or (status = 'live' and ends_at > now());
$$;

create or replace function public.wall_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg public.wall_config%rowtype; sold int; total int;
begin
  select * into cfg from public.wall_config where id = 1;
  total := cfg.cols * cfg.rows;
  sold := public.wall_sold_tiles();
  return jsonb_build_object(
    'cols', cfg.cols, 'rows', cfg.rows, 'total', total, 'sold', sold,
    'base_cents', cfg.base_cents, 'top_cents', cfg.top_cents,
    'unit_cents_now', round(cfg.base_cents + (cfg.top_cents - cfg.base_cents) * power(sold::numeric / total, cfg.curve))
  );
end $$;

-- Price for a rectangle. The per-tile price rises tile by tile as the wall fills, so a big block
-- bought on an empty wall pays along the same curve (the curve is integrated, not read once).
-- 3 months = 10% off, 12 months = 25% off.
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
    and not exists (
      select 1 from public.wall_listings l
      where (l.status in ('pending_payment', 'pending_review') or (l.status = 'live' and l.ends_at > now()))
        and box(point(l.x, l.y), point(l.x + l.w - 1, l.y + l.h - 1)) && box(point(p_x, p_y), point(p_x + p_w - 1, p_y + p_h - 1))
    );
  return jsonb_build_object(
    'tiles', n, 'months', p_months, 'free', is_free,
    'per_month_cents', round(per_month),
    'discount_pct', round(disc * 100),
    'total_cents', round(per_month * p_months * (1 - disc))
  );
end $$;
grant execute on function public.wall_stats() to anon, authenticated;
grant execute on function public.wall_quote(int, int, int, int, int) to anon, authenticated;
revoke execute on function public.wall_sold_tiles() from anon, authenticated;

-- Review actions: run from the SQL editor (service role / postgres), never from clients.
create or replace function public.wall_approve(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wall_listings
     set status = 'live', starts_at = now(), ends_at = now() + make_interval(days => 30 * months)
   where id = p_id and status = 'pending_review';
  if not found then raise exception 'Listing is not waiting for review'; end if;
end $$;

create or replace function public.wall_reject(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wall_listings set status = 'rejected', review_note = p_note
   where id = p_id and status in ('pending_review', 'live');
  if not found then raise exception 'Nothing to reject'; end if;
end $$;
revoke execute on function public.wall_approve(uuid), public.wall_reject(uuid, text) from public, anon, authenticated;

create or replace function public.wall_maintenance() returns void
language sql security definer set search_path = public as $$
  update public.wall_listings set status = 'expired' where status = 'live' and ends_at <= now();
  update public.wall_listings set status = 'cancelled' where status = 'pending_payment' and created_at < now() - interval '1 hour';
$$;
revoke execute on function public.wall_maintenance() from public, anon, authenticated;
