// ─── Perk Store ───────────────────────────────────────────────────────────────
//
// Remembers the last day a sponsor perk was shown after a finished walk, so it appears at most once a day.
// Local only; nothing is sent anywhere.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PerkState {
  lastShownDay: string;                 // local YYYY-MM-DD, '' = never
  markShown: (day: string) => void;
}

export const usePerkStore = create<PerkState>()(
  persist(
    (set) => ({
      lastShownDay: '',
      markShown: (day) => set({ lastShownDay: day }),
    }),
    { name: 'nogoon-perk', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
