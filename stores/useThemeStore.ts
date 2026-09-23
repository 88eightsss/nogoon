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
import {
  HomeLayout, BubbleConfig, BubbleSize, WidgetId,
  DEFAULT_LAYOUT, newBubbleId, WIDGET_CATALOG,
} from '@/constants/HomeLayout';

// Which home screen a user sees — 'companion' is the mascot-first screen
// (default), 'organizer' is the customizable bubble/widget grid for people
// who'd rather not have a pet front and center.
export type HomeMode = 'companion' | 'organizer';

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

  // Home screen layout — which sections are visible
  showIntentionCard:  boolean;
  showStruggleToggle: boolean;
  showTimeReclaimed:  boolean;

  // Which home screen mode is active
  homeMode: HomeMode;

  // Bubble home layout
  homeLayout: HomeLayout;

  // Brightness dial — 0 = Dark, 50 = Grey, 100 = Light (see constants/Themes.ts).
  // Default is 0 so the shipped-default Forest theme keeps its original all-dark look.
  themeBrightness: number;

  setTheme: (id: ThemeId) => void;
  setBorder: (id: BorderId) => void;
  setStruggling: (val: boolean) => void;
  checkResetStruggling: () => void;  // call on app open
  toggleGateGame: (id: string) => void;
  toggleCalmGateGame: (id: string) => void;
  toggleHomeSection: (key: 'showIntentionCard' | 'showStruggleToggle' | 'showTimeReclaimed') => void;
  setHomeMode: (mode: HomeMode) => void;

  // Bubble layout actions
  setHomeLayout:      (layout: HomeLayout) => void;
  updateBubble:       (id: string, changes: Partial<Pick<BubbleConfig, 'widgetId' | 'size'>>) => void;
  addBubble:          (widgetId: WidgetId, size?: BubbleSize) => void;
  removeBubble:       (id: string) => void;
  moveBubble:         (id: string, direction: 'up' | 'down') => void;

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
      showIntentionCard:  true,
      showStruggleToggle: true,
      showTimeReclaimed:  true,
      homeMode:           'companion',
      homeLayout:         DEFAULT_LAYOUT,
      themeBrightness:    0,

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

      toggleCalmGateGame: (id) => {
        const { enabledCalmGateGames } = get();
        const next = enabledCalmGateGames.includes(id)
          ? enabledCalmGateGames.filter((g) => g !== id)
          : [...enabledCalmGateGames, id];
        set({ enabledCalmGateGames: next });
      },

      toggleHomeSection: (key) => set((s) => ({ [key]: !s[key] })),

      setHomeMode: (mode) => set({ homeMode: mode }),

      setHomeLayout: (layout) => set({ homeLayout: layout }),

      updateBubble: (id, changes) => set((s) => ({
        homeLayout: {
          ...s.homeLayout,
          templateId: 'custom',
          bubbles: s.homeLayout.bubbles.map((b) =>
            b.id === id ? { ...b, ...changes } : b
          ),
        },
      })),

      addBubble: (widgetId, size) => {
        const meta = WIDGET_CATALOG.find((w) => w.id === widgetId)!;
        const bubble: BubbleConfig = {
          id: newBubbleId(),
          widgetId,
          size: size ?? meta.defaultSize,
        };
        set((s) => ({
          homeLayout: {
            ...s.homeLayout,
            templateId: 'custom',
            bubbles: [...s.homeLayout.bubbles, bubble],
          },
        }));
      },

      removeBubble: (id) => set((s) => ({
        homeLayout: {
          ...s.homeLayout,
          templateId: 'custom',
          bubbles: s.homeLayout.bubbles.filter((b) => b.id !== id),
        },
      })),

      moveBubble: (id, direction) => set((s) => {
        const bubbles = [...s.homeLayout.bubbles];
        const idx = bubbles.findIndex((b) => b.id === id);
        if (idx < 0) return s;
        const next = direction === 'up' ? idx - 1 : idx + 1;
        if (next < 0 || next >= bubbles.length) return s;
        [bubbles[idx], bubbles[next]] = [bubbles[next], bubbles[idx]];
        return { homeLayout: { ...s.homeLayout, templateId: 'custom', bubbles } };
      }),

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
        showIntentionCard:  state.showIntentionCard,
        showStruggleToggle: state.showStruggleToggle,
        showTimeReclaimed:  state.showTimeReclaimed,
        homeMode:           state.homeMode,
        homeLayout:         state.homeLayout,
        themeBrightness:    state.themeBrightness,
      }),
    }
  )
);
