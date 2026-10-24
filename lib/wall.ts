// The Wall: finite board of sponsor tiles. Reads the public view and stats from Supabase
// (supabase/migrations/20261016_ad_wall.sql). Nothing about the viewer is sent.

import { supabase } from './supabase';

export type WallTile = {
  id: string; x: number; y: number; w: number; h: number;
  company: string; headline: string | null; url: string; image_url: string | null;
  color: string; category: string; region: string | null;
  /** 'supporter' tiles are a small picture with no name and no link. Missing on older data = sponsor. */
  kind?: 'sponsor' | 'supporter';
  /** Optional short offer the sponsor attaches ("10% off a coffee"); shown after a finished walk. */
  perk?: string | null;
  /** Which wall: 'global' or a place like 'Maui'. Missing on older data = global. */
  board?: string;
};
export type WallStats = {
  cols: number; rows: number; total: number; sold: number; supporters?: number;
  base_cents: number; top_cents: number; unit_cents_now: number;
  board?: string; supporter_cents?: number; supporter_product?: string;
};
export type BoardInfo = { board: string; cols: number; rows: number; supporter_cents: number; supporter_product: string };

const DEFAULT_STATS: WallStats = { cols: 100, rows: 100, total: 10000, sold: 0, base_cents: 150, top_cents: 1000, unit_cents_now: 150 };

let cache: { at: number; tiles: WallTile[]; stats: WallStats } | null = null;
const TTL = 10 * 60 * 1000;

export async function getWall(force = false): Promise<{ tiles: WallTile[]; stats: WallStats }> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache;
  try {
    const BASE = 'id,x,y,w,h,company,headline,url,image_url,color,category,region';
    // Newest shape first; older databases (before the supporter / perk migrations) get the older shapes.
    let rows: WallTile[] | null = null;
    for (const cols of [`${BASE},kind,perk,board`, `${BASE},kind,perk`, `${BASE},kind`, BASE]) {
      const r = await supabase.from('wall_public').select(cols);
      if (!r.error) { rows = r.data as unknown as WallTile[] | null; break; }
    }
    let s = await supabase.rpc('wall_stats', { p_board: 'global' });
    if (s.error) s = await supabase.rpc('wall_stats');   // database from before the boards migration
    const tiles = rows ?? [];
    const stats = (s.data as WallStats | null) ?? DEFAULT_STATS;
    cache = { at: Date.now(), tiles, stats };
    return cache;
  } catch {
    return cache ?? { at: 0, tiles: [], stats: DEFAULT_STATS };
  }
}

const GLOBAL_INFO: BoardInfo = { board: 'global', cols: 100, rows: 100, supporter_cents: 250, supporter_product: 'nogoon_wall_tile' };

/** The walls that exist: global first, then one per open place. Falls back to just the global wall. */
export async function getBoards(): Promise<BoardInfo[]> {
  try {
    const { data, error } = await supabase.rpc('wall_boards');
    if (!error && Array.isArray(data) && data.length) return data as BoardInfo[];
  } catch { /* fall through */ }
  return [GLOBAL_INFO];
}

/** Size, prices and counts for one wall. */
export async function getBoardStats(board: string): Promise<WallStats> {
  try {
    const { data, error } = await supabase.rpc('wall_stats', { p_board: board });
    if (!error && data) return data as WallStats;
  } catch { /* fall through */ }
  return board === 'global' ? DEFAULT_STATS : { ...DEFAULT_STATS, board, cols: 25, rows: 25, total: 625 };
}

/** The wall that fits a picked place: the local board with that name if there is one, else the global wall. */
export function boardForPlace(boards: BoardInfo[], regionKey: string | null | undefined): string {
  const hit = regionKey ? boards.find((b) => b.board.toLowerCase() === regionKey.toLowerCase()) : null;
  return hit ? hit.board : 'global';
}

export async function reportTile(listingId: string, reason: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('wall', { body: { action: 'report', listing_id: listingId, reason } });
    return !error;
  } catch {
    return false;
  }
}

/** Counts one open of a tile's link. Sends only the tile id: no user, no device. */
export async function tapTile(listingId: string): Promise<void> {
  try { await supabase.rpc('wall_tap', { p_id: listingId }); } catch { /* counting is best effort */ }
}

/**
 * Up to `max` sponsors to show away from the Wall. With a place set, tiles from that place come
 * first, then tiles that are not tied to a place; tiles from somewhere else are left out. With no
 * place, everything is eligible. Order rotates by day so the same few do not always lead.
 */
export function pickSponsors(tiles: WallTile[], place: string, day: number, max = 3): WallTile[] {
  const want = place.trim().toLowerCase();
  const near = (t: WallTile) => !!want && !!t.region && (t.region.toLowerCase().includes(want) || want.includes(t.region.toLowerCase()));
  const anywhere = (t: WallTile) => !t.region || /^online$|^everywhere$/i.test(t.region);
  const sponsors = tiles.filter((t) => t.kind !== 'supporter');   // supporter tiles are never shown as sponsors
  const pool = want ? sponsors.filter((t) => near(t) || anywhere(t)) : sponsors.slice();
  pool.sort((a, b) => Number(near(b)) - Number(near(a)) || a.id.localeCompare(b.id));
  const head = pool.filter(near), rest = pool.filter((t) => !near(t));
  const rot = <T,>(a: T[]) => (a.length ? a.map((_, i) => a[(i + day) % a.length]) : a);
  return [...rot(head), ...rot(rest)].slice(0, max);
}

/** The one perk to show after a finished walk: a nearby sponsor first, then one with no place or "Online". Rotates by day. */
export function pickPerk(tiles: WallTile[], place: string, day: number): WallTile | null {
  const withPerk = tiles.filter((t) => typeof t.perk === 'string' && t.perk.trim().length >= 4 && /^https:\/\//i.test(t.url));
  return pickSponsors(withPerk, place, day, 1)[0] ?? null;
}

export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#12233D' : '#FFFFFF';
}
