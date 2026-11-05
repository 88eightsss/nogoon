// ─── Recovery helpers (gentle, local) ─────────────────────────────────────────
//
// Small things that make the pause feel like help instead of a wall:
//   - gate hits in the last few hours, so we can offer a way out after a pile-up (the "pressure valve")
//   - the person's own if-then plans ("When I ..., I will ...")
//   - what the quick "I need this for something" unlock was for, as a count only
//   - "Ride it out" urge timer: how many urges were watched, how many passed, and how long they took
//     (plain numbers only, never which app or site)
//
// Rules this store follows (see docs/ and the build plan):
//   - Nothing here ever resets to zero or shames a slip. "Days gained" is read from totalActiveDays in
//     the user store, which only goes up.
//   - Never stores which sites or apps were involved, only counts and the person's own words.
//   - Local to the phone for now. Sync to Supabase before the recovery features ship (CLAUDE.md rule 2).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';

export type IfThenPlan = { id: string; when: string; then: string };

/** What was behind a give-in, in the person's own pick. Counts only. */
export const TRIGGER_CHOICES = [
  { id: 'bored',   label: 'Bored' },
  { id: 'tired',   label: 'Tired' },
  { id: 'stressed', label: 'Stressed' },
  { id: 'lonely',  label: 'Lonely' },
  { id: 'late',    label: 'Late at night' },
  { id: 'habit',   label: 'Just habit' },
] as const;
export type TriggerId = typeof TRIGGER_CHOICES[number]['id'];

const HOUR_MS = 60 * 60 * 1000;
export const VALVE_THRESHOLD = 4;      // gate stops inside VALVE_WINDOW_MS before we offer a way out
export const VALVE_WINDOW_MS = HOUR_MS;
export const VALVE_COOLDOWN_MS = 6 * HOUR_MS;   // offered at most once per six hours
export const QUICK_UNLOCK_MINUTES = 5;
/** An urge only counts as ridden out if the person stayed with it at least this long (no farming). */
export const URGE_MIN_SECONDS = 90;
/** Do not show a typical time until there are this many durations, so early numbers cannot mislead. */
export const URGE_MIN_SAMPLES = 5;
const URGE_KEEP = 30;       // last N passed durations
const URGE_DAYS_KEEP = 60;  // per-day counts older than this are dropped

interface RecoveryState {
  gateHits: number[];                // timestamps, pruned to the last 3 hours
  valveOfferedAt: number;            // last time the pressure valve was shown
  plans: IfThenPlan[];
  quickUnlocks: number;              // how many times the 5-minute unlock was used (count only)
  annoyedTaps: number;               // how many times "This is annoying" was tapped (count only)
  slipPending: boolean;              // a give-in happened and the calm check-in has not been shown/answered yet
  triggers: Record<string, number>;  // trigger id -> count
  urgeStarts: Record<string, number>;  // day key -> urges watched with "Ride it out"
  urgesPassed: Record<string, number>; // day key -> urges that passed (stayed at least URGE_MIN_SECONDS)
  urgeSeconds: number[];               // last 30 passed durations, in seconds

  recordGateHit: () => void;
  markValveOffered: () => void;
  addPlan: (when: string, then: string) => void;
  removePlan: (id: string) => void;
  countQuickUnlock: () => void;
  countAnnoyed: () => void;
  markSlip: () => void;
  clearSlip: () => void;
  logTrigger: (id: TriggerId) => void;
  recordUrgeStart: () => void;
  recordUrgePassed: (seconds: number) => void;
}

function pruneDays(map: Record<string, number>, keep: number): Record<string, number> {
  const keys = Object.keys(map).sort();
  if (keys.length <= keep) return map;
  const out: Record<string, number> = {};
  for (const k of keys.slice(keys.length - keep)) out[k] = map[k];
  return out;
}

export const useRecoveryStore = create<RecoveryState>()(
  persist(
    (set) => ({
      gateHits: [],
      valveOfferedAt: 0,
      plans: [],
      quickUnlocks: 0,
      annoyedTaps: 0,
      slipPending: false,
      triggers: {},
      urgeStarts: {},
      urgesPassed: {},
      urgeSeconds: [],

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
      markSlip: () => set({ slipPending: true }),
      clearSlip: () => set({ slipPending: false }),
      logTrigger: (id) => set((s) => ({ triggers: { ...s.triggers, [id]: (s.triggers[id] ?? 0) + 1 } })),
      recordUrgeStart: () =>
        set((s) => {
          const day = getLocalDateKey();
          return { urgeStarts: pruneDays({ ...s.urgeStarts, [day]: (s.urgeStarts[day] ?? 0) + 1 }, URGE_DAYS_KEEP) };
        }),
      recordUrgePassed: (seconds) =>
        set((s) => {
          if (!Number.isFinite(seconds) || seconds < URGE_MIN_SECONDS) return {};
          const day = getLocalDateKey();
          return {
            urgesPassed: pruneDays({ ...s.urgesPassed, [day]: (s.urgesPassed[day] ?? 0) + 1 }, URGE_DAYS_KEEP),
            urgeSeconds: [...s.urgeSeconds, Math.round(seconds)].slice(-URGE_KEEP),
          };
        }),
    }),
    // Version stays 1 on purpose: the urge fields are new, and persist fills missing fields from the defaults above.
    // Bumping the version without a migrate function would throw away the person's saved plans.
    { name: 'nogoon-recovery', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** True when the person has hit the gate often enough, recently enough, that we should offer a way out. */
export function shouldOfferValve(hits: number[], valveOfferedAt: number, now = Date.now()): boolean {
  if (now - valveOfferedAt < VALVE_COOLDOWN_MS) return false;
  return hits.filter((t) => now - t < VALVE_WINDOW_MS).length >= VALVE_THRESHOLD;
}

/** Typical time an urge took to pass, in whole minutes. null until there are enough samples. Never a promise. */
export function medianUrgeMinutes(seconds: number[]): number | null {
  if (seconds.length < URGE_MIN_SAMPLES) return null;
  const sorted = [...seconds].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.max(1, Math.round(median / 60));
}
