// How long the Briefing is: a calm batch of 20 stories with an end, or endless scrolling.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BriefingLength = 'twenty' | 'endless';

interface State {
  length: BriefingLength;
  setLength: (v: BriefingLength) => void;
}

export const useBriefingPrefs = create<State>()(
  persist(
    (set) => ({ length: 'twenty', setLength: (length) => set({ length }) }),
    { name: 'nogoon-briefing-prefs', storage: createJSONStorage(() => AsyncStorage) }
  )
);
