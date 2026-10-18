// Which chapters of the interactive tour the person has finished, and which tabs have already
// shown their spotlight coach marks. Local only.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface State {
  done: Record<string, true>;
  coachSeen: Record<string, true>;
  /** The full tour has been offered once, right after setup. */
  offered: boolean;
  /** Person asked for the tab spotlight (it never starts by itself). */
  coachRequested: boolean;
  markOffered: () => void;
  requestCoach: () => void;
  markDone: (chapter: string) => void;
  markCoachSeen: (tab: string) => void;
  clearCoachSeen: (tab: string) => void;
  resetTour: () => void;
}

export const useTourStore = create<State>()(
  persist(
    (set) => ({
      done: {},
      coachSeen: {},
      offered: false,
      coachRequested: false,
      markOffered: () => set({ offered: true }),
      requestCoach: () => set((s) => { const c = { ...s.coachSeen }; delete c.tabs; return { coachSeen: c, coachRequested: true }; }),
      markDone: (chapter) => set((s) => ({ done: { ...s.done, [chapter]: true } })),
      markCoachSeen: (tab) => set((s) => ({ coachSeen: { ...s.coachSeen, [tab]: true }, coachRequested: false })),
      clearCoachSeen: (tab) => set((s) => { const c = { ...s.coachSeen }; delete c[tab]; return { coachSeen: c }; }),
      resetTour: () => set({ done: {}, coachSeen: {}, offered: false, coachRequested: false }),
    }),
    { name: 'nogoon-tour', storage: createJSONStorage(() => AsyncStorage), version: 1 }
  )
);
