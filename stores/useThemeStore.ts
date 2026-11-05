// ─── Theme Store ─────────────────────────────────────────────────────────────
//
// Persists the user's selected color theme and border style.
// Reads/writes AsyncStorage (non-sensitive UI preference).
//
// Usage: const { themeId, borderId, setTheme, setBorder } = useThemeStore()
// For resolved values, use the useTheme() hook instead.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';
import { ThemeId, BorderId, DEFAULT_THEME, DEFAULT_BORDER } from '@/constants/Themes';
export type Appearance = 'system' | 'light' | 'dark';

interface ThemeState {
  /** The one colour choice: follow the phone, or always light, or always dark. */
  appearance: Appearance;
  /** Switch to the dark look between 9 pm and 6 am. */
  dimAtNight: boolean;
  setAppearance: (a: Appearance) => void;
  setDimAtNight: (v: boolean) => void;
  themeId: ThemeId;
  borderId: BorderId;
  // Struggling mode — soft flag, resets on new day
  strugglingMode: boolean;
  strugglingDate: string;  // 'YYYY-MM-DD'
  // Gate game opt-outs — IDs in this list won't be picked at intercept
  // (puzzle/reflex/skill games — on by default).
  disabledGateGames: string[];
  // Calm-game opt-ins — IDs in this list CAN be picked at intercept. Calm
  // games (breathing, grounding, etc.) are off by default there since
  // they're meant for unhurried standalone practice — this lets someone
  // deliberately choose to let one interrupt them too, if they want that.
  enabledCalmGateGames: string[];

  // Brightness dial — 0 = Dark, 50 = Grey, 100 = Light (see constants/Themes.ts).
  // New installs start light (matches the welcome slides); the palette screen lets people go dark.
  themeBrightness: number;

  setTheme: (id: ThemeId) => void;
  setBorder: (id: BorderId) => void;
  setStruggling: (val: boolean) => void;
  checkResetStruggling: () => void;  // call on app open
  toggleGateGame: (id: string) => void;
  toggleCalmGateGame: (id: string) => void;
  setThemeBrightness: (val: number) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      appearance:        'system' as Appearance,
      dimAtNight:        false,
      setAppearance: (a) => set({ appearance: a }),
      setDimAtNight: (v) => set({ dimAtNight: v }),
      themeId:           DEFAULT_THEME,
      borderId:          DEFAULT_BORDER,
      strugglingMode:    false,
      strugglingDate:    '',
      disabledGateGames: [],
      enabledCalmGateGames: [],
      themeBrightness:    100,

      setTheme:  (id) => set({ themeId: id }),
      setBorder: (id) => set({ borderId: id }),

      setStruggling: (val) => {
        const today = getLocalDateKey();
        set({ strugglingMode: val, strugglingDate: today });
      },

      checkResetStruggling: () => {
        const { strugglingMode, strugglingDate } = get();
        if (!strugglingMode) return;
        const today = getLocalDateKey();
        if (strugglingDate !== today) {
          set({ strugglingMode: false, strugglingDate: '' });
        }
      },

      toggleGateGame: (id) => {
        const { disabledGateGames } = get();
        const next = disabledGateGames.includes(id)
          ? disabledGateGames.filter((g) => g !== id)
          : [...disabledGateGames, id];
        set({ disabledGateGames: next });
      },

      toggleCalmGateGame: (id) => {
        const { enabledCalmGateGames } = get();
        const next = enabledCalmGateGames.includes(id)
          ? enabledCalmGateGames.filter((g) => g !== id)
          : [...enabledCalmGateGames, id];
        set({ enabledCalmGateGames: next });
      },

      setThemeBrightness: (val) => set({ themeBrightness: Math.max(0, Math.min(100, val)) }),
    }),
    {
      name:    'nogoon-theme-store',
      storage: createJSONStorage(() => AsyncStorage),
      // v1: themeBrightness's meaning changed from "0-100 lightness nudge,
      // 50 = no-op default" to "0-100 Dark/Grey/Light dial, 50 = pure Grey"
      // (see constants/Themes.ts). Anyone who already has 50 persisted from
      // before this change picked it as a no-op, not as "Grey" — remap it to
      // the new no-op default (0) once so existing installs don't wake up
      // with every theme stuck on Grey.
      version: 2,
      migrate: (persisted: any, version: number) => {
        let p = persisted;
        if (version < 1 && p?.themeBrightness === 50) {
          p = { ...p, themeBrightness: 0 };
        }
        // v2: Light/Dark/Match phone replaces the six themes and the brightness dial.
        // Keep whichever side of the dial the person was on.
        if (version < 2 && typeof p?.themeBrightness === 'number') {
          p = { ...p, appearance: p.themeBrightness >= 50 ? 'light' : 'dark', dimAtNight: false };
        }
        return p;
      },
      partialize: (state) => ({
        appearance:         state.appearance,
        dimAtNight:         state.dimAtNight,
        themeId:            state.themeId,
        borderId:           state.borderId,
        strugglingMode:     state.strugglingMode,
        strugglingDate:     state.strugglingDate,
        disabledGateGames:    state.disabledGateGames,
        enabledCalmGateGames: state.enabledCalmGateGames,
        themeBrightness:    state.themeBrightness,
      }),
    }
  )
);
