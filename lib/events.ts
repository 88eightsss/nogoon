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
  /** The organiser's own sign-up form, when they gave one. Opening it does NOT sign anyone up. */
  signup_url?: string | null;
  host_org?: string;
};

export const KIND_LABELS: Record<EventKind, string> = {
  market: 'Markets', volunteer: 'Volunteer', community: 'Community', outdoors: 'Outdoors',
  class: 'Classes', music: 'Music', other: 'Other',
};

const BASE_COLS = 'id, title, summary, kind, region, place_name, when_text, starts_at, ends_at, recurring, cost, url, source';
const COLS = `${BASE_COLS}, signup_url, host_org`;

/** Approved, not-yet-over events: dated ones soonest first, then the recurring ones. */
export async function getCommunityEvents(): Promise<CommunityEvent[]> {
  try {
    // Newer shape first; an older database without the sign-up columns still works with the base shape.
    let res: { data: unknown[] | null; error: unknown } = await supabase.from('community_events').select(COLS).eq('status', 'approved').limit(300);
    if (res.error) res = await supabase.from('community_events').select(BASE_COLS).eq('status', 'approved').limit(300);
    const { data, error } = res;
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

/** The site name a link goes to, for showing next to the button ("forms.gle"). Empty when it is not a valid link. */
export function linkHost(url: string | null | undefined): string {
  if (!url) return '';
  const m = /^https:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1].replace(/^www\./i, '').toLowerCase() : '';
}

/** A link we will open: https only. */
export const safeLink = (url: string | null | undefined): url is string => !!url && /^https:\/\//i.test(url) && linkHost(url) !== '';

export type ReportReason = 'wrong' | 'unsafe' | 'spam' | 'other';

/** Flags a listing for review. Three in a week send it back for checking. Sends only the listing id and a reason. */
export async function reportEvent(id: string, reason: ReportReason): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('report_event', { p_event: id, p_reason: reason });
    return !error;
  } catch {
    return false;
  }
}
