// ─── Lab switches (beta looks and layouts) ───────────────────────────────────────────────────
//
// One place for "try the new one" switches, so a new Home or navigation can sit next to the old one
// until it has been tested on a phone. Device setting only: local to the phone, never synced, nothing
// personal in it. Close and reopen the app after changing one so the tab bar rebuilds cleanly.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LabState {
  /** New Simple Home + three-tab bar (Home, Briefing, Step Out), Me as a corner, "Need a minute" sheet. */
  homeV3: boolean;
  setHomeV3: (v: boolean) => void;
}

export const useLabStore = create<LabState>()(
  persist(
    (set) => ({
      homeV3: false,
      setHomeV3: (v) => set({ homeV3: v }),
    }),
    { name: 'nogoon-lab', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
