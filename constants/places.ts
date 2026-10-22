// ─── Places ───────────────────────────────────────────────────────────────────
// The place a person picks in Local. It only ever lives on their phone, and is used for two things:
// choosing which curated events list to show, and building the "find more near you" search links.
//
// A place maps to a curated events region (the `region` column of community_events / event_sources)
// only when we have a hand-checked list for it. Everywhere else the screen says so plainly and falls back
// to search links, instead of pretending a list exists.

export type Place = {
  name: string;          // 'Lahaina'
  admin: string;         // state/province, may be ''
  country: string;       // 'United States'
  regionKey: string | null;   // a CURATED_REGIONS key, or null when we have no list for it
};

export const NO_PLACE: Place = { name: '', admin: '', country: '', regionKey: null };

/** Regions that have curated or auto-gathered events. Keys match event_sources.region exactly. */
export const CURATED_REGIONS = ['Maui', 'Oahu'] as const;
/** Region shown to everyone in Hawaii, on top of their island. */
export const STATEWIDE_REGION = 'Hawaii (statewide)';

const MAUI_TOWNS = [
  'lahaina', 'kahului', 'wailuku', 'kihei', 'paia', 'makawao', 'hana', 'kapalua', 'kula', 'haiku', 'wailea',
  'kaanapali', 'napili', 'kahakuloa', 'pukalani', 'maalaea', 'olowalu', 'launiupoko', 'maui',
];
const OAHU_TOWNS = [
  'honolulu', 'waikiki', 'kailua', 'kaneohe', 'pearl city', 'ewa beach', 'ewa', 'kapolei', 'waipahu', 'haleiwa',
  'aiea', 'mililani', 'wahiawa', 'waimanalo', 'laie', 'kahuku', 'waianae', 'nanakuli', 'hawaii kai', 'manoa',
  'oahu', 'urban honolulu',
];
const HAWAII_OTHER = ['hilo', 'kailua-kona', 'kona', 'waimea', 'lihue', 'kapaa', 'princeville', 'hanalei', 'poipu',
  'kauai', 'big island', 'molokai', 'lanai', 'kaunakakai', 'kalaupapa'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯʻ'‘’`]/g, '').trim();

/** Which curated region (if any) a searched place belongs to. Only the US state of Hawaii qualifies. */
export function regionKeyFor(name: string, admin: string, countryCode: string): string | null {
  if (countryCode.toUpperCase() !== 'US') return null;
  if (norm(admin) !== 'hawaii') return null;
  const n = norm(name);
  if (MAUI_TOWNS.includes(n)) return 'Maui';
  if (OAHU_TOWNS.includes(n)) return 'Oahu';
  return null;
}

/** True for a Hawaii place on an island we have no list for yet (still gets the statewide list). */
export function inHawaii(name: string, admin: string, countryCode: string): boolean {
  if (countryCode.toUpperCase() !== 'US') return false;
  return norm(admin) === 'hawaii' || HAWAII_OTHER.includes(norm(name));
}

export function placeLabel(p: Place): string {
  return [p.name, p.admin].filter(Boolean).join(', ');
}

/** Regions whose events to show for a place: its island, plus statewide for anywhere in Hawaii. */
export function regionsToShow(p: Place): string[] {
  if (p.regionKey) return [p.regionKey, STATEWIDE_REGION];
  if (p.country === 'United States' && norm(p.admin) === 'hawaii') return [STATEWIDE_REGION];
  return [];
}

/** Quick picks shown before anyone searches. Real places only. */
export const QUICK_PLACES: Place[] = [
  { name: 'Lahaina',   admin: 'Hawaii', country: 'United States', regionKey: 'Maui' },
  { name: 'Kahului',   admin: 'Hawaii', country: 'United States', regionKey: 'Maui' },
  { name: 'Kihei',     admin: 'Hawaii', country: 'United States', regionKey: 'Maui' },
  { name: 'Honolulu',  admin: 'Hawaii', country: 'United States', regionKey: 'Oahu' },
  { name: 'Kailua',    admin: 'Hawaii', country: 'United States', regionKey: 'Oahu' },
  { name: 'Kapolei',   admin: 'Hawaii', country: 'United States', regionKey: 'Oahu' },
];
