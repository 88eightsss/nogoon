// ─── Instead Board cards ─────────────────────────────────────────────────────
//
// The planner on Today. Three kinds of card in Morning / Afternoon / Evening:
//   do   - an ordinary task
//   make - something small and creative
//   hold - a plan for a hard hour
// Finished cards stay visible for the day they were finished, then drop off.
// No coins, dice or random rewards. Local to the phone for now (sync before promising it).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';

export type CardKind = 'do' | 'make' | 'hold';
export type DayPart = 'morning' | 'afternoon' | 'evening';

export type Card = { id: string; kind: CardKind; part: DayPart; text: string; doneOn: string };

const MAX_CARDS = 40;

interface PlannerState {
  cards: Card[];
  doneTotal: number;
  addCard: (kind: CardKind, part: DayPart, text: string) => void;
  toggleCard: (id: string) => void;
  removeCard: (id: string) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      cards: [],
      doneTotal: 0,
      addCard: (kind, part, text) =>
        set((s) => {
          const today = getLocalDateKey();
          const t = text.trim().slice(0, 80);
          if (!t) return s;
          const kept = s.cards.filter((c) => !c.doneOn || c.doneOn === today);
          return { cards: [...kept, { id: String(Date.now()), kind, part, text: t, doneOn: '' }].slice(-MAX_CARDS) };
        }),
      toggleCard: (id) =>
        set((s) => {
          const today = getLocalDateKey();
          let bump = 0;
          const cards = s.cards.map((c) => {
            if (c.id !== id) return c;
            if (c.doneOn) return { ...c, doneOn: '' };
            bump = 1;
            return { ...c, doneOn: today };
          });
          return { cards, doneTotal: s.doneTotal + bump };
        }),
      removeCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
    }),
    { name: 'nogoon-planner', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** Cards to show: not finished, or finished today. */
export function visibleCards(cards: Card[], part: DayPart, today = getLocalDateKey()): Card[] {
  return cards.filter((c) => c.part === part && (!c.doneOn || c.doneOn === today));
}
