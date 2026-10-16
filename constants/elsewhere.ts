// ─── Beyond the screen ────────────────────────────────────────────────────────
//
// Links out: calmer places to be social online, and ways to find people and things to do
// in person. Nothing here is fetched; every row is a link the user taps. Not endorsements,
// and the screen says so. Keep descriptions to things that are stable and checkable.

import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type SocialPlace = {
  id: string;
  name: string;
  url: string;
  icon: FeatherName;
  what: string;   // what it is
  tip: string;    // how to keep it calm
};

export const SOCIAL_PLACES: SocialPlace[] = [
  { id: 'bluesky', name: 'Bluesky', url: 'https://bsky.app', icon: 'cloud',
    what: 'Short posts. You choose your feeds, and a plain chronological "Following" feed is one tap away.',
    tip: 'Pin Following, mute words that wind you up, skip the discovery feeds.' },
  { id: 'mastodon', name: 'Mastodon', url: 'https://joinmastodon.org', icon: 'globe',
    what: 'Independent communities you pick from. The timeline is in time order, with no ranking algorithm.',
    tip: 'Pick a server built around something you like, not the biggest one.' },
  { id: 'letterboxd', name: 'Letterboxd', url: 'https://letterboxd.com', icon: 'film',
    what: 'A diary of films you have watched, with lists and friends.',
    tip: 'Log what you watch. Follow a few people whose taste you trust.' },
  { id: 'storygraph', name: 'The StoryGraph', url: 'https://thestorygraph.com', icon: 'book',
    what: 'Track books you read and find the next one, with friends if you want them.',
    tip: 'Set a small yearly goal, not a big one.' },
  { id: 'strava', name: 'Strava', url: 'https://www.strava.com', icon: 'activity',
    what: 'Log runs, rides and walks, and cheer on friends.',
    tip: 'Follow people you know. Mute the rest.' },
  { id: 'discord', name: 'Small Discord servers', url: 'https://discord.com', icon: 'message-square',
    what: 'Group chats for people who share a hobby, usually small enough that everyone knows everyone.',
    tip: 'Join a few small ones. Leave the huge public ones.' },
  { id: 'arena', name: 'Are.na', url: 'https://www.are.na', icon: 'layers',
    what: 'Collect images, links and ideas into boards. Slow and quiet on purpose.',
    tip: 'Make one board about something you love.' },
];

export type NearbyKind = 'maps' | 'search' | 'url';
export type Nearby = {
  id: string;
  label: string;
  sub: string;
  icon: FeatherName;
  kind: NearbyKind;
  q?: string;       // query, with the place added when the user has set one
  url?: string;     // fixed address for kind 'url'
};

export const NEARBY: Nearby[] = [
  { id: 'events',   label: 'Free events this week', sub: 'Music, markets, talks',                 icon: 'calendar',   kind: 'search', q: 'free community events this week' },
  { id: 'volunteer', label: 'Volunteer',            sub: 'Give an afternoon to something real',   icon: 'heart',      kind: 'url',    url: 'https://www.volunteermatch.org' },
  { id: 'outdoors', label: 'Hikes and beaches',     sub: 'Get outside with a group or alone',     icon: 'sun',        kind: 'maps',   q: 'parks and trails' },
  { id: 'classes',  label: 'Classes and workshops', sub: 'Pottery, dance, climbing, cooking',     icon: 'award',      kind: 'search', q: 'classes and workshops for beginners' },
  { id: 'clubs',    label: 'Clubs and meetups',     sub: 'Groups that meet in person',            icon: 'users',      kind: 'url',    url: 'https://www.meetup.com/find/' },
  { id: 'library',  label: 'Library',               sub: 'Free books, quiet rooms, events',       icon: 'book-open',  kind: 'maps',   q: 'public library' },
  { id: 'center',   label: 'Community centre',      sub: 'Classes, courts, pools, open gyms',     icon: 'home',       kind: 'maps',   q: 'community center' },
  { id: 'sports',   label: 'Pickup sports',         sub: 'Rec leagues and open courts',           icon: 'target',     kind: 'search', q: 'pickup sports and rec leagues' },
];

export const PLACE_MAX = 40;

/** Builds the address for a nearby row. The place is only used here, when the user taps. */
export function nearbyUrl(n: Nearby, place: string): string {
  if (n.kind === 'url' && n.url) return n.url;
  const where = place.trim();
  const q = encodeURIComponent(where ? `${n.q} in ${where}` : `${n.q} near me`);
  return n.kind === 'maps'
    ? `https://www.google.com/maps/search/${q}`
    : `https://www.google.com/search?q=${q}`;
}
