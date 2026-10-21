// How long the Briefing is: a calm batch of 20 stories with an end, or endless scrolling.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';

export type BriefingLength = 'twenty' | 'endless';

interface State {
  length: BriefingLength;
  setLength: (v: BriefingLength) => void;
  /** Stories opened today (url or headline). Resets each local day; drives the "3 of 16 read" bar. */
  readDay: string;
  read: string[];
  markRead: (key: string) => void;
}

export const useBriefingPrefs = create<State>()(
  persist(
    (set) => ({
      length: 'twenty',
      setLength: (length) => set({ length }),
      readDay: '',
      read: [],
      markRead: (key) => set((st) => {
        const today = getLocalDateKey();
        if (st.readDay !== today) return { readDay: today, read: [key] };
        if (st.read.includes(key)) return st;
        return { read: [...st.read, key].slice(-200) };
      }),
    }),
    { name: 'nogoon-briefing-prefs', storage: createJSONStorage(() => AsyncStorage) }
  )
);
