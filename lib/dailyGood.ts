// ─── Daily good news (client) ────────────────────────────────────────────────
//
// Reads today's curated batch from `feed_items` (written once a day by the feed-daily edge
// function). If the table is empty or unreachable we fall back to the older per-user
// `positive-news` function, and finally the caller shows static copy. Results are cached per
// local day so the app asks at most once a day.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getLocalDateKey } from '@/utils/date';

export type GoodItem = { headline: string; summary: string; source: string; url?: string };

const cacheKey = () => `nogoon_feed_${getLocalDateKey()}`;

async function fromTable(): Promise<GoodItem[]> {
  const { data, error } = await supabase
    .from('feed_items')
    .select('headline, summary, source, url, day, rank')
    .order('day', { ascending: false })
    .order('rank', { ascending: true })
    .limit(20);
  if (error || !data?.length) return [];
  const latest = data[0].day;                      // newest day that has items (today, or yesterday as a fallback)
  return data.filter((r) => r.day === latest).slice(0, 5)
    .map((r) => ({ headline: r.headline, summary: r.summary, source: r.source ?? '', url: r.url }));
}

async function fromFunction(): Promise<GoodItem[]> {
  const { data, error } = await supabase.functions.invoke('positive-news');
  if (error || !data?.headline) return [];
  return [{ headline: data.headline, summary: data.summary ?? '', source: data.source ?? '' }];
}

/** Today's good things (1–5). Empty array means nothing could be loaded. */
export async function getTodaysGood(): Promise<GoodItem[]> {
  try {
    const cached = await AsyncStorage.getItem(cacheKey());
    if (cached) {
      const parsed = JSON.parse(cached);
      const list = (Array.isArray(parsed) ? parsed : [parsed]) as GoodItem[];   // old cache held a single object
      if (list.length) return list;
    }
  } catch { /* ignore bad cache */ }

  let items: GoodItem[] = [];
  try { items = await fromTable(); } catch { /* fall through */ }
  if (!items.length) { try { items = await fromFunction(); } catch { /* fall through */ } }
  if (items.length) AsyncStorage.setItem(cacheKey(), JSON.stringify(items)).catch(() => {});
  return items;
}

/** A single item, for the walk-away reward card. Rotates through today's list. */
export async function getOneGood(): Promise<GoodItem | null> {
  const items = await getTodaysGood();
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}
