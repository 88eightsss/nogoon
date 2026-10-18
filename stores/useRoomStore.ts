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

/** How the Today tab is laid out. */
export type TodayLayout = 'room' | 'cards' | 'plain' | 'focus';
export const TODAY_LAYOUTS: TodayLayout[] = ['room', 'cards', 'plain', 'focus'];
/** How the bottom tab bar looks. */
export type TabStyle = 'standard' | 'raised';
const isLayout = (v: unknown): v is TodayLayout => typeof v === 'string' && (TODAY_LAYOUTS as string[]).includes(v);
const hasRoom = (l: TodayLayout) => l === 'room' || l === 'cards';

interface RoomState {
  roomView: boolean;            // true for the layouts that show the room (room, cards)
  setRoomView: (on: boolean) => void;
  todayLayout: TodayLayout;
  setTodayLayout: (l: TodayLayout) => void;
  tabStyle: TabStyle;
  setTabStyle: (t: TabStyle) => void;
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
      setRoomView: (on) => {
        const cur = get().todayLayout;
        const todayLayout: TodayLayout = on ? (hasRoom(cur) ? cur : 'room') : 'plain';
        set({ roomView: on, todayLayout });
      },
      todayLayout: 'room',
      setTodayLayout: (l) => set({ todayLayout: l, roomView: hasRoom(l) }),
      tabStyle: 'standard',
      setTabStyle: (t) => set({ tabStyle: t }),
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
        const todayLayout: TodayLayout = isLayout(p.todayLayout) ? p.todayLayout : (p.roomView === false ? 'plain' : 'room');
        return {
          ...current,
          todayLayout,
          roomView: hasRoom(todayLayout),
          tabStyle: p.tabStyle === 'raised' ? 'raised' : 'standard',
          roomName: typeof p.roomName === 'string' ? p.roomName.slice(0, ROOM_NAME_MAX) : '',
          look, decor,
        };
      },
    },
  ),
);
