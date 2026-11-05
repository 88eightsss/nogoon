// ─── Post once: the host's saved posts (local only) ───────────────────────────────────────────
// Up to ten, on this phone. Nothing is sent anywhere. A weekly post stays and is simply shared again.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostOnceEvent } from '@/lib/postOnce';

interface State {
  events: PostOnceEvent[];
  save: (e: PostOnceEvent) => void;
  remove: (id: string) => void;
}

export const usePostOnceStore = create<State>()(
  persist(
    (set) => ({
      events: [],
      save: (e) => set((s) => {
        const rest = s.events.filter((x) => x.id !== e.id);
        return { events: [e, ...rest].slice(0, 10) };
      }),
      remove: (id) => set((s) => ({ events: s.events.filter((x) => x.id !== id) })),
    }),
    { name: 'nogoon-postonce', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
