// ─── Place search (client) ────────────────────────────────────────────────────
// Asks our own place-search function for real places matching what was typed. Only the typed text is
// sent. Returns [] when offline or the service is down; the picker then offers the typed name as-is.

import { supabase } from '@/lib/supabase';
import { regionKeyFor, type Place } from '@/constants/places';

type Hit = { id: string; name: string; admin1: string; country: string; country_code: string };

export async function searchPlaces(q: string): Promise<Place[]> {
  const text = q.trim().slice(0, 60);
  if (text.length < 2) return [];
  try {
    const { data, error } = await supabase.functions.invoke('place-search', { body: { q: text } });
    if (error || !data || !Array.isArray(data.results)) return [];
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const h of data.results as Hit[]) {
      const p: Place = {
        name: h.name, admin: h.admin1 ?? '', country: h.country ?? '',
        regionKey: regionKeyFor(h.name, h.admin1 ?? '', h.country_code ?? ''),
      };
      const k = `${p.name}|${p.admin}|${p.country}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}
