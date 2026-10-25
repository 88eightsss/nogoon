// ─── Outings (helpers) ────────────────────────────────────────────────────────
// Proof that someone was at an event, and the "Add to my calendar" link.
//
// Place check: the phone is asked where it is once, right now, and that is compared with where the event's
// venue is. Nothing is saved or sent from here (the venue name is turned into a point by the phone's own
// geocoder, which on Android is Google's, so the venue name does leave the phone for that lookup).
// expo-location is loaded the guarded way, so a build without the package still works: the check
// reports 'unavailable' and the screen offers the honor-system "I went" instead.

import type { CommunityEvent } from '@/lib/events';

export type PlaceCheck = 'here' | 'far' | 'too-early' | 'unavailable' | 'denied';

let Location: any = null;
try { Location = require('expo-location'); } catch { Location = null; }

const HERE_METERS = 600;       // a market or a park sprawls; this is generous on purpose
const BEFORE_MS = 60 * 60 * 1000;
const AFTER_MS = 60 * 60 * 1000;
const DEFAULT_LEN_MS = 3 * 60 * 60 * 1000;

export const placeCheckAvailable = () => Location != null;

function meters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Is the event on right now, give or take an hour? Recurring things count any day. */
export function eventIsOn(e: Pick<CommunityEvent, 'starts_at' | 'ends_at' | 'recurring'>, now = Date.now()): boolean {
  if (e.recurring || !e.starts_at) return true;
  const start = Date.parse(e.starts_at);
  if (!Number.isFinite(start)) return true;
  const end = e.ends_at && Number.isFinite(Date.parse(e.ends_at)) ? Date.parse(e.ends_at) : start + DEFAULT_LEN_MS;
  return now >= start - BEFORE_MS && now <= end + AFTER_MS;
}

export async function checkAtPlace(e: CommunityEvent): Promise<PlaceCheck> {
  if (!Location) return 'unavailable';
  if (!eventIsOn(e)) return 'too-early';
  if (!e.place_name) return 'unavailable';
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm?.status !== 'granted') return 'denied';
    const query = [e.place_name, e.region === 'Hawaii (statewide)' ? 'Hawaii' : `${e.region}, Hawaii`].join(', ');
    const hits = await Location.geocodeAsync(query);
    if (!hits || hits.length === 0) return 'unavailable';
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced ?? 3 });
    const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    const nearest = Math.min(...hits.slice(0, 3).map((h: any) => meters(here, { latitude: h.latitude, longitude: h.longitude })));
    return nearest <= HERE_METERS ? 'here' : 'far';
  } catch {
    return 'unavailable';
  }
}

const gcal = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A Google Calendar "new event" link. Opens in the Calendar app or the browser; nothing is stored by us. */
export function calendarUrl(e: CommunityEvent): string | null {
  if (!e.starts_at || e.recurring) return null;
  const start = Date.parse(e.starts_at);
  if (!Number.isFinite(start)) return null;
  const end = e.ends_at && Number.isFinite(Date.parse(e.ends_at)) ? Date.parse(e.ends_at) : start + 2 * 60 * 60 * 1000;
  const q = [
    ['action', 'TEMPLATE'],
    ['text', e.title],
    ['dates', `${gcal(start)}/${gcal(end)}`],
    ['details', `${e.summary ? e.summary + '\n\n' : ''}Details: ${e.url}`],
    ['location', [e.place_name, e.region].filter(Boolean).join(', ')],
  ].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Plain-text invite, for the share sheet ("want to come?"). */
export function inviteText(e: CommunityEvent): string {
  return `Want to come to ${e.title}? ${[e.when_text, e.place_name].filter(Boolean).join(', ')}. ${e.url}`;
}
