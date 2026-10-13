// ─── Pack Store ───────────────────────────────────────────────────────────────
//
// Which skin (pack) is active, which hidden packs the user has unlocked, whether
// the new My Page is switched on, and the personal note shown at the gate.
// Non-sensitive UI preference, persisted to AsyncStorage like useThemeStore.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PACKS, getPack, findPackByCode, packsUnlockedByStreak, packUnlockedByTap,
  type PackManifest,
} from '@/constants/packs';

export type GateVoice = 'gentle' | 'hype' | 'dry';
export const GATE_NOTE_MAX = 140;

interface PackState {
  activePackId: string;
  unlockedIds:  string[];       // hidden packs the user has opened
  seenUnlockIds: string[];      // unlocks the user has already been told about
  newHome:      boolean;        // new My Page + 4-tab layout (beta switch)
  gateNote:     string;         // personal note shown on the gate
  gateVoice:    GateVoice;

  setActivePack: (id: string) => void;
  unlockPack:    (id: string) => void;
  redeemCode:    (code: string) => PackManifest | null;
  checkStreakUnlocks: (longestStreak: number) => PackManifest[];  // returns newly unlocked
  tapUnlock:     () => PackManifest | null;
  markUnlockSeen: (id: string) => void;
  setNewHome:    (on: boolean) => void;
  setGateNote:   (text: string) => void;
  setGateVoice:  (v: GateVoice) => void;
}

export const usePackStore = create<PackState>()(
  persist(
    (set, get) => ({
      activePackId: 'core',
      unlockedIds: [],
      seenUnlockIds: [],
      newHome: false,
      gateNote: '',
      gateVoice: 'gentle',

      setActivePack: (id) => {
        const p = PACKS.find((x) => x.id === id);
        if (!p) return;
        if (p.hidden && !get().unlockedIds.includes(id)) return;
        set({ activePackId: id });
      },

      unlockPack: (id) => {
        if (!PACKS.some((p) => p.id === id)) return;
        set((s) => (s.unlockedIds.includes(id) ? s : { unlockedIds: [...s.unlockedIds, id] }));
      },

      redeemCode: (code) => {
        const p = findPackByCode(code);
        if (!p) return null;
        get().unlockPack(p.id);
        return p;
      },

      checkStreakUnlocks: (longestStreak) => {
        const have = get().unlockedIds;
        const fresh = packsUnlockedByStreak(longestStreak).filter((p) => !have.includes(p.id));
        if (fresh.length) set({ unlockedIds: [...have, ...fresh.map((p) => p.id)] });
        return fresh;
      },

      tapUnlock: () => {
        const have = get().unlockedIds;
        const fresh = packUnlockedByTap().filter((p) => !have.includes(p.id));
        if (!fresh.length) return null;
        set({ unlockedIds: [...have, ...fresh.map((p) => p.id)] });
        return fresh[0];
      },

      markUnlockSeen: (id) => set((s) => (s.seenUnlockIds.includes(id) ? s : { seenUnlockIds: [...s.seenUnlockIds, id] })),
      setNewHome: (on) => set({ newHome: on }),
      setGateNote: (text) => set({ gateNote: text.slice(0, GATE_NOTE_MAX) }),
      setGateVoice: (v) => set({ gateVoice: v }),
    }),
    {
      name: 'nogoon-pack-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({
        activePackId: s.activePackId,
        unlockedIds: s.unlockedIds,
        seenUnlockIds: s.seenUnlockIds,
        newHome: s.newHome,
        gateNote: s.gateNote,
        gateVoice: s.gateVoice,
      }),
    }
  )
);

export { getPack };
