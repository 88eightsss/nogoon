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
import { ThemeId, BorderId, DEFAULT_THEME, DEFAULT_BORDER } from '@/constants/Themes';

interface ThemeState {
  themeId: ThemeId;
  borderId: BorderId;
  // Struggling mode — soft flag, resets on new day
  strugglingMode: boolean;
  strugglingDate: string;  // 'YYYY-MM-DD'
  // Gate game opt-outs — IDs in this list won't be picked at intercept
  disabledGateGames: string[];

  // Home screen layout — which sections are visible
  showIntentionCard:  boolean;
  showStruggleToggle: boolean;
  showTimeReclaimed:  boolean;

  setTheme: (id: ThemeId) => void;
  setBorder: (id: BorderId) => void;
  setStruggling: (val: boolean) => void;
  checkResetStruggling: () => void;  // call on app open
  toggleGateGame: (id: string) => void;
  toggleHomeSection: (key: 'showIntentionCard' | 'showStruggleToggle' | 'showTimeReclaimed') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId:           DEFAULT_THEME,
      borderId:          DEFAULT_BORDER,
      strugglingMode:    false,
      strugglingDate:    '',
      disabledGateGames: [],
      showIntentionCard:  true,
      showStruggleToggle: true,
      showTimeReclaimed:  true,

      setTheme:  (id) => set({ themeId: id }),
      setBorder: (id) => set({ borderId: id }),

      setStruggling: (val) => {
        const today = new Date().toISOString().split('T')[0];
        set({ strugglingMode: val, strugglingDate: today });
      },

      checkResetStruggling: () => {
        const { strugglingMode, strugglingDate } = get();
        if (!strugglingMode) return;
        const today = new Date().toISOString().split('T')[0];
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

      toggleHomeSection: (key) => set((s) => ({ [key]: !s[key] })),
    }),
    {
      name:    'nogoon-theme-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeId:            state.themeId,
        borderId:           state.borderId,
        strugglingMode:     state.strugglingMode,
        strugglingDate:     state.strugglingDate,
        disabledGateGames:  state.disabledGateGames,
        showIntentionCard:  state.showIntentionCard,
        showStruggleToggle: state.showStruggleToggle,
        showTimeReclaimed:  state.showTimeReclaimed,
      }),
    }
  )
);
