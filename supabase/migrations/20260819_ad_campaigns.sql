-- ─── Ad Campaigns — NoGoon Sponsored Placements ─────────────────────────────
--
-- Two placements:
--   odd_one_out      — Honest-ad round inside OddOneOut game
--   spot_sponsored   — Real sponsor post inside SpotTheSponsored feed
--
-- Run this in Supabase SQL Editor or via supabase db push.

-- ─── Campaigns table ──────────────────────────────────────────────────────────

create table if not exists public.ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Brand info
  brand_name    text not null,                          -- e.g. "Notion"
  brand_handle  text,                                   -- e.g. "@NotionHQ"
  brand_color   text not null default '#4f46e5',        -- hex, used as accent
  brand_avatar_emoji text default '✦',                  -- fallback avatar

  -- Placement
  placement     text not null check (placement in ('odd_one_out', 'spot_sponsored')),

  -- Ad creative — used differently per placement
  headline      text not null,   -- main line, e.g. "The all-in-one workspace"
  subtext       text not null,   -- supporting line
  cta_label     text not null default 'Learn more',
  cta_url       text not null,   -- deep link or https URL

  -- For spot_sponsored: social feed post copy
  post_content  text,            -- the feed post body text
  post_image_emoji text,         -- emoji shown as post image placeholder

  -- Campaign window
  active_from   timestamptz not null default now(),
  active_until  timestamptz,     -- null = runs indefinitely

  -- Status
  status        text not null default 'draft'
                  check (status in ('draft', 'active', 'paused', 'ended')),

  -- Budget / pacing (informational — not enforced in app)
  budget_usd    numeric(10,2),
  cpm_usd       numeric(6,2)
);

-- Only one active campaign per placement at a time (soft enforced — query handles it)
create index if not exists idx_ad_campaigns_placement_status
  on public.ad_campaigns (placement, status, active_from, active_until);

-- ─── Events table ─────────────────────────────────────────────────────────────

create table if not exists public.ad_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  campaign_id   uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,  -- null = anonymous
  session_id    text,       -- gate session ID for dedup
  placement     text not null,

  -- Event type
  event_type    text not null check (event_type in (
    'impression',    -- game started, ad content loaded
    'completion',    -- game completed (user saw the full ad round)
    'correct_tap',   -- user tapped the sponsor's card correctly (odd_one_out)
    'wrong_tap',     -- user tapped wrong card (still saw the ad)
    'cta_click'      -- user tapped the CTA button
  )),

  -- Metadata
  metadata      jsonb default '{}'::jsonb
);

create index if not exists idx_ad_events_campaign_type
  on public.ad_events (campaign_id, event_type, created_at);

create index if not exists idx_ad_events_session
  on public.ad_events (session_id, campaign_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.ad_campaigns enable row level security;
alter table public.ad_events    enable row level security;

-- Anyone (anon or authed) can read active campaigns
drop policy if exists "read_active_campaigns" on public.ad_campaigns;
create policy "read_active_campaigns" on public.ad_campaigns
  for select using (status = 'active');

-- Anyone can insert events (anon = no user_id)
drop policy if exists "insert_events" on public.ad_events;
create policy "insert_events" on public.ad_events
  for insert with check (true);

-- ─── Seed: example campaign (draft — won't show until set to active) ──────────

insert into public.ad_campaigns (
  brand_name, brand_handle, brand_color, brand_avatar_emoji,
  placement,
  headline, subtext,
  cta_label, cta_url,
  post_content, post_image_emoji,
  status, cpm_usd
) values (
  'Notion', '@NotionHQ', '#000000', '📝',
  'odd_one_out',
  'One workspace for everything', 'Notes, tasks, docs — no subscription tricks.',
  'Try free', 'https://notion.so',
  null, null,
  'draft', 45.00
), (
  'Notion', '@NotionHQ', '#000000', '📝',
  'spot_sponsored',
  'One workspace for everything', 'Notes, tasks, docs — no subscription tricks.',
  'Try free', 'https://notion.so',
  'We built Notion to replace a dozen apps. No dark patterns, no hidden fees. Just one honest tool. 📝',
  '📝',
  'draft', 45.00
);
