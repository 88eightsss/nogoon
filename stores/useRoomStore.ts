// ─── Room store ───────────────────────────────────────────────────────────────
//
// Whether Today is drawn as the little room (default) or as the plain page. Saved on the
// phone; reset on sign-out with the other personal settings.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RoomState {
  roomView: boolean;
  setRoomView: (on: boolean) => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      roomView: true,
      setRoomView: (on) => set({ roomView: on }),
    }),
    {
      name: 'nogoon-room-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RoomState>;
        return { ...current, roomView: p.roomView !== false };
      },
    },
  ),
);
