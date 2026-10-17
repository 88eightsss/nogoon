// ─── Modes Store ─────────────────────────────────────────────────────────────
//
// "Modes" are saved presets that bundle a blocklist (apps + domains) with a
// few gate-behavior settings (game mode, no-games, waiting-room), optionally
// tied to a schedule so the right one applies itself automatically —
// e.g. a stricter "Work" mode on weekday mornings, a looser "Weekend" mode
// otherwise.
//
// Deliberately NOT included here: isBricked / isColdTurkey (BRICKED / Cold
// Turkey). Those live in useUserStore with a manual 24hr/48hr disable-request
// cooldown specifically so they can't be casually turned off — letting a
// schedule flip them automatically (or letting someone build a "loose" mode
// with isBricked:false as a scheduled backdoor) would defeat that safety
// mechanism entirely. Curfew is kept separate for the same reason: it's a
// simple always-on override layered on top of whichever mode is active, not
// something a mode itself should be able to touch.
//
// Applying a mode writes into useUserStore's EXISTING fields (blockedApps,
// blocklist via addSite/removeSite, gameMode, noGames, preferWaitingRoom) —
// see hooks/useAppBlocker.ts's mode-sync effect — so every other place that
// already reads those fields (gate.tsx, the native bridge, Supabase sync)
// keeps working unchanged; a mode is just a saved way to set them in bulk.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ModeSchedule {
  enabled: boolean;
  // 0 = Sunday .. 6 = Saturday. Empty array = every day.
  days: number[];
  start: string; // 'HH:MM', 24hr
  end:   string; // 'HH:MM', 24hr — may be earlier than start (wraps past midnight)
}

export interface ModePreset {
  id:   string;
  name: string;
  emoji: string;
  color: string;

  blockedApps:    string[]; // package names
  blockedDomains: string[]; // domains

  gameMode:          'random' | 'choose';
  noGames:           boolean;
  preferWaitingRoom: boolean;

  schedule: ModeSchedule;
  createdAt: number;
}

export const DEFAULT_SCHEDULE: ModeSchedule = {
  enabled: false,
  days:    [],
  start:   '09:00',
  end:     '17:00',
};

function newModeId(): string {
  return `mode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pure resolution — no store access, safe to call from anywhere ───────────
// First scheduled mode (in array order) whose day+time window matches "now"
// wins; otherwise the manually-selected activeModeId; otherwise null (meaning
// "no mode active" — the caller should leave blockedApps/blocklist/etc alone).
export function resolveActiveMode(
  modes: ModePreset[],
  activeModeId: string | null,
  now: Date = new Date(),
): ModePreset | null {
  const dow  = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  for (const mode of modes) {
    const s = mode.schedule;
    if (!s?.enabled) continue;
    if (!isWithinWindow(s.start, s.end, mins)) continue;
    // The chosen days are the days a window STARTS on. After midnight in an overnight
    // window (e.g. Fri 22:00 -> Sat 06:00) we are still in Friday's window.
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    const overnight = sh * 60 + sm > eh * 60 + em;
    const startDay = overnight && mins < eh * 60 + em ? (dow + 6) % 7 : dow;
    if (s.days.length > 0 && !s.days.includes(startDay)) continue;
    return mode;
  }

  if (activeModeId) {
    const m = modes.find((m) => m.id === activeModeId);
    if (m) return m;
  }

  return null;
}

function isWithinWindow(startStr: string, endStr: string, nowMins: number): boolean {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  if (startMins === endMins) return false; // zero-length window never matches
  if (startMins < endMins) return nowMins >= startMins && nowMins < endMins;
  return nowMins >= startMins || nowMins < endMins; // overnight wrap
}

interface ModesState {
  modes: ModePreset[];
  // The mode the user manually picked as "current" — used whenever no
  // scheduled mode is currently matching. Null means no mode system in use.
  activeModeId: string | null;

  createMode: (input: {
    name: string;
    emoji?: string;
    color?: string;
    blockedApps?: string[];
    blockedDomains?: string[];
    gameMode?: 'random' | 'choose';
    noGames?: boolean;
    preferWaitingRoom?: boolean;
    schedule?: ModeSchedule;
  }) => string;
  updateMode: (id: string, patch: Partial<Omit<ModePreset, 'id' | 'createdAt'>>) => void;
  deleteMode: (id: string) => void;
  duplicateMode: (id: string) => void;
  setActiveModeId: (id: string | null) => void;

  // Bookkeeping for useNativeSync: which Mode content is currently applied to
  // the live lists, and the user's own lists to restore afterwards.
  appliedKey: string | null;
  baseSnapshot: { apps: string[]; domains: string[] } | null;
  setApplied: (key: string | null, snapshot: { apps: string[]; domains: string[] } | null) => void;
}

export const useModesStore = create<ModesState>()(
  persist(
    (set, get) => ({
      modes: [],
      activeModeId: null,
      appliedKey: null,
      baseSnapshot: null,

      createMode: (input) => {
        const id = newModeId();
        const mode: ModePreset = {
          id,
          name:  input.name.trim() || 'New Mode',
          emoji: input.emoji ?? '🎯',
          color: input.color ?? '#6c8cff',
          blockedApps:       input.blockedApps ?? [],
          blockedDomains:    input.blockedDomains ?? [],
          gameMode:          input.gameMode ?? 'random',
          noGames:           input.noGames ?? false,
          preferWaitingRoom: input.preferWaitingRoom ?? false,
          schedule:          input.schedule ?? DEFAULT_SCHEDULE,
          createdAt: Date.now(),
        };
        set((s) => ({ modes: [...s.modes, mode] }));
        return id;
      },

      updateMode: (id, patch) => set((s) => ({
        modes: s.modes.map((m) =>
          m.id === id
            ? { ...m, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() || m.name } : {}) }
            : m
        ),
      })),

      deleteMode: (id) => set((s) => ({
        modes: s.modes.filter((m) => m.id !== id),
        activeModeId: s.activeModeId === id ? null : s.activeModeId,
      })),

      duplicateMode: (id) => {
        const source = get().modes.find((m) => m.id === id);
        if (!source) return;
        const copy: ModePreset = {
          ...source,
          id: newModeId(),
          name: `${source.name} copy`,
          createdAt: Date.now(),
        };
        set((s) => ({ modes: [...s.modes, copy] }));
      },

      setActiveModeId: (id) => set({ activeModeId: id }),

      setApplied: (key, snapshot) => set({ appliedKey: key, baseSnapshot: snapshot }),
    }),
    {
      name:    'nogoon-modes-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        modes:        state.modes,
        activeModeId: state.activeModeId,
        appliedKey:   state.appliedKey,
        baseSnapshot: state.baseSnapshot,
      }),
    }
  )
);
