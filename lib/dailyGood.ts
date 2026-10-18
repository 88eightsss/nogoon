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
export type Briefing = { good: GoodItem[]; curious: GoodItem[]; world: GoodItem[]; day?: string };

const cacheKey = () => `nogoon_brief_${getLocalDateKey()}`;
const EMPTY: Briefing = { good: [], curious: [], world: [] };

type Row = { headline: string; summary: string; source: string | null; url: string; day: string; rank: number; section?: string };
const toItem = (r: Row): GoodItem => ({ headline: r.headline, summary: r.summary, source: r.source ?? '', url: r.url });

async function fromTable(): Promise<Briefing> {
  // `section` exists after the 20261015 migration; fall back to the old shape if it does not.
  let res = await supabase.from('feed_items').select('headline, summary, source, url, day, rank, section')
    .order('day', { ascending: false }).order('rank', { ascending: true }).limit(90);
  if (res.error) {
    res = await supabase.from('feed_items').select('headline, summary, source, url, day, rank')
      .order('day', { ascending: false }).order('rank', { ascending: true }).limit(20) as typeof res;
  }
  const data = res.data as Row[] | null;
  if (res.error || !data?.length) return EMPTY;
  // Newest day that has good news (today, or yesterday as a fallback); other sections use their own newest day.
  const newest = (section: string) => {
    const rows = data.filter((r) => (r.section ?? 'good') === section);
    if (!rows.length) return [] as GoodItem[];
    return rows.filter((r) => r.day === rows[0].day).slice(0, section === 'good' ? 10 : section === 'curious' ? 6 : 5).map(toItem);
  };
  return { good: newest('good'), curious: newest('curious'), world: newest('world'), day: data[0].day };
}

async function fromFunction(): Promise<GoodItem[]> {
  const { data, error } = await supabase.functions.invoke('positive-news');
  if (error || !data?.headline) return [];
  return [{ headline: data.headline, summary: data.summary ?? '', source: data.source ?? '' }];
}

/** Today's briefing (all sections, cached per local day). Sections can be empty. */
export async function getTodaysBriefing(): Promise<Briefing> {
  try {
    const cached = await AsyncStorage.getItem(cacheKey());
    if (cached) {
      const b = JSON.parse(cached) as Briefing & { at?: number };
      // A batch from an earlier day (cached before today's job ran) is only trusted for 2 hours.
      const fresh = b?.day === getLocalDateKey() || (typeof b?.at === 'number' && Date.now() - b.at < 2 * 3600 * 1000);
      if (fresh && (b?.good?.length || b?.curious?.length || b?.world?.length)) return { ...EMPTY, ...b };
    }
  } catch { /* ignore bad cache */ }

  let b: Briefing = EMPTY;
  try { b = await fromTable(); } catch { /* fall through */ }
  if (!b.good.length) { try { b = { ...b, good: await fromFunction() }; } catch { /* fall through */ } }
  if (b.good.length || b.curious.length || b.world.length) AsyncStorage.setItem(cacheKey(), JSON.stringify({ ...b, at: Date.now() })).catch(() => {});
  return b;
}

/** Today's good things (1–5). Empty array means nothing could be loaded. */
export async function getTodaysGood(): Promise<GoodItem[]> {
  return (await getTodaysBriefing()).good;
}

/** A single item, for the walk-away reward card. Rotates through today's list. */
export async function getOneGood(): Promise<GoodItem | null> {
  const items = await getTodaysGood();
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}


/**
 * Older stories for the "endless" setting: everything stored from before today's batch, newest day
 * first, in pages. Returns [] when there is nothing more (or the table cannot be read).
 */
export async function getOlderStories(beforeDay: string, offset: number, includeWorld: boolean, pageSize = 15): Promise<GoodItem[]> {
  try {
    let q = supabase.from('feed_items').select('headline, summary, source, url, day, rank, section')
      .lt('day', beforeDay)
      .order('day', { ascending: false }).order('rank', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!includeWorld) q = q.in('section', ['good', 'curious']);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Row[]).map(toItem);
  } catch {
    return [];
  }
}
