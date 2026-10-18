// ─── Mascot store ─────────────────────────────────────────────────────────────
//
// Which companion is active, and how much each companion has been fed. Every walk-away feeds the
// active companion by one, and only the active one grows: its stage comes from its own `fed`
// count, so switching mascots never costs the others their progress.
// (The room's own level still comes from lifetime walk-aways, see constants/room.ts.)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCharacterId } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';

/** Older builds kept the chosen companion here; the gate screen still reads it. */
export const CHARACTER_KEY = '@nogoon_goon_character';

export type MascotStage = 0 | 1 | 2 | 3 | 4;
/** Feedings needed to reach stage 1..4 (Awakening, Standing, Powered, Legendary). */
export const STAGE_AT = [5, 15, 30, 60] as const;

export function stageOf(fed: number): MascotStage {
  if (fed >= STAGE_AT[3]) return 4;
  if (fed >= STAGE_AT[2]) return 3;
  if (fed >= STAGE_AT[1]) return 2;
  if (fed >= STAGE_AT[0]) return 1;
  return 0;
}

/** The feeding count at which the next stage starts, or null at the top. */
export function nextStageAt(fed: number): number | null {
  for (const n of STAGE_AT) if (fed < n) return n;
  return null;
}

interface MascotState {
  active: CharacterId;
  fed: Partial<Record<CharacterId, number>>;
  /** True once an existing install's walk-aways were credited to its companion. */
  migrated: boolean;
  /** Treats earned by walking away or walking the pal. Spend one with Feed on Today. */
  treats: number;
  setActive: (id: CharacterId) => void;
  /** Feed the active companion. */
  feed: (n?: number) => void;
  /** Bank a treat (a walk-away or a walk earns one). */
  addTreat: (n?: number) => void;
  /** Spend one treat to feed the active companion. Returns false when there is none. */
  feedWithTreat: () => boolean;
  /** One-off: credit lifetime walk-aways to the companion this install already had. */
  migrate: (active: CharacterId, walkAways: number) => void;
}

export const useMascotStore = create<MascotState>()(
  persist(
    (set, get) => ({
      active: 0,
      fed: {},
      migrated: false,
      treats: 0,
      setActive: (id) => {
        if (!isCharacterId(id)) return;
        set({ active: id });
        AsyncStorage.setItem(CHARACTER_KEY, String(id)).catch(() => {});
      },
      feed: (n = 1) => {
        const { active, fed } = get();
        set({ fed: { ...fed, [active]: (fed[active] ?? 0) + n } });
      },
      addTreat: (n = 1) => set({ treats: Math.min(99, get().treats + n) }),
      feedWithTreat: () => {
        const { treats, active, fed } = get();
        if (treats < 1) return false;
        set({ treats: treats - 1, fed: { ...fed, [active]: (fed[active] ?? 0) + 1 } });
        return true;
      },
      migrate: (active, walkAways) => {
        if (get().migrated) return;
        set({ active, fed: { ...get().fed, [active]: Math.max(0, walkAways) }, migrated: true });
      },
    }),
    {
      name: 'nogoon-mascots-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MascotState>;
        const fed: Partial<Record<CharacterId, number>> = {};
        for (const [k, v] of Object.entries(p.fed ?? {})) {
          const id = Number(k);
          if (isCharacterId(id) && typeof v === 'number' && Number.isFinite(v) && v >= 0) fed[id] = Math.floor(v);
        }
        return {
          ...current,
          active: isCharacterId(p.active) ? p.active : 0,
          fed,
          migrated: p.migrated === true,
          treats: typeof p.treats === 'number' && Number.isFinite(p.treats) ? Math.max(0, Math.min(99, Math.floor(p.treats))) : 0,
        };
      },
    },
  ),
);
