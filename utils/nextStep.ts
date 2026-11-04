// ─── The one next step ────────────────────────────────────────────────────────
//
// Today shows a single card for the one thing worth doing next. This picks it, from what the person
// has already done (so it never nags about something finished). First match wins; null means nothing
// to suggest and the card stays hidden. Pure function, no store access, easy to read and test.
//
// Order is the order a new person should meet things: turn blocking on, choose what to pause, feel the
// pause, read the Briefing, then (once they have walked away) write their own line and look around
// Step Out. Nothing here is a lock: every screen stays one tap away in the tab bar.

import type { BlockingStatus } from '@/utils/blockingStatus';

export type NextStepAction =
  | { kind: 'settings' }                 // open Android accessibility settings
  | { kind: 'route'; to: string }
  | { kind: 'pause' };                   // open the "Need a minute" sheet

export type NextStep = {
  id: 'protect_on' | 'pick_apps' | 'meet_pause' | 'briefing' | 'own_line' | 'step_out';
  icon: 'shield' | 'plus-circle' | 'wind' | 'sunrise' | 'edit-3' | 'map-pin';
  title: string;
  body: string;
  cta: string;
  action: NextStepAction;
};

export type NextStepInput = {
  blockingStatus: BlockingStatus;
  blockedCount: number;        // sites + apps on the blocklist
  walkAways: number;
  pauseSeen: boolean;
  briefingOpened: boolean;
  localVisited: boolean;
  hasGateNote: boolean;
};

export function pickNextStep(i: NextStepInput): NextStep | null {
  if (i.blockingStatus === 'off') {
    return {
      id: 'protect_on', icon: 'shield', title: 'Turn on blocking',
      body: 'One Android permission lets NoGoon notice when you open an app you chose to pause. It never reads what is on your screen.',
      cta: 'Turn it on', action: { kind: 'settings' },
    };
  }
  if (i.blockedCount === 0) {
    return {
      id: 'pick_apps', icon: 'plus-circle', title: 'Choose what to pause',
      body: 'Pick the apps or sites you open without thinking. You can change this any time.',
      cta: 'Choose', action: { kind: 'route', to: '/(tabs)/blocklist' },
    };
  }
  if (i.walkAways === 0 && !i.pauseSeen) {
    return {
      id: 'meet_pause', icon: 'wind', title: 'Try the pause',
      body: 'When you open a blocked app, NoGoon stops you for a moment, then it is your choice. Here is a taste.',
      cta: 'Try it', action: { kind: 'pause' },
    };
  }
  if (!i.briefingOpened) {
    return {
      id: 'briefing', icon: 'sunrise', title: 'Read today\'s Briefing',
      body: 'A short read of good news and something to be curious about. It ends, on purpose.',
      cta: 'Open it', action: { kind: 'route', to: '/(tabs)/feed' },
    };
  }
  if (i.walkAways >= 1 && !i.hasGateNote) {
    return {
      id: 'own_line', icon: 'edit-3', title: 'Write your own line',
      body: 'Choose the words you want to see when you are tempted. They show up on the pause, in your voice.',
      cta: 'Write it', action: { kind: 'route', to: '/customize' },
    };
  }
  if (i.walkAways >= 2 && !i.localVisited) {
    return {
      id: 'step_out', icon: 'map-pin', title: 'See what is near you',
      body: 'Pick a place, go do something real, and tap "I went". Your pal gets a treat.',
      cta: 'Look around', action: { kind: 'route', to: '/(tabs)/local' },
    };
  }
  return null;
}
