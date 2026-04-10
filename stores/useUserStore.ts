// ─── User Store ───────────────────────────────────────────────────────────────
//
// Global user state powered by Zustand with persist middleware.
//
// "Persist" means the data is automatically saved to the device's secure storage
// every time it changes, and loaded back on the next app launch. So points,
// streak, and XP survive closing the app.
//
// Data also syncs to Supabase (cloud) so it's backed up and available
// across devices when the user logs in from a new phone.
//
// Usage in any component:
//   const { points, addPoints } = useUserStore()

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

// ─── XP Level system ──────────────────────────────────────────────────────────
// As users earn XP by completing games, they move up through these levels.
export type XPLevel = 'Rookie' | 'Explorer' | 'Guardian' | 'Sentinel' | 'Legend';

const LEVEL_THRESHOLDS: Record<XPLevel, number> = {
  Rookie:   0,
  Explorer: 500,
  Guardian: 1500,
  Sentinel: 3500,
  Legend:   7000,
};

const LEVEL_ORDER: XPLevel[] = ['Rookie', 'Explorer', 'Guardian', 'Sentinel', 'Legend'];

// Returns progress info for the XP bar on the profile/home screen
export function getLevelProgress(xp: number): {
  label: XPLevel;
  nextLabel: XPLevel | null;
  currentThreshold: number;
  nextThreshold: number | null;
  percent: number;
} {
  let currentIndex = 0;
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[LEVEL_ORDER[i]]) {
      currentIndex = i;
      break;
    }
  }

  const label = LEVEL_ORDER[currentIndex];
  const nextLabel = currentIndex < LEVEL_ORDER.length - 1
    ? LEVEL_ORDER[currentIndex + 1]
    : null;

  const currentThreshold = LEVEL_THRESHOLDS[label];
  const nextThreshold = nextLabel ? LEVEL_THRESHOLDS[nextLabel] : null;

  const percent = nextThreshold
    ? (xp - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  return { label, nextLabel, currentThreshold, nextThreshold, percent };
}

// ─── Helper: Build 7-day date range ──────────────────────────────────────────
// Returns an array of 7 date strings (YYYY-MM-DD), oldest first.
// Index 0 = 6 days ago, Index 6 = today.
// This matches the WeeklyChart component's data format.

function getLast7Days(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0]; // e.g. "2025-01-15"
  });
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface UserState {
  // Identity
  name: string;
  hasOnboarded: boolean;

  // Streak — consecutive days the user has used GATE
  streak: number;
  longestStreak: number;

  // Points — spendable currency (earn from games, spend to unlock a site)
  points: number;

  // XP — never spent, only increases, determines level
  xp: number;
  level: XPLevel;

  // Total lifetime games played (shown on profile)
  gamesPlayed: number;

  // Weekly activity chart (last 7 days, index 0 = 6 days ago, index 6 = today)
  weeklyActivity: [number, number, number, number, number, number, number];

  dailyChallengeCompleted: boolean;

  // Website blocklist — array of domains the user has blocked
  blocklist: string[];

  // App blocklist — array of Android package names (e.g. 'com.instagram.android')
  blockedApps: string[];

  // Game mode — 'random' launches a game immediately on intercept,
  // 'choose' shows the picker so the user selects which game to play
  gameMode: 'random' | 'choose';

  // ── BRICKED mode ("Hard Mode") ─────────────────────────────────────────────
  // When active, the unlock button is completely removed from the post-game
  // screen. The only way out is to walk away. Disabling requires a 24hr wait.
  isBricked: boolean;
  brickedEnabledAt: number | null;           // timestamp (ms) when BRICKED was turned on
  brickedDisableRequestedAt: number | null;  // timestamp when user requested to turn it OFF

  // ── Game duration (Pro only) ───────────────────────────────────────────────
  // Longer games = stronger pattern interruption = more likely to walk away
  gameDuration: 30 | 60 | 90;

  // ── Streak protection (Pro only) ───────────────────────────────────────────
  // One free streak restore per calendar month — Pro only
  streakRestoresLeft: number;
  streakRestoreMonth: string; // 'YYYY-MM' — tracks which month restores were last granted

  // ── Accountability partner (Pro+ only) ─────────────────────────────────────
  partnerEmail: string;
  partnerName: string;
  partnerNotifyOnUnlock: boolean;   // send email when user unlocks a site
  partnerNotifyOnBypass: boolean;   // send email when user dismisses without playing

  // ── Block schedule (Pro only) ──────────────────────────────────────────────
  // Define time windows when blocking is active
  blockScheduleEnabled: boolean;
  blockScheduleStart: string;  // e.g. '22:00'
  blockScheduleEnd: string;    // e.g. '08:00'

  // ── Impulse journal ────────────────────────────────────────────────────────
  // User writes what triggered them before each game — builds self-awareness
  journalEntries: Array<{
    id: string;
    text: string;
    domain: string;
    timestamp: number;
  }>;

  // ── Actions ──
  setName: (name: string) => void;
  completeOnboarding: () => void;
  addPoints: (amount: number) => void;
  addXP: (amount: number) => void;
  spendPoints: (amount: number) => boolean;
  incrementStreak: () => void;
  resetStreak: () => void;
  recordGamePlayed: (score?: number, gameId?: string) => void;
  completeDailyChallenge: () => void;

  // Website blocklist actions
  addSite: (domain: string) => void;
  removeSite: (domain: string) => void;

  // App blocklist actions
  setBlockedApps: (packages: string[]) => void;

  // Game mode toggle
  setGameMode: (mode: 'random' | 'choose') => void;

  // BRICKED actions
  enableBricked: () => void;
  requestDisableBricked: () => void;  // starts 24hr countdown
  confirmDisableBricked: () => void;  // called after 24hrs have passed

  // Game duration
  setGameDuration: (duration: 30 | 60 | 90) => void;

  // Streak protection
  useStreakRestore: () => boolean; // returns false if no restores left
  refreshStreakRestores: () => void; // call on app open to reset monthly

  // Partner
  setPartner: (email: string, name: string) => void;
  setPartnerNotifications: (onUnlock: boolean, onBypass: boolean) => void;

  // Schedule
  setBlockSchedule: (enabled: boolean, start: string, end: string) => void;

  // Journal
  addJournalEntry: (text: string, domain: string) => void;
  clearOldJournalEntries: () => void; // keeps last 90 entries

  // The point cost to permanently remove a site from the blocklist.
  // Pro users get this for free. Free users pay REMOVE_COST points.
  REMOVE_COST: number;

  // Supabase sync — loads cloud data into local store after login
  loadFromSupabase: (userId: string) => Promise<void>;

  // Supabase sync — pushes local changes up to cloud
  syncToSupabase: (userId: string) => Promise<void>;

  // Resets ALL local data — called on sign out so the next user starts fresh
  resetStore: () => void;
}

// ─── SecureStore adapter for Zustand persist ──────────────────────────────────
// Zustand's persist middleware needs a storage backend.
// We use expo-secure-store so the saved data is encrypted on the device.

const secureStorage = createJSONStorage(() => ({
  getItem: async (key: string) => {
    const value = await SecureStore.getItemAsync(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
}));

// ─── Default state ────────────────────────────────────────────────────────────
// Extracted so resetStore() can return to exactly this state.

// How many points it costs a free user to permanently remove a site.
// Pro users always pay 0 — this is checked in the UI, not here.
const REMOVE_COST = 75;

const DEFAULT_STATE = {
  name: '',
  hasOnboarded: false,
  streak: 0,
  longestStreak: 0,
  points: 0,
  xp: 0,
  level: 'Rookie' as XPLevel,
  gamesPlayed: 0,
  weeklyActivity: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number],
  dailyChallengeCompleted: false,
  blocklist: [] as string[],
  blockedApps: [] as string[],
  gameMode: 'random' as 'random' | 'choose', // Default: skip picker, jump straight into a game
  // BRICKED
  isBricked: false,
  brickedEnabledAt: null as number | null,
  brickedDisableRequestedAt: null as number | null,
  // Game duration
  gameDuration: 30 as 30 | 60 | 90,
  // Streak protection
  streakRestoresLeft: 0,
  streakRestoreMonth: '',
  // Partner
  partnerEmail: '',
  partnerName: '',
  partnerNotifyOnUnlock: true,
  partnerNotifyOnBypass: false,
  // Schedule
  blockScheduleEnabled: false,
  blockScheduleStart: '22:00',
  blockScheduleEnd: '08:00',
  // Journal
  journalEntries: [] as Array<{ id: string; text: string; domain: string; timestamp: number }>,
};

// ─── The store ────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      // These start at zero/empty. After first login, loadFromSupabase()
      // replaces them with the user's real data from the cloud.
      ...DEFAULT_STATE,

      // ── Actions ──────────────────────────────────────────────────────────

      setName: (name) => set({ name }),

      completeOnboarding: () => set({ hasOnboarded: true }),

      addPoints: (amount) => set((state) => ({ points: state.points + amount })),

      addXP: (amount) => {
        const newXP = get().xp + amount;
        const { label } = getLevelProgress(newXP);
        set({ xp: newXP, level: label });
      },

      spendPoints: (amount) => {
        const { points } = get();
        if (points < amount) return false;
        set({ points: points - amount });
        return true;
      },

      incrementStreak: () => set((state) => ({
        streak: state.streak + 1,
        longestStreak: Math.max(state.longestStreak, state.streak + 1),
      })),

      resetStreak: () => set({ streak: 0 }),

      // ── recordGamePlayed ─────────────────────────────────────────────────
      // Called when a user completes any game (from post-game.tsx).
      // 1. Increments today's bar in the weekly chart
      // 2. Increments the lifetime games counter
      // 3. Writes a row to the game_sessions table in Supabase

      recordGamePlayed: (score = 0, gameId = 'unknown') => {
        set((state) => {
          const updated = [...state.weeklyActivity] as typeof state.weeklyActivity;
          updated[6] = updated[6] + 1; // Index 6 = today
          return {
            weeklyActivity: updated,
            gamesPlayed: state.gamesPlayed + 1,
          };
        });

        // Write to Supabase in the background (non-blocking)
        // This is what powers the weekly chart on the next app load
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) {
            supabase.from('game_sessions').insert({
              user_id: data.user.id,
              score,
              game_id: gameId,
              // played_at defaults to CURRENT_DATE in the database
            });
          }
        });
      },

      completeDailyChallenge: () => set({ dailyChallengeCompleted: true }),

      // ── Website Blocklist ─────────────────────────────────────────────────

      addSite: (domain) => {
        const cleaned = domain
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .replace(/\/.*$/, '')
          .toLowerCase()
          .trim();

        if (!cleaned) return;

        const { blocklist } = get();
        if (blocklist.includes(cleaned)) return;

        set({ blocklist: [...blocklist, cleaned] });

        // Sync to Supabase in the background
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) {
            supabase.from('blocklist').insert({
              user_id: data.user.id,
              domain: cleaned,
            });
          }
        });
      },

      // ── removeSite ────────────────────────────────────────────────────────
      // Free users pay REMOVE_COST points to permanently delete a site.
      // Returns true if removal succeeded, false if not enough points.
      // The UI checks `isPro` from useSubscriptionStore before calling this —
      // Pro users bypass the cost entirely by calling removeSite directly.

      removeSite: (domain) => {
        set((state) => ({
          blocklist: state.blocklist.filter((d) => d !== domain),
        }));

        supabase.auth.getUser().then(({ data }) => {
          if (data.user) {
            supabase
              .from('blocklist')
              .delete()
              .eq('user_id', data.user.id)
              .eq('domain', domain);
          }
        });
      },

      // ── App Blocklist ──────────────────────────────────────────────────────

      setBlockedApps: (packages) => {
        set({ blockedApps: packages });
      },

      // ── Game mode ──────────────────────────────────────────────────────────

      setGameMode: (mode) => set({ gameMode: mode }),

      // ── BRICKED mode ────────────────────────────────────────────────────────

      enableBricked: () => set({
        isBricked: true,
        brickedEnabledAt: Date.now(),
        brickedDisableRequestedAt: null,
      }),

      // User taps "Disable BRICKED" — starts the 24hr safety countdown.
      // They can't immediately turn it off — that would defeat the purpose.
      requestDisableBricked: () => set({
        brickedDisableRequestedAt: Date.now(),
      }),

      // Called after the 24hr cooldown has expired.
      confirmDisableBricked: () => set({
        isBricked: false,
        brickedEnabledAt: null,
        brickedDisableRequestedAt: null,
      }),

      // ── Game duration ────────────────────────────────────────────────────────

      setGameDuration: (duration) => set({ gameDuration: duration }),

      // ── Streak protection ────────────────────────────────────────────────────

      // Returns true if successfully used a restore, false if none left.
      useStreakRestore: () => {
        const { streakRestoresLeft } = get();
        if (streakRestoresLeft <= 0) return false;
        set({ streakRestoresLeft: streakRestoresLeft - 1 });
        return true;
      },

      // Call on every app open — resets restores to 1 at the start of each month.
      refreshStreakRestores: () => {
        const thisMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
        const { streakRestoreMonth } = get();
        if (streakRestoreMonth !== thisMonth) {
          set({ streakRestoresLeft: 1, streakRestoreMonth: thisMonth });
        }
      },

      // ── Partner ──────────────────────────────────────────────────────────────

      setPartner: (email, name) => set({ partnerEmail: email, partnerName: name }),

      setPartnerNotifications: (onUnlock, onBypass) => set({
        partnerNotifyOnUnlock: onUnlock,
        partnerNotifyOnBypass: onBypass,
      }),

      // ── Block schedule ───────────────────────────────────────────────────────

      setBlockSchedule: (enabled, start, end) => set({
        blockScheduleEnabled: enabled,
        blockScheduleStart: start,
        blockScheduleEnd: end,
      }),

      // ── Impulse journal ──────────────────────────────────────────────────────

      addJournalEntry: (text, domain) => {
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text,
          domain,
          timestamp: Date.now(),
        };
        set((state) => ({
          journalEntries: [entry, ...state.journalEntries].slice(0, 90),
        }));
        // Sync to Supabase in background
        supabase.auth.getUser().then(({ data }) => {
          if (data.user && text.trim()) {
            supabase.from('journal_entries').insert({
              user_id: data.user.id,
              text,
              domain,
            });
          }
        });
      },

      clearOldJournalEntries: () => set((state) => ({
        journalEntries: state.journalEntries.slice(0, 90),
      })),

      // Expose the constant so UI can read it without a separate import
      REMOVE_COST,

      // ── Supabase sync ─────────────────────────────────────────────────────

      // Called after login — fetches the user's data from Supabase and
      // updates the local store so the UI shows real numbers, not zeros.
      loadFromSupabase: async (userId) => {
        // Build the date range for the last 7 days
        const days = getLast7Days(); // ['2025-01-09', ..., '2025-01-15']

        const [profileResult, blocklistResult, sessionsResult] = await Promise.all([
          // Fetch the user's main profile stats
          supabase.from('profiles').select('*').eq('id', userId).single(),

          // Fetch all blocked websites
          supabase.from('blocklist').select('domain').eq('user_id', userId),

          // Fetch game sessions from the last 7 days for the weekly chart
          supabase
            .from('game_sessions')
            .select('played_at')
            .eq('user_id', userId)
            .gte('played_at', days[0]) // Greater than or equal to 6 days ago
            .lte('played_at', days[6]), // Less than or equal to today
        ]);

        // ── Profile data ──
        if (profileResult.data) {
          const p = profileResult.data;
          const { label } = getLevelProgress(p.xp ?? 0);
          set({
            name:          p.name          ?? '',
            points:        p.points        ?? 0,
            xp:            p.xp            ?? 0,
            level:         label,
            streak:        p.streak        ?? 0,
            longestStreak: p.longest_streak ?? 0,
            gamesPlayed:   p.games_played  ?? 0,
            hasOnboarded:  true,
          });
        }

        // ── Blocklist ──
        if (blocklistResult.data) {
          set({ blocklist: blocklistResult.data.map((r: any) => r.domain) });
        }

        // ── Weekly chart ──
        // Build the 7-element array from the sessions data.
        // Count how many sessions were recorded on each of the last 7 days.
        if (sessionsResult.data) {
          const activityMap: Record<string, number> = {};
          for (const session of sessionsResult.data) {
            const dateKey = session.played_at as string;
            activityMap[dateKey] = (activityMap[dateKey] ?? 0) + 1;
          }

          // Map each day in our 7-day window to its count (0 if no sessions)
          const weeklyActivity = days.map((d) => activityMap[d] ?? 0) as
            [number, number, number, number, number, number, number];

          set({ weeklyActivity });
        }
      },

      // Called after key actions (game complete, walk away, unlock) —
      // pushes the current local state up to Supabase
      syncToSupabase: async (userId) => {
        const { points, xp, streak, longestStreak, name, gamesPlayed } = get();
        await supabase.from('profiles').upsert({
          id: userId,
          name,
          points,
          xp,
          streak,
          longest_streak: longestStreak,
          games_played: gamesPlayed,
        });
      },

      // ── resetStore ────────────────────────────────────────────────────────
      // Wipes all local user data back to defaults.
      // Called on sign out so the next person who logs in starts fresh.
      // The persist middleware automatically clears SecureStore as part
      // of the state reset.

      resetStore: () => {
        set(DEFAULT_STATE);
      },
    }),

    // ── Persist config ────────────────────────────────────────────────────
    {
      name: 'nogoon-user-store',    // Key used in SecureStore
      storage: secureStorage,

      // Only persist the data fields, not the async action functions
      partialize: (state) => ({
        name:                   state.name,
        hasOnboarded:           state.hasOnboarded,
        streak:                 state.streak,
        longestStreak:          state.longestStreak,
        points:                 state.points,
        xp:                     state.xp,
        level:                  state.level,
        gamesPlayed:            state.gamesPlayed,
        weeklyActivity:         state.weeklyActivity,
        dailyChallengeCompleted: state.dailyChallengeCompleted,
        blocklist:               state.blocklist,
        blockedApps:             state.blockedApps,
        gameMode:                state.gameMode,
        isBricked:               state.isBricked,
        brickedEnabledAt:        state.brickedEnabledAt,
        brickedDisableRequestedAt: state.brickedDisableRequestedAt,
        gameDuration:            state.gameDuration,
        streakRestoresLeft:      state.streakRestoresLeft,
        streakRestoreMonth:      state.streakRestoreMonth,
        partnerEmail:            state.partnerEmail,
        partnerName:             state.partnerName,
        partnerNotifyOnUnlock:   state.partnerNotifyOnUnlock,
        partnerNotifyOnBypass:   state.partnerNotifyOnBypass,
        blockScheduleEnabled:    state.blockScheduleEnabled,
        blockScheduleStart:      state.blockScheduleStart,
        blockScheduleEnd:        state.blockScheduleEnd,
        journalEntries:          state.journalEntries,
      }),
    }
  )
);
