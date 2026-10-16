// ─── Room store ───────────────────────────────────────────────────────────────
//
// "Your room": whether Today is drawn as the little room (default) or the plain page, plus
// the user's own choices for it: a name, six colours, and which pieces of decor to show.
// Saved on the phone; reset on sign-out with the other personal settings.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_DECOR, DEFAULT_LOOK, ROOM_SWATCHES, type DecorKey, type LookPart, type RoomDecor, type RoomLook,
} from '@/constants/room';

export const ROOM_NAME_MAX = 24;

interface RoomState {
  roomView: boolean;
  setRoomView: (on: boolean) => void;
  roomName: string;
  setRoomName: (name: string) => void;
  look: RoomLook;
  setLook: (part: LookPart, key: string) => void;
  decor: RoomDecor;
  setDecor: (key: DecorKey, on: boolean) => void;
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      roomView: true,
      setRoomView: (on) => set({ roomView: on }),
      roomName: '',
      setRoomName: (name) => set({ roomName: name.slice(0, ROOM_NAME_MAX) }),
      look: DEFAULT_LOOK,
      setLook: (part, key) => {
        if (!ROOM_SWATCHES[part].some((s) => s.key === key)) return;
        set({ look: { ...get().look, [part]: key } });
      },
      decor: DEFAULT_DECOR,
      setDecor: (key, on) => set({ decor: { ...get().decor, [key]: on } }),
      resetRoom: () => set({ look: DEFAULT_LOOK, decor: DEFAULT_DECOR }),
    }),
    {
      name: 'nogoon-room-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Drop anything unknown so an old or edited value can never break the room.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RoomState>;
        const look = { ...DEFAULT_LOOK } as RoomLook;
        for (const part of Object.keys(DEFAULT_LOOK) as LookPart[]) {
          const v = p.look?.[part];
          if (typeof v === 'string' && ROOM_SWATCHES[part].some((s) => s.key === v)) look[part] = v;
        }
        const decor = { ...DEFAULT_DECOR } as RoomDecor;
        for (const k of Object.keys(DEFAULT_DECOR) as DecorKey[]) {
          if (typeof p.decor?.[k] === 'boolean') decor[k] = p.decor[k];
        }
        return {
          ...current,
          roomView: p.roomView !== false,
          roomName: typeof p.roomName === 'string' ? p.roomName.slice(0, ROOM_NAME_MAX) : '',
          look, decor,
        };
      },
    },
  ),
);
