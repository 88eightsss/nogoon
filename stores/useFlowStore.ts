// ─── Guided start (flow) state ────────────────────────────────────────────────
//
// What the guided start needs to remember, nothing more: which one-time tips were shown, whether the
// person has been to Briefing and Step Out, whether they have tried the pause, whether they hid the
// next-step card for today, and whether they chose "Show me everything" (no card, no tips, full Today).
// UI convenience only. Local to the phone, never synced, nothing personal in it.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FlowState {
  tipsSeen: Record<string, true>;
  briefingOpened: boolean;
  localVisited: boolean;
  pauseSeen: boolean;
  /** Local date (YYYY-MM-DD) the next-step card was set aside with "Not now". */
  cardHiddenOn: string;
  showEverything: boolean;

  markTipSeen: (id: string) => void;
  markBriefingOpened: () => void;
  markLocalVisited: () => void;
  markPauseSeen: () => void;
  hideCardFor: (day: string) => void;
  setShowEverything: (v: boolean) => void;
  resetFlow: () => void;
}

const FRESH = {
  tipsSeen: {} as Record<string, true>,
  briefingOpened: false,
  localVisited: false,
  pauseSeen: false,
  cardHiddenOn: '',
  showEverything: false,
};

export const useFlowStore = create<FlowState>()(
  persist(
    (set) => ({
      ...FRESH,
      markTipSeen: (id) => set((s) => (s.tipsSeen[id] ? s : { tipsSeen: { ...s.tipsSeen, [id]: true } })),
      markBriefingOpened: () => set((s) => (s.briefingOpened ? s : { briefingOpened: true })),
      markLocalVisited: () => set((s) => (s.localVisited ? s : { localVisited: true })),
      markPauseSeen: () => set((s) => (s.pauseSeen ? s : { pauseSeen: true })),
      hideCardFor: (day) => set({ cardHiddenOn: day }),
      setShowEverything: (v) => set({ showEverything: v }),
      resetFlow: () => set({ ...FRESH }),
    }),
    {
      name: 'nogoon-flow',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
