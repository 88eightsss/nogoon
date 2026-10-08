// ─── Progress / Feature Unlock Store ──────────────────────────────────────────
//
// Gates the app's deeper features behind early, achievable walk-away
// milestones instead of dumping all 19 games + Insights + Journal +
// the home screen Organizer mode on a brand-new user at once. Thresholds are
// intentionally small (single-digit to low-teens walk-aways) — these are
// about pacing discovery over the first week or two, not the big lifetime
// celebration milestones (10/25/50/100...) used elsewhere for the mascot
// milestone flash.
//
// Usage: const { unlocked, newlyUnlocked, markSeen } = useUnlockedFeatures();

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from './useUserStore';

// Progressive unlocking is OFF: every feature is available from the first launch.
// Flip to true to bring back the walk-away drip-feed (lock hints, "X unlocked!"
// toasts and the Me-tab "Unlock everything now" switch all key off this flag).
export const PROGRESSIVE_UNLOCKS = false;

export type FeatureId = 'fullArcade' | 'insights' | 'journal' | 'organizerMode';

export type UnlockRule = {
  id:          FeatureId;
  label:       string;   // shown in "X unlocked!" toasts and lock hints
  requirement: string;   // human-readable, e.g. "3 walk-aways"
  threshold:   number;   // walk-away count required
};

// Ordered by threshold — also the order features are introduced to a user.
export const UNLOCK_RULES: UnlockRule[] = [
  { id: 'fullArcade',    label: 'Full Arcade',     requirement: '3 walk-aways',  threshold: 3  },
  { id: 'insights',      label: 'Insights',        requirement: '5 walk-aways',  threshold: 5  },
  { id: 'journal',       label: 'Impulse Journal', requirement: '6 walk-aways',  threshold: 6  },
  { id: 'organizerMode', label: 'Home Organizer',  requirement: '8 walk-aways',  threshold: 8  },
];

const RULES_BY_ID: Record<FeatureId, UnlockRule> = Object.fromEntries(
  UNLOCK_RULES.map((r) => [r.id, r])
) as Record<FeatureId, UnlockRule>;

interface ProgressState {
  // Escape hatch for anyone who'd rather see everything immediately —
  // surfaced as a single toggle on the Me screen, off by default.
  forceUnlockAll: boolean;
  // Which "you unlocked X" toasts have already been shown, so they only
  // fire once per feature rather than every time the home screen mounts.
  seenUnlocks: FeatureId[];

  setForceUnlockAll: (val: boolean) => void;
  markUnlockSeen: (id: FeatureId) => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      forceUnlockAll: false,
      seenUnlocks:    [],

      setForceUnlockAll: (val) => set({ forceUnlockAll: val }),

      markUnlockSeen: (id) => {
        const { seenUnlocks } = get();
        if (seenUnlocks.includes(id)) return;
        set({ seenUnlocks: [...seenUnlocks, id] });
      },
    }),
    {
      name:    'nogoon-progress-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function isUnlocked(id: FeatureId, walkAwayCount: number, forceUnlockAll: boolean): boolean {
  if (!PROGRESSIVE_UNLOCKS || forceUnlockAll) return true;
  return walkAwayCount >= RULES_BY_ID[id].threshold;
}

export function lockHint(id: FeatureId): string {
  return `Unlocks at ${RULES_BY_ID[id].requirement}`;
}

// Convenience hook — combines live walk-away count with the progress store
// to give a ready-to-use unlocked set, plus any features that just crossed
// their threshold and haven't been announced yet.
export function useUnlockedFeatures() {
  const walkAwayCount = useUserStore((s) => s.walkAwayCount);
  const { forceUnlockAll, seenUnlocks, markUnlockSeen } = useProgressStore();

  const unlocked = new Set<FeatureId>(
    UNLOCK_RULES.filter((r) => isUnlocked(r.id, walkAwayCount, forceUnlockAll)).map((r) => r.id)
  );

  // No "just unlocked" announcements when nothing is ever locked.
  const newlyUnlocked = !PROGRESSIVE_UNLOCKS
    ? []
    : UNLOCK_RULES.filter((r) => unlocked.has(r.id) && !seenUnlocks.includes(r.id));

  return { unlocked, newlyUnlocked, markSeen: markUnlockSeen, walkAwayCount };
}
