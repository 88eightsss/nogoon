-- ─── The Wall: a global board and a local board per place ─────────────────────────
--
-- 'global'  the big board (100 x 100). Supporter tiles are $2.50. Sponsors who want everyone.
-- 'Maui', 'Oahu'  small local boards (25 x 25) whose tiles are drawn bigger in the app, so they are a showcase.
--           Supporter tiles are $5.00. Sponsor tiles start at $1.00 per tile per month. A listing on a local
--           board gets region = the board name, so the app's "near you" logic picks it up.
--
-- Every board has its own size, price curve, supporter price and Play product (all editable in wall_config).
-- Open a new place:  insert into public.wall_config (id, board, cols, rows, base_cents, top_cents, supporter_cents, supporter_product)
--                    values (4, 'Kauai', 25, 25, 100, 1000, 500, 'nogoon_wall_tile_local');
--                    (the board name must match the app's place names: see constants/places.ts)

alter table public.wall_config drop constraint if exists wall_config_id_check;
alter table public.wall_config add column if not exists board text not null default 'global';
alter table public.wall_config add column if not exists supporter_cents int not null default 250 check (supporter_cents >= 50);
alter table public.wall_config add column if not exists supporter_product text not null default 'nogoon_wall_tile';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wall_config_board_key') then
    alter table public.wall_config add constraint wall_config_board_key unique (board);
  end if;
end $$;
update public.wall_config set board = 'global', supporter_cents = 250, supporter_product = 'nogoon_wall_tile' where id = 1;
insert into public.wall_config (id, board, cols, rows, base_cents, top_cents, curve, supporter_cents, supporter_product) values
  (2, 'Maui', 25, 25, 100, 1000, 2, 500, 'nogoon_wall_tile_local'),
  (3, 'Oahu', 25, 25, 100, 1000, 2, 500, 'nogoon_wall_tile_local')
on conflict (id) do nothing;

alter table public.wall_listings  add column if not exists board text not null default 'global' references public.wall_config(board);
alter table public.wall_supporters add column if not exists board text not null default 'global' references public.wall_config(board);
create index if not exists idx_wall_listings_board on public.wall_listings (board, status);
create index if not exists idx_wall_supporters_board on public.wall_supporters (board, status);

-- The old "no two sponsors on one tile" exclusion constraint knew nothing about boards. The trigger below
-- (same advisory lock as the supporter checks) enforces it per board instead.
alter table public.wall_listings drop constraint if exists wall_no_overlap;

-- Replace the single-board functions (drop first so there is no ambiguity between old and new signatures).
drop function if exists public.wall_cells_free(int, int, int, int, uuid);
drop function if exists public.wall_quote(int, int, int, int, int);
drop function if exists public.wall_stats();
drop function if exists public.wall_sold_tiles();

-- Sponsor tiles that count toward a board's price: paid and waiting for review, or live.
create or replace function public.wall_sold_tiles(p_board text default 'global') returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(w * h), 0)::int from public.wall_listings
  where board = p_board and (status = 'pending_review' or (status = 'live' and ends_at > now()));
$$;

-- Is this rectangle free on this board (sponsors and supporters)?
create or replace function public.wall_cells_free(p_board text, p_x int, p_y int, p_w int, p_h int,
                                                  p_except_listing uuid default null, p_except_supporter uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.wall_listings l
    where l.board = p_board and (p_except_listing is null or l.id <> p_except_listing)
      and (l.status in ('pending_payment', 'pending_review') or (l.status = 'live' and l.ends_at > now()))
      and box(point(l.x, l.y), point(l.x + l.w - 1, l.y + l.h - 1)) && box(point(p_x, p_y), point(p_x + p_w - 1, p_y + p_h - 1))
  ) and not exists (
    select 1 from public.wall_supporters s
    where s.board = p_board and (p_except_supporter is null or s.id <> p_except_supporter)
      and ((s.status in ('reserved', 'ready') and s.reserved_until > now())
           or s.status = 'pending_review'
           or (s.status = 'live' and s.ends_at > now()))
      and box(point(s.x, s.y), point(s.x, s.y)) && box(point(p_x, p_y), point(p_x + p_w - 1, p_y + p_h - 1))
  );
$$;
revoke execute on function public.wall_cells_free(text, int, int, int, int, uuid, uuid) from public, anon, authenticated;

-- Sponsor listings: stay on the board, never overlap a sponsor or supporter on the same board.
create or replace function public.wall_check_bounds() returns trigger
language plpgsql as $$
declare cfg public.wall_config%rowtype;
begin
  select * into cfg from public.wall_config where board = new.board;
  if not found or new.x + new.w > cfg.cols or new.y + new.h > cfg.rows then
    raise exception 'Those tiles are outside the wall';
  end if;
  return new;
end $$;
-- (the existing trigger wall_listings_bounds keeps calling this; re-create it so it also fires on board changes)
drop trigger if exists wall_listings_bounds on public.wall_listings;
create trigger wall_listings_bounds before insert or update of x, y, w, h, board on public.wall_listings
  for each row execute function public.wall_check_bounds();

create or replace function public.wall_listing_vs_supporters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.board <> 'global' then new.region := new.board; end if;       -- local board = that place
  if new.status in ('pending_payment', 'pending_review', 'live') then
    perform pg_advisory_xact_lock(7770001);
    if not public.wall_cells_free(new.board, new.x, new.y, new.w, new.h, new.id, null) then
      raise exception 'Some of those tiles are taken';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wall_listings_vs_supporters on public.wall_listings;
create trigger wall_listings_vs_supporters before insert or update of x, y, w, h, status, board on public.wall_listings
  for each row execute function public.wall_listing_vs_supporters();

-- Supporter tiles: one cell, on a board, inside its size, on a free cell.
create or replace function public.wall_supporter_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.wall_config%rowtype;
begin
  select * into cfg from public.wall_config where board = new.board;
  if not found or new.x >= cfg.cols or new.y >= cfg.rows then raise exception 'That tile is outside the wall'; end if;
  if new.status in ('reserved', 'ready', 'pending_review', 'live') then
    perform pg_advisory_xact_lock(7770001);
    if not public.wall_cells_free(new.board, new.x, new.y, 1, 1, null, new.id) then
      raise exception 'That tile was just taken';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wall_supporters_guard on public.wall_supporters;
create trigger wall_supporters_guard before insert or update of x, y, status, board on public.wall_supporters
  for each row execute function public.wall_supporter_guard();

-- Price for a sponsor rectangle on a board (curve integrated tile by tile; 3 months 10% off, 12 months 25% off).
create or replace function public.wall_quote(p_x int, p_y int, p_w int, p_h int, p_months int, p_board text default 'global') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg public.wall_config%rowtype; total int; sold int; n int; c numeric;
        per_month numeric; disc numeric; is_free boolean;
begin
  if p_months not in (1, 3, 12) then raise exception 'months must be 1, 3 or 12'; end if;
  select * into cfg from public.wall_config where board = p_board;
  if not found then raise exception 'Unknown board'; end if;
  total := cfg.cols * cfg.rows;
  n := greatest(p_w, 1) * greatest(p_h, 1);
  sold := public.wall_sold_tiles(p_board);
  c := cfg.curve;
  per_month := cfg.base_cents * n
    + (cfg.top_cents - cfg.base_cents) * (power(sold + n, c + 1) - power(sold, c + 1)) / ((c + 1) * power(total, c));
  disc := case p_months when 3 then 0.10 when 12 then 0.25 else 0 end;
  is_free := p_x >= 0 and p_y >= 0 and p_w between 1 and 10 and p_h between 1 and 10
    and p_x + p_w <= cfg.cols and p_y + p_h <= cfg.rows
    and public.wall_cells_free(p_board, p_x, p_y, p_w, p_h);
  return jsonb_build_object(
    'board', p_board, 'tiles', n, 'months', p_months, 'free', is_free,
    'per_month_cents', round(per_month),
    'discount_pct', round(disc * 100),
    'total_cents', round(per_month * p_months * (1 - disc))
  );
end $$;
grant execute on function public.wall_quote(int, int, int, int, int, text) to anon, authenticated;

-- Stats for one board (adds the supporter price and Play product the app needs).
create or replace function public.wall_stats(p_board text default 'global') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg public.wall_config%rowtype; sold int; total int; sup int;
begin
  select * into cfg from public.wall_config where board = p_board;
  if not found then return null; end if;
  total := cfg.cols * cfg.rows;
  sold := public.wall_sold_tiles(p_board);
  select count(*)::int into sup from public.wall_supporters where board = p_board and status = 'live' and ends_at > now();
  return jsonb_build_object(
    'board', cfg.board, 'cols', cfg.cols, 'rows', cfg.rows, 'total', total, 'sold', sold, 'supporters', sup,
    'base_cents', cfg.base_cents, 'top_cents', cfg.top_cents,
    'unit_cents_now', round(cfg.base_cents + (cfg.top_cents - cfg.base_cents) * power(sold::numeric / total, cfg.curve)),
    'supporter_cents', cfg.supporter_cents, 'supporter_product', cfg.supporter_product
  );
end $$;
grant execute on function public.wall_stats(text) to anon, authenticated;

-- The list of boards, for the app's board switcher and the advertise page.
create or replace function public.wall_boards() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'board', board, 'cols', cols, 'rows', rows, 'supporter_cents', supporter_cents, 'supporter_product', supporter_product
  ) order by (board <> 'global'), board), '[]'::jsonb) from public.wall_config;
$$;
grant execute on function public.wall_boards() to anon, authenticated;

-- The public board, with the board name last.
create or replace view public.wall_public as
  select id, x, y, w, h, company, headline, url, image_url, color, category, region, 'sponsor'::text as kind, perk, board
    from public.wall_listings
   where status = 'live' and ends_at > now()
  union all
  select id, x, y, 1, 1, 'Supporter', null, '', image_url, '#C7DFF2', 'supporter', null, 'supporter'::text, null::text, board
    from public.wall_supporters
   where status = 'live' and ends_at > now();
grant select on public.wall_public to anon, authenticated;
