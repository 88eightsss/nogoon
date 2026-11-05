// ─── Step Out feed: sample items ─────────────────────────────────────────────────────────────
//
// Phase 2 of the social-in-our-light plan (claude/nogoon-social-in-our-light). These are EXAMPLES so the
// feed can be tried on a phone before any host exists. They are fictional, they are labelled "Sample" on
// screen, and nothing about a reply is sent anywhere. When hosts are live this file is replaced by rows
// from the database (see supabase/migrations/20261105_stepout_social.sql).
//
// Rules the feed keeps (see the plan): finite, no counts anywhere, no likes or comments, ordering by date
// and distance, declining is invisible, Neighbors say is labelled "not checked by us".

export type StepSection = 'hand' | 'happening' | 'neighbor';
export type Verified = 'nonprofit' | 'business' | null;

export interface StepItem {
  id: string;
  section: StepSection;
  title: string;
  host: string;
  verified: Verified;
  /** "Checked Nov 1" etc. Only for verified hosts. */
  checked?: string;
  when: string;
  /** Coarse area only. Never an address until a host confirms. */
  area: string;
  cost: string;
  /** The ask in words, never a count of people who are going. */
  ask?: string;
  /** The smallest way in. */
  smallest: string;
  details: string;
}

export const STEP_SAMPLE: StepItem[] = [
  {
    id: 's-kitchen', section: 'hand', title: 'Serve lunch at the community kitchen', host: 'Harbor Street Kitchen',
    verified: 'nonprofit', checked: 'Checked Nov 1', when: 'Sat 9:00 am to 12:00 pm', area: 'Kahului', cost: 'Free',
    ask: '6 hands needed', smallest: 'Come for the first hour',
    details: 'Plating and serving. Closed shoes, hair tied back. No experience needed. The host will meet you at the side door and walk you through it.',
  },
  {
    id: 's-beach', section: 'hand', title: 'Beach cleanup before the surf contest', host: 'Reef Friends',
    verified: 'nonprofit', checked: 'Checked Oct 28', when: 'Sun 7:30 am', area: 'Kihei', cost: 'Free',
    ask: '10 hands needed', smallest: 'Bring a friend and pick up for 30 minutes',
    details: 'Gloves and bags provided. Bring water and a hat. We finish by 9:30 with fruit.',
  },
  {
    id: 's-market', section: 'happening', title: 'Farmers market and live ukulele', host: 'Upcountry Growers',
    verified: 'nonprofit', checked: 'Checked Nov 2', when: 'Sat 7:00 am to 11:00 am', area: 'Makawao', cost: 'Free to enter',
    smallest: 'Walk through for ten minutes',
    details: 'Local produce, flowers and baked goods. Parking at the church lot. Music starts at 8.',
  },
  {
    id: 's-class', section: 'happening', title: 'Beginner tide pool walk', host: 'Seaside Nature Center',
    verified: 'nonprofit', checked: 'Checked Oct 30', when: 'Sun 10:00 am', area: 'Wailea', cost: '$10 suggested',
    smallest: 'Join for the first half hour',
    details: 'A ranger leads a slow walk at low tide. Reef-safe sunscreen only. Shoes you can get wet.',
  },
  {
    id: 's-business', section: 'happening', title: 'Climbing gym open house', host: 'Summit Boulders',
    verified: 'business', checked: 'Checked Nov 3', when: 'Sat 4:00 pm', area: 'Kahului', cost: 'Free day pass',
    smallest: 'Try one wall',
    details: 'Business event. Show your Step Out code at the desk for the free pass.',
  },
  {
    id: 's-neighbor-1', section: 'neighbor', title: 'Pickup volleyball at the park', host: 'A neighbor',
    verified: null, when: 'Sat 5:30 pm', area: 'Kihei', cost: 'Free',
    smallest: 'Come watch a game',
    details: 'Casual. All levels. Bring water. Posted by a neighbor and not checked by us.',
  },
  {
    id: 's-neighbor-2', section: 'neighbor', title: 'Free plants to give away', host: 'A neighbor',
    verified: null, when: 'Sun morning', area: 'Pukalani', cost: 'Free',
    smallest: 'Stop by for a cutting',
    details: 'Pothos and basil cuttings. Posted by a neighbor and not checked by us.',
  },
];

export const SECTION_TITLE: Record<StepSection, string> = {
  hand: 'Give a hand',
  happening: 'Happening',
  neighbor: 'Neighbors say',
};

export const SECTION_NOTE: Record<StepSection, string> = {
  hand: 'Verified hosts asking for help.',
  happening: 'Verified events this week.',
  neighbor: 'Not checked by us, so look twice.',
};
