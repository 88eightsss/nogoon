// ─── Recovery helpers (gentle, local) ─────────────────────────────────────────
//
// Small things that make the pause feel like help instead of a wall:
//   - gate hits in the last few hours, so we can offer a way out after a pile-up (the "pressure valve")
//   - the person's own if-then plans ("When I ..., I will ...")
//   - what the quick "I need this for something" unlock was for, as a count only
//
// Rules this store follows (see docs/ and the build plan):
//   - Nothing here ever resets to zero or shames a slip. "Days gained" is read from totalActiveDays in
//     the user store, which only goes up.
//   - Never stores which sites or apps were involved, only counts and the person's own words.
//   - Local to the phone for now. Sync to Supabase before the recovery features ship (CLAUDE.md rule 2).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type IfThenPlan = { id: string; when: string; then: string };

const HOUR_MS = 60 * 60 * 1000;
export const VALVE_THRESHOLD = 4;      // gate stops inside VALVE_WINDOW_MS before we offer a way out
export const VALVE_WINDOW_MS = HOUR_MS;
export const VALVE_COOLDOWN_MS = 6 * HOUR_MS;   // offered at most once per six hours
export const QUICK_UNLOCK_MINUTES = 5;

interface RecoveryState {
  gateHits: number[];                // timestamps, pruned to the last 3 hours
  valveOfferedAt: number;            // last time the pressure valve was shown
  plans: IfThenPlan[];
  quickUnlocks: number;              // how many times the 5-minute unlock was used (count only)
  annoyedTaps: number;               // how many times "This is annoying" was tapped (count only)

  recordGateHit: () => void;
  markValveOffered: () => void;
  addPlan: (when: string, then: string) => void;
  removePlan: (id: string) => void;
  countQuickUnlock: () => void;
  countAnnoyed: () => void;
}

export const useRecoveryStore = create<RecoveryState>()(
  persist(
    (set) => ({
      gateHits: [],
      valveOfferedAt: 0,
      plans: [],
      quickUnlocks: 0,
      annoyedTaps: 0,

      recordGateHit: () =>
        set((s) => {
          const now = Date.now();
          return { gateHits: [...s.gateHits.filter((t) => now - t < 3 * HOUR_MS), now] };
        }),
      markValveOffered: () => set({ valveOfferedAt: Date.now() }),
      addPlan: (when, then) =>
        set((s) => ({
          plans: [...s.plans, { id: String(Date.now()), when: when.trim(), then: then.trim() }].slice(0, 5),
        })),
      removePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      countQuickUnlock: () => set((s) => ({ quickUnlocks: s.quickUnlocks + 1 })),
      countAnnoyed: () => set((s) => ({ annoyedTaps: s.annoyedTaps + 1 })),
    }),
    { name: 'nogoon-recovery', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** True when the person has hit the gate often enough, recently enough, that we should offer a way out. */
export function shouldOfferValve(hits: number[], valveOfferedAt: number, now = Date.now()): boolean {
  if (now - valveOfferedAt < VALVE_COOLDOWN_MS) return false;
  return hits.filter((t) => now - t < VALVE_WINDOW_MS).length >= VALVE_THRESHOLD;
}
