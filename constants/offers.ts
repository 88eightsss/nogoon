// ─── Instead offers and bundles ───────────────────────────────────────────────
//
// What the gate offers in place of the thing you were about to open. An offer is one
// small, real thing to do. A bundle is a set of offers that fit together (an urge, a
// mood, a time of day). The user picks bundles in Customize; the gate shows up to four
// offers drawn from them. "Smart mix" is the default and adapts to the time of day.

import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type OfferKind =
  | 'game'     // runs a gate game, then the normal walk-away choice
  | 'route'    // opens a screen in the app
  | 'wait'     // the Waiting Room, then the normal walk-away choice
  | 'timer'    // a short do-it-now timer (app/offer-timer.tsx)
  | 'sms'      // opens the messaging app
  | 'custom';  // the user's own "instead I'll..." line

export type OfferDef = {
  id: string;
  icon: FeatherName;
  label: string;
  sub: string;
  kind: OfferKind;
  game?: string;        // game id, or 'random'
  path?: string;        // route for kind 'route'
  seconds?: number;     // length for kind 'timer'
  note?: string;        // line shown on the timer screen
  counts?: boolean;     // false = the screen it opens records the walk-away itself
};

export const OFFERS: OfferDef[] = [
  // Calm
  { id: 'breathe', icon: 'wind',      label: 'Breathe for a minute',   sub: 'A calm reset, then it is your call', kind: 'game', game: 'breathing' },
  { id: 'ground',  icon: 'anchor',    label: 'Ground yourself',        sub: '5-4-3-2-1: name what is around you', kind: 'game', game: 'grounding' },
  { id: 'wait',    icon: 'clock',     label: 'Sit it out',             sub: 'Watch the urge pass on its own',     kind: 'wait' },
  // Move
  { id: 'pushups', icon: 'activity',  label: 'Do 10 pushups',          sub: 'A minute, no equipment',             kind: 'timer', seconds: 60,  note: 'Ten slow pushups. Knees are fine.' },
  { id: 'stretch', icon: 'maximize-2', label: 'Stretch it out',        sub: 'Shoulders, neck, back',              kind: 'timer', seconds: 60,  note: 'Reach up, roll your shoulders, look far away.' },
  { id: 'walk',    icon: 'map-pin',   label: 'Walk around the block',  sub: 'Five minutes, phone in your pocket', kind: 'timer', seconds: 300, note: 'Go outside if you can. Come back when the timer ends.' },
  { id: 'water',   icon: 'droplet',   label: 'Drink a glass of water', sub: 'Thirst feels like restlessness',     kind: 'timer', seconds: 30,  note: 'Fill a glass. Drink it slowly.' },
  // People
  { id: 'hello',   icon: 'message-circle', label: 'Send someone a hello', sub: 'Open messages and say hi',        kind: 'sms' },
  { id: 'thanks',  icon: 'heart',     label: 'Write what you are glad of', sub: 'One line in your journal',       kind: 'route', path: '/journal' },
  // Fresh mind
  { id: 'news',    icon: 'sunrise',   label: 'Read something good',    sub: "Today's briefing, a small batch",    kind: 'route', path: '/(tabs)/feed' },
  { id: 'curious', icon: 'compass',   label: 'Get curious',            sub: 'What the world looked up yesterday', kind: 'route', path: '/(tabs)/feed' },
  { id: 'game',    icon: 'zap',       label: 'Play something quick',   sub: 'Give your hands something to do',    kind: 'game', game: 'random' },
  // Make
  { id: 'write',   icon: 'edit-3',    label: 'Write one line',         sub: 'What were you hoping to feel?',      kind: 'route', path: '/journal' },
  { id: 'bubbles', icon: 'feather',   label: 'Empty your head',        sub: 'Dump the noise onto a canvas',       kind: 'route', path: '/bubbles' },
  { id: 'kept',    icon: 'bar-chart-2', label: 'See what you have kept', sub: 'Your wins, kindly told',           kind: 'route', path: '/insights' },
];

export type BundleId = 'smart' | 'reset' | 'move' | 'connect' | 'fresh' | 'make' | 'mine';

export type Bundle = {
  id: BundleId;
  name: string;
  tagline: string;
  icon: FeatherName;
  offers: string[];     // offer ids, in order (smart and mine are computed)
};

export const BUNDLES: Bundle[] = [
  { id: 'smart',   name: 'Smart mix',     tagline: 'A mix that changes with the time of day. Calmer at night, curious in the morning.', icon: 'shuffle',  offers: [] },
  { id: 'reset',   name: 'Calm reset',    tagline: 'For stress and anxious scrolling.',            icon: 'wind',           offers: ['breathe', 'ground', 'wait', 'write'] },
  { id: 'move',    name: 'Move',          tagline: 'For restless and bored. Get out of your head and into your body.', icon: 'activity', offers: ['pushups', 'stretch', 'walk', 'water'] },
  { id: 'connect', name: 'Connect',       tagline: 'For lonely scrolling. Reach for a person instead of a feed.', icon: 'users', offers: ['hello', 'thanks', 'news'] },
  { id: 'fresh',   name: 'Fresh mind',    tagline: 'For the "give me something new" itch.',        icon: 'sunrise',        offers: ['news', 'curious', 'game', 'kept'] },
  { id: 'make',    name: 'Make something', tagline: 'Turn the urge into words or a doodle.',       icon: 'edit-3',         offers: ['write', 'bubbles', 'thanks'] },
  { id: 'mine',    name: 'My own list',   tagline: 'Your own "instead I will…" ideas, written by you.', icon: 'star', offers: [] },
];

export const CUSTOM_MAX = 8;
export const CUSTOM_LEN = 60;
export const MAX_OFFERS = 4;

const byId = new Map(OFFERS.map((o) => [o.id, o]));
const rotate = <T,>(a: T[], n: number): T[] => (a.length ? a.map((_, i) => a[(i + n) % a.length]) : a);

function roundRobin(lists: OfferDef[][], max: number): OfferDef[] {
  const out: OfferDef[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const l of lists) {
      const o = l[i];
      if (o && !seen.has(o.id)) { seen.add(o.id); out.push(o); if (out.length >= max) break; }
    }
  }
  return out;
}

const bundleOffers = (id: BundleId, day: number): OfferDef[] =>
  rotate((BUNDLES.find((b) => b.id === id)?.offers ?? []).map((k) => byId.get(k)).filter(Boolean) as OfferDef[], day);

export function customOffers(custom: string[], day: number): OfferDef[] {
  return rotate(
    custom.map((text, i): OfferDef => ({
      id: `mine-${i}`, icon: 'star', label: text, sub: 'Your own plan. Go do it.', kind: 'custom', counts: true,
    })),
    day,
  );
}

/** The offers the gate shows right now. Pure, so it is easy to test. */
export function resolveOffers(opts: {
  bundleIds: BundleId[];
  custom: string[];
  windDown: boolean;
  hour: number;
  day: number;            // whole days since epoch; rotates the order so it stays fresh
  noGames: boolean;
}): OfferDef[] {
  const { bundleIds, custom, windDown, hour, day, noGames } = opts;
  const ok = (o: OfferDef) => !(noGames && o.kind === 'game');

  const smart = (): OfferDef[] => {
    const morning = hour >= 5 && hour < 11;
    const order: BundleId[] = windDown ? ['reset'] : morning ? ['fresh', 'reset', 'move', 'make'] : ['reset', 'fresh', 'move', 'make'];
    return roundRobin(order.map((b) => bundleOffers(b, day).filter(ok)), 12);
  };

  const chosen: BundleId[] = bundleIds.length ? bundleIds : ['smart'];
  const lists = chosen.map((id) => {
    if (id === 'smart') return smart();
    if (id === 'mine') return customOffers(custom, day).slice(0, 2);
    return bundleOffers(id, day).filter(ok);
  });
  let out = roundRobin(lists, MAX_OFFERS);
  if (out.length < MAX_OFFERS) {
    const seen = new Set(out.map((o) => o.id));
    for (const o of smart()) { if (out.length >= MAX_OFFERS) break; if (!seen.has(o.id)) { out.push(o); seen.add(o.id); } }
  }
  return out;
}
