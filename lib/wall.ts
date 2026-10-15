// The Wall: finite board of sponsor tiles. Reads the public view and stats from Supabase
// (supabase/migrations/20261016_ad_wall.sql). Nothing about the viewer is sent.

import { supabase } from './supabase';

export type WallTile = {
  id: string; x: number; y: number; w: number; h: number;
  company: string; headline: string | null; url: string; image_url: string | null;
  color: string; category: string;
};
export type WallStats = {
  cols: number; rows: number; total: number; sold: number;
  base_cents: number; top_cents: number; unit_cents_now: number;
};

const DEFAULT_STATS: WallStats = { cols: 60, rows: 50, total: 3000, sold: 0, base_cents: 50, top_cents: 500, unit_cents_now: 50 };

let cache: { at: number; tiles: WallTile[]; stats: WallStats } | null = null;
const TTL = 10 * 60 * 1000;

export async function getWall(force = false): Promise<{ tiles: WallTile[]; stats: WallStats }> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache;
  try {
    const [t, s] = await Promise.all([
      supabase.from('wall_public').select('id,x,y,w,h,company,headline,url,image_url,color,category'),
      supabase.rpc('wall_stats'),
    ]);
    const tiles = (t.data as WallTile[] | null) ?? [];
    const stats = (s.data as WallStats | null) ?? DEFAULT_STATS;
    cache = { at: Date.now(), tiles, stats };
    return cache;
  } catch {
    return cache ?? { at: 0, tiles: [], stats: DEFAULT_STATS };
  }
}

export async function reportTile(listingId: string, reason: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('wall', { body: { action: 'report', listing_id: listingId, reason } });
    return !error;
  } catch {
    return false;
  }
}

export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#12233D' : '#FFFFFF';
}
