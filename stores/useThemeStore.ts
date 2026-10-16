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
interface ThemeState {
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
  // Default is 0 so the shipped-default Forest theme keeps its original all-dark look.
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
      themeId:           DEFAULT_THEME,
      borderId:          DEFAULT_BORDER,
      strugglingMode:    false,
      strugglingDate:    '',
      disabledGateGames: [],
      enabledCalmGateGames: [],
      themeBrightness:    0,

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
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (version < 1 && persisted?.themeBrightness === 50) {
          return { ...persisted, themeBrightness: 0 };
        }
        return persisted;
      },
      partialize: (state) => ({
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
