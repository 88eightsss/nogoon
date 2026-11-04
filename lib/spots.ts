// ─── Places near you: helpers ─────────────────────────────────────────────────
// Pure functions, nothing leaves the phone. Directions are a Maps search by name, so we never invent
// coordinates or an address.

import { SPOTS, groupOf, type Spot, type SpotGroup } from '@/constants/spots';

export const PAGE = 12;

/** Spots for a picked region (the regionKey of the place chosen in Local) and an optional category. */
export function spotsFor(regionKey: string | null, group: SpotGroup | 'all'): Spot[] {
  if (regionKey !== 'Maui' && regionKey !== 'Oahu') return [];
  return SPOTS
    .filter((p) => p.region === regionKey && (group === 'all' || groupOf(p.kind) === group))
    .sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
}

export function pickOne(list: Spot[], not?: string | null, rnd: () => number = Math.random): Spot | null {
  const pool = list.length > 1 && not ? list.filter((p) => p.id !== not) : list;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

export function mapsUrl(p: Spot): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.area}, Hawaii`)}`;
}
