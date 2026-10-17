// ─── Community events (client) ────────────────────────────────────────────────
// Reads approved rows from `community_events` (hand-approved; see supabase/functions/events-draft).
// Read-only: the app never writes events and sends nothing about the viewer.

import { supabase } from '@/lib/supabase';

export type EventKind = 'market' | 'volunteer' | 'community' | 'outdoors' | 'class' | 'music' | 'other';

export type CommunityEvent = {
  id: string;
  title: string;
  summary: string;
  kind: EventKind;
  region: string;
  place_name: string;
  when_text: string;
  starts_at: string | null;
  ends_at: string | null;
  recurring: boolean;
  cost: string;
  url: string;
  source: string;
};

export const KIND_LABELS: Record<EventKind, string> = {
  market: 'Markets', volunteer: 'Volunteer', community: 'Community', outdoors: 'Outdoors',
  class: 'Classes', music: 'Music', other: 'Other',
};

const COLS = 'id, title, summary, kind, region, place_name, when_text, starts_at, ends_at, recurring, cost, url, source';

/** Approved, not-yet-over events: dated ones soonest first, then the recurring ones. */
export async function getCommunityEvents(): Promise<CommunityEvent[]> {
  try {
    const { data, error } = await supabase.from('community_events').select(COLS).eq('status', 'approved').limit(300);
    if (error || !data) return [];
    const now = Date.now();
    const SIX_H = 6 * 3600 * 1000;
    const live = (data as CommunityEvent[]).filter((e) => {
      if (!/^https:\/\//i.test(e.url)) return false;
      if (e.recurring) return true;
      if (e.ends_at) return Date.parse(e.ends_at) >= now;
      if (e.starts_at) return Date.parse(e.starts_at) >= now - SIX_H;
      return true;
    });
    const t = (e: CommunityEvent) => (e.starts_at ? Date.parse(e.starts_at) : Number.MAX_SAFE_INTEGER);
    return live.sort((a, b) => Number(a.recurring) - Number(b.recurring) || t(a) - t(b) || a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}
