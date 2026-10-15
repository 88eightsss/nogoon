// ─── Pack Store ───────────────────────────────────────────────────────────────
//
// Which skin (pack) is active, which hidden packs the user has unlocked, whether
// the new My Page is switched on, and the personal note shown at the gate.
// Non-sensitive UI preference, persisted to AsyncStorage like useThemeStore.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PACKS, getPack, findPackByCode, packsUnlockedByStreak, packUnlockedByTap,
  type PackManifest,
} from '@/constants/packs';

export type GateVoice = 'gentle' | 'hype' | 'dry';
export const GATE_NOTE_MAX = 140;

export type FloatMode = 'auto' | 'on' | 'off';          // auto = floating only for 'corner' skins
export type CompanionSize = 'sm' | 'md' | 'lg';
export type PaperChoice = 'auto' | 'none' | 'ruled' | 'grid' | 'dots';
export type CompanionPos = { x: number; y: number };    // 0..1 within the usable screen area
export const DEFAULT_COMPANION_POS: CompanionPos = { x: 0.85, y: 0.82 };

interface PackState {
  activePackId: string;
  unlockedIds:  string[];       // hidden packs the user has opened
  seenUnlockIds: string[];      // unlocks the user has already been told about
  newHome:      boolean;        // new My Page + 4-tab layout (on by default, can be switched off)
  styleCardDismissed: boolean;  // the "make this page yours" card on My Page
  gateNote:     string;         // personal note shown on the gate
  gateVoice:    GateVoice;
  floatMode:    FloatMode;
  companionSize: CompanionSize;
  companionSnap: boolean;
  companionPos: CompanionPos;
  accentOverride: string;       // '' = use the skin's own accent
  paperOverride: PaperChoice;

  setActivePack: (id: string) => void;
  unlockPack:    (id: string) => void;
  redeemCode:    (code: string) => PackManifest | null;
  checkStreakUnlocks: (longestStreak: number) => PackManifest[];  // returns newly unlocked
  tapUnlock:     () => PackManifest | null;
  markUnlockSeen: (id: string) => void;
  setNewHome:    (on: boolean) => void;
  dismissStyleCard: () => void;
  showWorldNews: boolean;       // opt-in: major-news section in the Briefing (off by default)
  setShowWorldNews: (v: boolean) => void;
  setGateNote:   (text: string) => void;
  setGateVoice:  (v: GateVoice) => void;
  setFloatMode:  (m: FloatMode) => void;
  setCompanionSize: (s: CompanionSize) => void;
  setCompanionSnap: (on: boolean) => void;
  setCompanionPos: (p: CompanionPos) => void;
  setAccentOverride: (hex: string) => void;
  setPaperOverride: (p: PaperChoice) => void;
}

export const usePackStore = create<PackState>()(
  persist(
    (set, get) => ({
      activePackId: 'core',
      unlockedIds: [],
      seenUnlockIds: [],
      newHome: true,
      styleCardDismissed: false,
      gateNote: '',
      gateVoice: 'gentle',
      floatMode: 'auto',
      companionSize: 'md',
      companionSnap: true,
      companionPos: DEFAULT_COMPANION_POS,
      accentOverride: '',
      paperOverride: 'auto',

      setActivePack: (id) => {
        const p = PACKS.find((x) => x.id === id);
        if (!p) return;
        if (p.hidden && !get().unlockedIds.includes(id)) return;
        set({ activePackId: id });
      },

      unlockPack: (id) => {
        if (!PACKS.some((p) => p.id === id)) return;
        set((s) => (s.unlockedIds.includes(id) ? s : { unlockedIds: [...s.unlockedIds, id] }));
      },

      redeemCode: (code) => {
        const p = findPackByCode(code);
        if (!p) return null;
        get().unlockPack(p.id);
        return p;
      },

      checkStreakUnlocks: (longestStreak) => {
        const have = get().unlockedIds;
        const fresh = packsUnlockedByStreak(longestStreak).filter((p) => !have.includes(p.id));
        if (fresh.length) set({ unlockedIds: [...have, ...fresh.map((p) => p.id)] });
        return fresh;
      },

      tapUnlock: () => {
        const have = get().unlockedIds;
        const fresh = packUnlockedByTap().filter((p) => !have.includes(p.id));
        if (!fresh.length) return null;
        set({ unlockedIds: [...have, ...fresh.map((p) => p.id)] });
        return fresh[0];
      },

      markUnlockSeen: (id) => set((s) => (s.seenUnlockIds.includes(id) ? s : { seenUnlockIds: [...s.seenUnlockIds, id] })),
      setNewHome: (on) => set({ newHome: on }),
      dismissStyleCard: () => set({ styleCardDismissed: true }),
      showWorldNews: false,
      setShowWorldNews: (v) => set({ showWorldNews: v }),
      setGateNote: (text) => set({ gateNote: text.slice(0, GATE_NOTE_MAX) }),
      setGateVoice: (v) => set({ gateVoice: v }),
      setFloatMode: (m) => set({ floatMode: m }),
      setCompanionSize: (s) => set({ companionSize: s }),
      setCompanionSnap: (on) => set({ companionSnap: on }),
      setCompanionPos: (p) => set({ companionPos: { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) } }),
      setAccentOverride: (hex) => set({ accentOverride: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '' }),
      setPaperOverride: (p) => set({ paperOverride: p }),
    }),
    {
      name: 'nogoon-pack-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({
        activePackId: s.activePackId,
        unlockedIds: s.unlockedIds,
        seenUnlockIds: s.seenUnlockIds,
        newHome: s.newHome,
        styleCardDismissed: s.styleCardDismissed,
        showWorldNews: s.showWorldNews,
        gateNote: s.gateNote,
        gateVoice: s.gateVoice,
        floatMode: s.floatMode,
        companionSize: s.companionSize,
        companionSnap: s.companionSnap,
        companionPos: s.companionPos,
        accentOverride: s.accentOverride,
        paperOverride: s.paperOverride,
      }),
    }
  )
);

export { getPack };
