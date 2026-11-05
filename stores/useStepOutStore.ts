// ─── Step Out: what the person did with the feed (local only) ─────────────────────────────────
//
// Phase 2 sample build. Everything here stays on the phone. Replies are invisible by design:
//   "Not this time" and "Look at it later" would send nothing even when the backend exists.
//   Only "I'll come along" would ever tell the host or the friend who opened a door.
// Crews and postcards are a local mock until the tables exist (supabase/migrations/20261105_stepout_social.sql).
// No counts of anything are kept or shown to anyone else.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Reply = 'coming' | 'later' | 'no';

export interface Postcard { id: string; line: string; at: number }
export interface CrewMember { id: string; name: string }
export interface Crew {
  id: string;
  name: string;
  members: CrewMember[];   // up to CREW_MAX including the person
  nextItemId: string | null;
  postcards: Postcard[];
}

export const CREW_MAX = 8;
export const POSTCARD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface State {
  replies: Record<string, Reply>;
  doorReplies: Record<string, Reply>;   // door key -> reply (doors received from friends)
  crew: Crew | null;

  reply: (id: string, r: Reply) => void;
  clearReply: (id: string) => void;
  replyDoor: (key: string, r: Reply) => void;
  startCrew: (name: string) => void;
  addMember: (name: string) => boolean;
  setCrewNext: (itemId: string | null) => void;
  addPostcard: (line: string) => void;
  dropCrew: () => void;
}

function live(cards: Postcard[], now = Date.now()) {
  return cards.filter((c) => now - c.at < POSTCARD_DAYS * DAY_MS);
}

export const useStepOutStore = create<State>()(
  persist(
    (set, get) => ({
      replies: {},
      doorReplies: {},
      crew: null,

      reply: (id, r) => set((s) => ({ replies: { ...s.replies, [id]: r } })),
      clearReply: (id) => set((s) => { const { [id]: _gone, ...rest } = s.replies; return { replies: rest }; }),
      replyDoor: (key, r) => set((s) => ({ doorReplies: { ...s.doorReplies, [key]: r } })),

      startCrew: (name) => set({ crew: { id: String(Date.now()), name: name.trim().slice(0, 30) || 'My crew', members: [{ id: 'me', name: 'You' }], nextItemId: null, postcards: [] } }),
      addMember: (name) => {
        const c = get().crew;
        if (!c || c.members.length >= CREW_MAX) return false;
        const clean = name.trim().slice(0, 24);
        if (!clean) return false;
        set({ crew: { ...c, members: [...c.members, { id: String(Date.now()), name: clean }] } });
        return true;
      },
      setCrewNext: (itemId) => set((s) => (s.crew ? { crew: { ...s.crew, nextItemId: itemId } } : {})),
      addPostcard: (line) =>
        set((s) => {
          if (!s.crew) return {};
          const clean = line.trim().slice(0, 140);
          if (!clean) return {};
          return { crew: { ...s.crew, postcards: [{ id: String(Date.now()), line: clean, at: Date.now() }, ...live(s.crew.postcards)].slice(0, 20) } };
        }),
      dropCrew: () => set({ crew: null }),
    }),
    { name: 'nogoon-stepout', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** Postcards still inside their seven days. Older ones are simply not shown (and dropped on the next write). */
export function livePostcards(cards: Postcard[]): Postcard[] { return live(cards); }
export function daysLeft(c: Postcard, now = Date.now()): number {
  return Math.max(1, Math.ceil((POSTCARD_DAYS * DAY_MS - (now - c.at)) / DAY_MS));
}
