// ─── Local news (client) ──────────────────────────────────────────────────────
// Headlines only, read from `local_news` (filled daily by the local-news function from public RSS feeds).
// Each one links to the publisher; the app shows the headline, the outlet and the date, nothing else.
// Also: "request this place", which adds one to an anonymous counter so we know where to build next.

import { supabase } from '@/lib/supabase';

export type Headline = { id: string; region: string; title: string; url: string; source: string; published_at: string | null };

export async function getLocalNews(regions: string[], limit = 5): Promise<Headline[]> {
  if (regions.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('local_news')
      .select('id, region, title, url, source, published_at')
      .in('region', regions)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit * 3);
    if (error || !data) return [];
    const week = Date.now() - 10 * 86400000;
    const fresh = (data as Headline[]).filter((h) => /^https:\/\//i.test(h.url) && (!h.published_at || Date.parse(h.published_at) >= week));
    // One outlet should not fill the list: take them round-robin by outlet.
    const bySource = new Map<string, Headline[]>();
    for (const h of fresh) bySource.set(h.source, [...(bySource.get(h.source) ?? []), h]);
    const out: Headline[] = [];
    while (out.length < limit && [...bySource.values()].some((l) => l.length)) {
      for (const l of bySource.values()) { const h = l.shift(); if (h && out.length < limit) out.push(h); }
    }
    return out;
  } catch {
    return [];
  }
}

/** Tells us a place with no list yet is wanted. Sends only the place name. */
export async function requestPlace(name: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('request_place', { p_place: name.slice(0, 100) });
    return !error;
  } catch {
    return false;
  }
}
