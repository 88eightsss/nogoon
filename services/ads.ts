// ─── Ad Service — NoGoon Sponsored Placements ────────────────────────────────
//
// Fetches the active campaign for a given placement and records events.
// Designed to be silent — if no campaign is live, returns null and the game
// runs exactly as normal.
//
// Usage:
//   const ad = await fetchAdForPlacement('odd_one_out');
//   if (ad) trackAdEvent('impression', ad.id);

import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdPlacement = 'odd_one_out' | 'spot_sponsored';

export type AdEventType =
  | 'impression'
  | 'completion'
  | 'correct_tap'
  | 'wrong_tap'
  | 'cta_click';

export interface AdCampaign {
  id: string;
  brand_name: string;
  brand_handle: string | null;
  brand_color: string;
  brand_avatar_emoji: string | null;
  placement: AdPlacement;
  headline: string;
  subtext: string;
  cta_label: string;
  cta_url: string;
  post_content: string | null;
  post_image_emoji: string | null;
}

// ─── Fetch active campaign ────────────────────────────────────────────────────
// Returns the most recently-started active campaign for the placement, or null.

export async function fetchAdForPlacement(
  placement: AdPlacement
): Promise<AdCampaign | null> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('ad_campaigns')
      .select(
        'id, brand_name, brand_handle, brand_color, brand_avatar_emoji, ' +
        'placement, headline, subtext, cta_label, cta_url, ' +
        'post_content, post_image_emoji'
      )
      .eq('placement', placement)
      .eq('status', 'active')
      .lte('active_from', now)
      .or(`active_until.is.null,active_until.gte.${now}`)
      .order('active_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[ads] fetch failed:', error.message);
      return null;
    }

    return data as AdCampaign | null;
  } catch (err) {
    console.warn('[ads] fetch threw:', err);
    return null;
  }
}

// ─── Track event ─────────────────────────────────────────────────────────────
// Fire-and-forget. Never throws — ad failures must not interrupt gameplay.

export async function trackAdEvent(
  eventType: AdEventType,
  campaignId: string,
  placement: AdPlacement,
  opts: {
    userId?: string | null;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    await supabase.from('ad_events').insert({
      campaign_id: campaignId,
      placement,
      event_type: eventType,
      user_id: opts.userId ?? null,
      session_id: opts.sessionId ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (err) {
    console.warn('[ads] track failed:', err);
  }
}
