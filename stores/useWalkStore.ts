// Walks taken with the companion ("Take your pal for a walk"). Local only: step counts per day,
// how many walks, and how many feedings walking has given today (capped so it cannot be farmed).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';

export const WALK_MIN_STEPS_TO_FEED = 500;
export const WALK_MAX_FEEDS_PER_DAY = 2;
export const METRES_PER_STEP = 0.75;
export const GATE_GOALS = [150, 300, 500];

type Day = { steps: number; walks: number; fed: number };

interface State {
  days: Record<string, Day>;
  /** Optional: walking is how you get past the gate. Off unless the person turns it on. */
  gateWalk: boolean;
  gateGoal: number;
  setGateWalk: (on: boolean) => void;
  setGateGoal: (steps: number) => void;
  /** Saves a finished walk. Returns true when it earned a feeding. */
  finishWalk: (steps: number) => boolean;
  todayFed: () => number;
  todaySteps: () => number;
  reset: () => void;
}

export const useWalkStore = create<State>()(
  persist(
    (set, get) => ({
      days: {},
      gateWalk: false,
      gateGoal: 300,
      setGateWalk: (on) => set({ gateWalk: on }),
      setGateGoal: (steps) => set({ gateGoal: GATE_GOALS.includes(steps) ? steps : 300 }),
      finishWalk: (steps) => {
        const key = getLocalDateKey();
        const cur = get().days[key] ?? { steps: 0, walks: 0, fed: 0 };
        const earns = steps >= WALK_MIN_STEPS_TO_FEED && cur.fed < WALK_MAX_FEEDS_PER_DAY;
        const next: Day = { steps: cur.steps + Math.max(0, Math.round(steps)), walks: cur.walks + (steps >= 50 ? 1 : 0), fed: cur.fed + (earns ? 1 : 0) };
        // keep about two months
        const keys = Object.keys(get().days).sort().slice(-60);
        const days: Record<string, Day> = {};
        for (const k of keys) days[k] = get().days[k];
        days[key] = next;
        set({ days });
        return earns;
      },
      todayFed: () => get().days[getLocalDateKey()]?.fed ?? 0,
      todaySteps: () => get().days[getLocalDateKey()]?.steps ?? 0,
      reset: () => set({ days: {}, gateWalk: false, gateGoal: 300 }),
    }),
    {
      name: 'nogoon-walks',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          days: p.days && typeof p.days === 'object' ? p.days : current.days,
          gateWalk: p.gateWalk === true,
          gateGoal: typeof p.gateGoal === 'number' && GATE_GOALS.includes(p.gateGoal) ? p.gateGoal : 300,
        };
      },
    }
  )
);
