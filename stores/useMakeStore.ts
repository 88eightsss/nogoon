// ─── Things I made ───────────────────────────────────────────────────────────
//
// The private gallery for the Make corner: tiny pixel pictures and one-line writings.
// Local to the phone for now. BEFORE this is promised as a reason to stay, it needs the Supabase sync
// and export described in docs (CLAUDE.md rule 2): losing someone's gallery on reinstall would hurt.
// Nothing here is public, shared or scored.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PIXEL_SIZE = 12;
/** Index 0 is empty. Cells are stored as a string of single digits, PIXEL_SIZE * PIXEL_SIZE long. */
export const PIXEL_PALETTE = ['', '#1f2937', '#e11d48', '#f59e0b', '#16a34a', '#0ea5e9', '#7c3aed', '#f9a8d4', '#f8fafc'];

export type MadeItem = {
  id: string;
  kind: 'pixel' | 'line';
  prompt: string;
  text?: string;     // for 'line'
  cells?: string;    // for 'pixel'
  at: number;
};

const MAX_ITEMS = 80;

interface MakeState {
  items: MadeItem[];
  addPixel: (prompt: string, cells: string) => void;
  addLine: (prompt: string, text: string) => void;
  remove: (id: string) => void;
}

export const useMakeStore = create<MakeState>()(
  persist(
    (set) => ({
      items: [],
      addPixel: (prompt, cells) =>
        set((s) => ({ items: [{ id: String(Date.now()), kind: 'pixel' as const, prompt, cells, at: Date.now() }, ...s.items].slice(0, MAX_ITEMS) })),
      addLine: (prompt, text) =>
        set((s) => ({ items: [{ id: String(Date.now()), kind: 'line' as const, prompt, text: text.trim().slice(0, 200), at: Date.now() }, ...s.items].slice(0, MAX_ITEMS) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    { name: 'nogoon-make', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

export const DRAW_PROMPTS = [
  'Draw something that is in the room with you.',
  'Draw how today feels, as a small creature.',
  'Draw a place you would rather be.',
  'Draw your companion having a good day.',
  'Draw the thing you are most looking forward to.',
  'Draw a pattern. No meaning needed.',
];
export const LINE_PROMPTS = [
  'Finish the sentence: right now I wish...',
  'One thing that went right today.',
  'Say it in three short lines. Do not count syllables.',
  'What would you tell a friend feeling this?',
  'Describe the view outside, in one line.',
  'Something small I am proud of.',
];
/** One prompt per day, so it does not feel random or like a slot machine. */
export function promptOfTheDay(list: string[], day = Math.floor(Date.now() / 86_400_000)): string {
  return list[day % list.length];
}
