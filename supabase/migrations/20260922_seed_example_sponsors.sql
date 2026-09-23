-- ─── Example sponsor campaigns — placeholder content ──────────────────────────
--
-- Generic, fictional stand-ins (NOT real partnerships) so the OddOneOut
-- "honest ad" round and the SpotTheSponsored feed have something live to
-- show and rotate through while real sponsors are being lined up.
--
-- fetchAdForPlacement() now picks randomly among every ACTIVE campaign for a
-- placement, so having more than one active row here is what makes the
-- sponsored round feel different each time you replay instead of showing
-- the same brand every session.
--
-- Before any real launch: replace brand_name / headline / subtext /
-- cta_label / cta_url / post_content with a real partner's actual info and
-- their real URL (cta_url below is a https://example.com placeholder and
-- goes nowhere useful), or flip status to 'paused' for anything not ready.

insert into public.ad_campaigns (
  brand_name, brand_handle, brand_color, brand_avatar_emoji,
  placement,
  headline, subtext,
  cta_label, cta_url,
  post_content, post_image_emoji,
  status, budget_usd, cpm_usd
) values
-- Sunrise Counseling — wellness/therapy-style example
(
  'Sunrise Counseling', '@sunrisecounseling', '#0891b2', '💬',
  'odd_one_out',
  'Feeling overwhelmed?', 'Talk to someone today — no waitlist, no judgment.',
  'Learn more', 'https://example.com/sunrise-counseling',
  null, null,
  'active', null, null
),
(
  'Sunrise Counseling', '@sunrisecounseling', '#0891b2', '💬',
  'spot_sponsored',
  'Feeling overwhelmed?', 'Talk to someone today — no waitlist, no judgment.',
  'Learn more', 'https://example.com/sunrise-counseling',
  'We match you with a licensed counselor this week, not next month. No dark patterns — just support when you need it. 💬',
  '💬',
  'active', null, null
),
-- Calm Harbor Coaching — mindfulness/coaching-style example
(
  'Calm Harbor Coaching', '@calmharbor', '#7c3aed', '🧘',
  'odd_one_out',
  'Build a calmer routine', 'One-on-one coaching, cancel anytime — genuinely.',
  'Try a session', 'https://example.com/calm-harbor',
  null, null,
  'active', null, null
),
(
  'Calm Harbor Coaching', '@calmharbor', '#7c3aed', '🧘',
  'spot_sponsored',
  'Build a calmer routine', 'One-on-one coaching, cancel anytime — genuinely.',
  'Try a session', 'https://example.com/calm-harbor',
  'No 12-month lock-in, no upsell calls. Just a coach who checks in weekly. 🧘',
  '🧘',
  'active', null, null
),
-- Downtown Farmers Market — local community example
(
  'Downtown Farmers Market', '@downtownmarket', '#16a34a', '🌽',
  'odd_one_out',
  'This Saturday, 7am–1pm', 'Local produce, no membership required.',
  'See the map', 'https://example.com/farmers-market',
  null, null,
  'active', null, null
),
(
  'Downtown Farmers Market', '@downtownmarket', '#16a34a', '🌽',
  'spot_sponsored',
  'This Saturday, 7am–1pm', 'Local produce, no membership required.',
  'See the map', 'https://example.com/farmers-market',
  'Fresh produce, local vendors, every Saturday morning downtown. Come say hi. 🌽',
  '🌽',
  'active', null, null
),
-- Island Roots Co-op — local community example
(
  'Island Roots Co-op', '@islandroots', '#ea580c', '🥥',
  'odd_one_out',
  'Join the co-op', 'Member-owned, real prices, no surprise fees.',
  'Learn more', 'https://example.com/island-roots',
  null, null,
  'active', null, null
),
(
  'Island Roots Co-op', '@islandroots', '#ea580c', '🥥',
  'spot_sponsored',
  'Join the co-op', 'Member-owned, real prices, no surprise fees.',
  'Learn more', 'https://example.com/island-roots',
  'We''re member-owned, so the prices are the prices. No loyalty-card games. 🥥',
  '🥥',
  'active', null, null
);
