// ─── Journal pages store ──────────────────────────────────────────────────────
// The creative journal: each page has text, paper, ink, stickers and doodles.
// Local to the phone (AsyncStorage). The older "Moments" quick entries still live in
// useUserStore.journalEntries and are untouched.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaperId, PatternId, FrameId, FontId } from '@/constants/journalStyles';

export type PageSticker = {
  id: string;
  glyph: string;      // `e:🌸` or `m:3`
  x: number;          // 0..1 of page width (centre)
  y: number;          // 0..1 of page height (centre)
  size: number;       // 0.6 .. 3 (multiplier)
  rot: number;        // degrees
};

export type PageStroke = { id: string; color: string; width: number; d: string };   // 1000-unit space

export type JournalPage = {
  id: string;
  title: string;
  body: string;
  paper: PaperId;
  pattern: PatternId;
  frame: FrameId;
  font: FontId;
  sizeIdx: number;        // index into TEXT_SIZES
  easyRead: boolean;      // roomier letters and lines
  ink: string | null;     // null = the paper's default ink
  mood: string | null;    // MOOD_TAGS id
  pinned: boolean;
  stickers: PageSticker[];
  strokes: PageStroke[];
  createdAt: number;
  updatedAt: number;
};

type NewPage = Partial<Omit<JournalPage, 'id' | 'createdAt' | 'updatedAt'>>;

interface JournalState {
  pages: JournalPage[];
  addPage: (init?: NewPage) => string;
  updatePage: (id: string, patch: Partial<Omit<JournalPage, 'id' | 'createdAt'>>) => void;
  deletePage: (id: string) => void;
  togglePin: (id: string) => void;
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      pages: [],
      addPage: (init = {}) => {
        const id = uid('page');
        const now = Date.now();
        const page: JournalPage = {
          id, title: '', body: '', paper: 'cream', pattern: 'lined', frame: 'none',
          font: 'soft', sizeIdx: 1, easyRead: false, ink: null, mood: null, pinned: false,
          stickers: [], strokes: [], createdAt: now, updatedAt: now,
          ...init,
        };
        set((s) => ({ pages: [page, ...s.pages] }));
        return id;
      },
      updatePage: (id, patch) =>
        set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) })),
      deletePage: (id) => set((s) => ({ pages: s.pages.filter((p) => p.id !== id) })),
      togglePin: (id) =>
        set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),
    }),
    { name: 'nogoon-journal-pages', storage: createJSONStorage(() => AsyncStorage) }
  )
);
