// ─── User Store ─────────────────────────────────────────────────────────────── //
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
//     const { points, addPoints } = useUserStore()

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { maybeNotifyStreak, maybeNotifyWalkAway, scheduleDailySummary } from '@/utils/notifications';
import { useModesStore } from '@/stores/useModesStore';
import { getLocalDateKey, getLocalMonthKey, localDateKeyDiffDays, parseLocalDateKey } from '@/utils/date';

// Fire-and-forget helper: writes focusSessionEnd to SharedPreferences so the
// Kotlin Accessibility Service can honour focus session hard-locks even when the
// QS tile pause is active.  0 = no active session.
function syncFocusSessionToNative(endMs: number): void {
  if (Platform.OS === 'android' && NativeModules.AppBlocker) {
    NativeModules.AppBlocker.setFocusSessionEnd(endMs).catch(() => {});
  }
}

// ─── Background Write Helper ────────────────────────────────────────────────── //
// Wraps all fire-and-forget Supabase writes so failures are logged instead of
// silently swallowed. Pass a label for clearer console output.

async function backgroundWrite(
  label: string,
  writeFn: () => PromiseLike<{ error: any }>
): Promise<boolean> {
  try {
    const { error } = await writeFn();
    if (error) {
      console.error(`[NoGoon] ${label} failed:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[NoGoon] ${label} threw:`, err);
    return false;
  }
}

// The signed-in user, read from the locally stored session. supabase.auth.getUser()
// makes a network round trip, so offline it returned nothing and the write below was
// silently skipped; the saved session needs no network.
async function getCachedUser() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

// ─── Email validation helper ────────────────────────────────────────────────── //
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ─── XP Level system ────────────────────────────────────────────────────────── //
// As users earn XP by completing games, they move up through these levels.

export type XPLevel = 'Rookie' | 'Explorer' | 'Guardian' | 'Sentinel' | 'Legend';

const LEVEL_THRESHOLDS: Record<XPLevel, number> = {
  Rookie: 0,
  Explorer: 500,
  Guardian: 1500,
  Sentinel: 3500,
  Legend: 7000,
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
  const nextLabel =
    currentIndex < LEVEL_ORDER.length - 1
      ? LEVEL_ORDER[currentIndex + 1]
      : null;
  const currentThreshold = LEVEL_THRESHOLDS[label];
  const nextThreshold = nextLabel ? LEVEL_THRESHOLDS[nextLabel] : null;
  const percent = nextThreshold
    ? (xp - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  return { label, nextLabel, currentThreshold, nextThreshold, percent };
}

// ─── Helper: Build 7-day date range ────────────────────────────────────────── //
// Returns an array of 7 date strings (YYYY-MM-DD), oldest first.
// Index 0 = 6 days ago, Index 6 = today.
// This matches the WeeklyChart component's data format.
function getLast7Days(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return getLocalDateKey(d); // e.g. "2025-01-15", device-local calendar day
  });
}

// ─── Store shape ──────────────────────────────────────────────────────────────
interface UserState {
  // Identity
  name: string;
  hasOnboarded: boolean;

  // Streak — consecutive days the user has used NoGoon
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
  // Sites removed while the cloud delete hasn't gone through (e.g. offline). Retried on
  // the next launch and kept out of the cloud merge so they don't come back.
  pendingSiteDeletes: string[];

  // Game mode — 'random' (default) or 'choose' (user picks the game).
  gameMode: 'random' | 'choose';

  // No-Games mode — when true, the gate skips the game entirely.
  // The calm + intent screens still fire, but instead of a game the user
  // just sees an exit screen and can close the app themselves.
  noGames: boolean;

  // ── Open-count tracking ────────────────────────────────────────────────────
  // How many times the user has hit the gate for each domain today.
  // Shown on the gate calm screen as a reality check ("8 times today").
  openCounts: Record<string, number>; // domain → count
  openCountDate: string;              // 'YYYY-MM-DD' — reset when date changes

  // ── Daily intention ────────────────────────────────────────────────────────
  // One sentence the user sets in the morning. Shown on the gate calm screen
  // as a reminder of their own stated goal.
  dailyIntention: string;
  intentionDate: string; // 'YYYY-MM-DD' — when it was set

  // ── Nightly pre-commitment ritual ──────────────────────────────────────────
  // Set in the evening. Surfaces on the gate calm screen the NEXT day as a
  // banner — "Last night you set a rule: [text]".
  nightlyCommitment: string;
  nightlyCommitmentSetAt: number; // timestamp (ms) when it was set — 0 if not set

  // ── Wind-down mode ─────────────────────────────────────────────────────────
  // After windDownHour, gate uses a softer tone and defaults game to breathing.
  windDownEnabled: boolean;
  windDownHour: number; // 0–23, default 21 (9pm)

  // ── BRICKED mode ("Hard Mode") ─────────────────────────────────────────────
  // When active, the unlock button is completely removed from the post-game
  // screen. The only way out is to walk away. Disabling requires a 24hr wait.
  isBricked: boolean;
  brickedEnabledAt: number | null;          // timestamp (ms) when BRICKED was turned on
  brickedDisableRequestedAt: number | null; // timestamp when user requested to turn it OFF

  // ── Cold Turkey mode ("Nuclear Option") ────────────────────────────────────
  // Harder than BRICKED: NO unlock path at all — not even spending points.
  // Re-enabling requires 48hr wait + typing the confirmation phrase exactly.
  isColdTurkey: boolean;
  coldTurkeyEnabledAt: number | null;
  coldTurkeyDisableRequestedAt: number | null;

  // ── Digital curfew ("Sleep Mode") ─────────────────────────────────────────
  // Recurring hard block window — like Cold Turkey but time-based.
  // During curfew: gate fires but has zero unlock path (no game, no points).
  // Handles overnight ranges (e.g. 22:00 → 07:00).
  curfewEnabled: boolean;
  curfewStart: string; // e.g. '22:00'
  curfewEnd: string;   // e.g. '07:00'

  // ── Game duration (Pro only) ───────────────────────────────────────────────
  // Longer games = stronger pattern interruption = more likely to walk away
  gameDuration: 30 | 60 | 90;

  // ── Streak protection (Pro only) ───────────────────────────────────────────
  // One free streak restore per calendar month — Pro only
  streakRestoresLeft: number;
  streakRestoreMonth: string; // 'YYYY-MM' — tracks which month restores were last granted

  // ── Streak freeze tokens (earned, not Pro) ─────────────────────────────────
  // Awarded at each 5-walk-away milestone. Auto-consumed if user misses a day.
  // Unlike Pro streak restores, these are earned through consistent behaviour.
  streakFreezeTokens: number;
  lastStreakDate: string; // 'YYYY-MM-DD' of last streak increment — gap detection
  lastGiveInDate: string; // 'YYYY-MM-DD' of the last time the user unlocked a blocked app

  // ── Accountability partner (Pro+ only) ─────────────────────────────────────
  partnerEmail: string;
  partnerName: string;
  partnerNotifyOnUnlock: boolean;  // send email when user unlocks a site
  partnerNotifyOnBypass: boolean;  // send email when user dismisses without playing

  // ── Block schedule (Pro only) ──────────────────────────────────────────────
  // Define time windows when blocking is active
  blockScheduleEnabled: boolean;
  blockScheduleStart: string;  // e.g. '22:00'
  blockScheduleEnd: string;    // e.g. '08:00'
  blockScheduleDays: number[];    // 0=Sun…6=Sat; empty = all days

  // ── Focus session ──────────────────────────────────────────────────────────
  // Timed hard lock: no game bypass for the session duration.
  // focusSessionEnd is a Unix ms timestamp; null means no active session.
  focusSessionEnd: number | null;

  // ── Trigger tagging ────────────────────────────────────────────────────────
  // Quick-tap on post-game to tag what pulled the user in.
  // Totals accumulate so users can spot their own patterns.
  triggerCounts: Record<string, number>; // e.g. { bored: 12, stressed: 4 }

  // ── Post-walk-away reflection ──────────────────────────────────────────────
  // What the user was feeling when they walked away. One tap after celebration.
  // Used on the Insights screen to show emotional patterns over time.
  reflectionCounts: Record<string, number>; // e.g. { bored: 8, anxious: 3 }

  // ── Walk-away daily activity (7-day) ──────────────────────────────────────
  // Mirrors weeklyActivity but counts walk-aways (not games played).
  // Index 0 = 6 days ago, index 6 = today. Used on Insights screen.
  walkAwayActivity: [number, number, number, number, number, number, number];

  // ── Hourly open counts ────────────────────────────────────────────────────
  // Lifetime tally of which hours the gate has fired — 24 elements (0–23).
  // Never resets: shows the user's chronic peak-urge window over time.
  hourlyOpenCounts: number[];

  // ── Walk-away count ────────────────────────────────────────────────────────
  // How many times the user played a gate game and then chose NOT to unlock.
  // This is the real success metric — the app working as intended.
  // Shown on the home screen as encouragement, never as pressure.
  walkAwayCount: number;

  // ── Onboarding goal ────────────────────────────────────────────────────────
  // What the user said they want more time for (set during onboarding).
  // Shown subtly on the gate screen as a reminder of their own intention.
  intentionGoal: string;

  // ── Tutorial ───────────────────────────────────────────────────────────────
  // Set to true once the user completes or skips the interactive tour.
  // Prevents it from auto-triggering on every launch.
  hasSeenTutorial: boolean;

  // ── Impulse journal ────────────────────────────────────────────────────────
  // User writes what triggered them before each game — builds self-awareness.
  // tag is optional: set when the entry was written alongside a mood pill on
  // the post-walk-away screen (see MOOD_TAGS in constants/moods.ts), absent
  // for a free entry written directly from the Journal tab. Local-only for
  // now — journal_entries in Supabase doesn't have a tag column yet, so it's
  // not included in the background sync below.
  journalEntries: Array<{
    id: string;
    text: string;
    domain: string;
    timestamp: number;
    tag?: string;
  }>;

  // ── 30-day consistency tracking ────────────────────────────────────────────
  // Date-keyed records (YYYY-MM-DD) of gate fires and walk-aways per day.
  // Used to compute the rolling 30-day consistency score.
  // Old entries (>30 days) are pruned on each write to cap storage.
  dailyGateFires: Record<string, number>;   // date → gate fire count
  dailyWalkAways: Record<string, number>;   // date → walk-away count (rolling 30 days — see above)
  dailyGames: Record<string, number>;       // date → games played (rolling 30 days); powers "games this week"

  // Lifetime activity — separate from dailyWalkAways above on purpose. That
  // map is pruned to 30 days for the consistency score; Insights' "first
  // active day" / "total active days" used to be derived from it, which
  // meant those "since you started" numbers silently reset their meaning
  // every month once old keys got pruned. These two are never pruned.
  firstActiveDate: string;   // 'YYYY-MM-DD', set once, first walk-away ever
  totalActiveDays: number;   // lifetime count of distinct days with ≥1 walk-away

  // ── Urge journal (post-walk-away quick-tap) ────────────────────────────────
  // After walking away, user taps what was pulling them in (1 tap = 1 entry).
  // Insights shows a "last 30 days" trend from this, so it's pruned by AGE
  // (see addUrgeEntry) rather than by a fixed entry count — a fixed count of
  // 30 meant a daily user's window silently shrank to a few days' worth
  // of data while still being labeled "last 30 days". Different from
  // reflectionCounts (which is a lifetime aggregate) — this keeps the full
  // timestamped sequence.
  urgeJournal: Array<{
    tag: string;      // e.g. 'Bored', 'Stressed', 'Procrastinating', 'Lonely', 'Habit'
    domain: string;
    timestamp: number;
  }>;

  // ── Actions ──
  setName: (name: string) => void;
  completeOnboarding: () => void;
  markTutorialSeen: () => void;
  addPoints: (amount: number) => void;
  addXP: (amount: number) => void;
  spendPoints: (amount: number) => boolean;
  incrementStreak: () => void;
  resetStreak: () => void;
  recordGiveIn: () => void;           // an unlock was granted — can end the streak
  recordGamePlayed: (score?: number, gameId?: string) => void;
  completeDailyChallenge: () => void;

  // Website blocklist actions
  addSite: (domain: string) => void;
  removeSite: (domain: string) => void;

  // App blocklist actions
  setBlockedApps: (packages: string[]) => void;

  // Game mode toggle
  setGameMode: (mode: 'random' | 'choose') => void;

  // No-Games mode toggle
  setNoGames: (val: boolean) => void;

  // Waiting Room mode — replaces games with the 5s truth-card pause
  preferWaitingRoom: boolean;
  setPreferWaitingRoom: (val: boolean) => void;

  // Open-count tracking
  incrementOpenCount: (domain: string) => void;

  // Daily intention
  setDailyIntention: (text: string) => void;

  // Nightly pre-commitment ritual
  setNightlyCommitment: (text: string) => void;
  clearNightlyCommitment: () => void;

  // Wind-down mode
  setWindDownEnabled: (val: boolean) => void;
  setWindDownHour: (hour: number) => void;

  // BRICKED actions
  enableBricked: () => void;
  requestDisableBricked: () => void;  // starts 24hr countdown
  confirmDisableBricked: () => void;  // called after 24hrs have passed
  cancelDisableBricked: () => void;   // user changed their mind during the wait
  settleBricked: () => void;          // call on app open: finishes the disable once 24h have passed

  // Cold Turkey actions
  enableColdTurkey: () => void;
  requestDisableColdTurkey: () => void; // starts 48hr countdown
  confirmDisableColdTurkey: () => void; // called after 48hrs + phrase verified

  // Curfew / sleep mode
  setCurfew: (enabled: boolean, start: string, end: string) => void;

  // Game duration
  setGameDuration: (duration: 30 | 60 | 90) => void;

  // Streak protection
  useStreakRestore: () => boolean;    // returns false if no restores left
  refreshStreakRestores: () => void;  // call on app open to reset monthly

  // Streak freeze tokens
  checkStreakContinuity: () => void;  // call on app open — auto-applies freeze if gap day

  // Partner
  setPartner: (email: string, name: string) => void;
  setPartnerNotifications: (onUnlock: boolean, onBypass: boolean) => void;
  // Fire-and-forget partner email notification.
  // Checks the relevant toggle before sending — safe to call unconditionally.
  notifyPartner: (domain: string, event: 'unlock' | 'bypass') => void;

  // Schedule
  setBlockSchedule: (enabled: boolean, start: string, end: string, days?: number[]) => void;

  // Focus session — starts a timed hard lock of given minutes
  startFocusSession: (minutes: number) => void;
  endFocusSession: () => void;

  // Trigger tagging
  logTrigger: (tag: string) => void;

  // Post-walk-away reflection
  logReflection: (tag: string) => void;

  // 30-day consistency
  recordDailyGateFire: () => void;    // call on every gate open
  recordDailyWalkAway: () => void;    // call on every walk-away

  // Walk-away tracking
  incrementWalkAway: () => void;
  // One call that records a walk-away everywhere it needs to count (streak,
  // lifetime total, today's tally). Use this instead of calling the three
  // pieces separately so no screen can forget one.
  recordWalkAway: () => void;

  // Intention goal (set in onboarding)
  setIntentionGoal: (goal: string) => void;

  // Journal
  addJournalEntry: (text: string, domain: string, tag?: string) => void;
  clearOldJournalEntries: () => void; // keeps last 90 entries

  // Urge journal
  addUrgeEntry: (tag: string, domain: string) => void;

  // ── Commitment device ──────────────────────────────────────────────────────
  // After walking away, user states what they'll do instead. Surfaced on
  // the next gate fire for the same domain within 2 hours.
  pendingCommitment: { text: string; domain: string; timestamp: number } | null;
  // Full log for insights — keeps last 30 entries
  commitmentLog: Array<{ text: string; domain: string; timestamp: number }>;
  setCommitment: (text: string, domain: string) => void;
  clearCommitment: () => void;

  // ── Follow-through tracking ────────────────────────────────────────────────
  // After a commitment check on the next gate fire, log whether the user did it.
  followThroughLog: Array<{ text: string; domain: string; timestamp: number; completed: boolean }>;
  logFollowThrough: (text: string, domain: string, completed: boolean) => void;

  // ── Daily walk-away goal ───────────────────────────────────────────────────
  // Soft default goal shown on home screen. User-adjustable. No penalty for missing.
  dailyWalkAwayGoal: number;
  setDailyWalkAwayGoal: (n: number) => void;

  // ── First-gate intro ───────────────────────────────────────────────────────
  // One-time screen shown to new users explaining what's happening.
  hasSeenGateIntro: boolean;
  markGateIntroSeen: () => void;

  // ── Page intro guides ──────────────────────────────────────────────────────
  // First-time explainer shown once per tab (keyed by page id: 'home',
  // 'blocklist', 'arcade', 'calm', 'profile'). Renders via <PageGuide />.
  seenPageGuides: Record<string, boolean>;
  markPageGuideSeen: (page: string) => void;

  // Transient (not persisted) — set when the header's "?" button asks a
  // page's already-seen guide to show itself again. Cleared once shown.
  guideReopenRequest: string | null;
  requestGuideReopen: (page: string) => void;
  clearGuideReopenRequest: () => void;

  // The point cost to permanently remove a site from the blocklist.
  // Pro users get this for free. Free users pay REMOVE_COST points.
  REMOVE_COST: number;

  // Supabase sync — loads cloud data into local store after login
  loadFromSupabase: (userId: string) => Promise<void>;

  // Supabase sync — pushes local changes up to cloud
  // `blockedApps` is passed in by the caller so an active Mode's temporary list is
  // never uploaded in place of the user's own.
  syncToSupabase: (userId: string, blockedApps?: string[]) => Promise<boolean>;

  // Resets ALL local data — called on sign out so the next user starts fresh
  resetStore: () => void;
}

// ─── AsyncStorage adapter for Zustand persist ─────────────────────────────────
// User store state (streaks, walk-away counts, activity maps) is app usage data,
// not sensitive credentials — AsyncStorage is appropriate and has no size limit.
// SecureStore has a hard 2048-byte per-key limit on Android which the user store
// exceeds as daily activity data accumulates, causing silent write failures.
const secureStorage = createJSONStorage(() => AsyncStorage);

// ─── Default state ────────────────────────────────────────────────────────────
// Extracted so resetStore() can return to exactly this state.

// How many pause tokens it costs a free user to permanently remove a site.
// Lowered from 75 → 25: the friction is the game, not the cost. Removing
// a site intentionally is fine — we just want one small pause before they do.
// Pro users always pay 0 — this is checked in the UI, not here.
const REMOVE_COST = 25;

// ── Time reclaimed ──────────────────────────────────────────────────────────
// Rough estimate: each walk-away ≈ 20 min of reclaimed attention. Always
// derived from walkAwayCount rather than stored separately — a separately
// incremented counter drifted for anyone who had walk-aways before that
// field existed, so two screens could show two different "time saved"
// numbers for the same person. Deriving it removes that class of bug.
export const MINUTES_PER_WALK_AWAY = 20;
export function getMinutesSaved(walkAwayCount: number): number {
  return walkAwayCount * MINUTES_PER_WALK_AWAY;
}

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
  pendingSiteDeletes: [] as string[],
  gameMode: 'random' as const,
  // Default: skip picker, jump straight into a game

  noGames: false,
  preferWaitingRoom: false,

  // Open-count tracking
  openCounts: {} as Record<string, number>,
  openCountDate: '',

  // Daily intention
  dailyIntention: '',
  intentionDate: '',

  // Nightly pre-commitment ritual
  nightlyCommitment: '',
  nightlyCommitmentSetAt: 0,

  // Wind-down mode
  windDownEnabled: false,
  windDownHour: 21,

  // BRICKED
  isBricked: false,
  brickedEnabledAt: null as number | null,
  brickedDisableRequestedAt: null as number | null,

  // Cold Turkey
  isColdTurkey: false,
  coldTurkeyEnabledAt: null as number | null,
  coldTurkeyDisableRequestedAt: null as number | null,

  // Curfew
  curfewEnabled: false,
  curfewStart: '22:00',
  curfewEnd: '07:00',

  // Game duration
  gameDuration: 30 as 30 | 60 | 90,

  // Streak protection
  streakRestoresLeft: 0,
  streakRestoreMonth: '',

  // Streak freeze tokens
  streakFreezeTokens: 0,
  lastStreakDate: '',
  lastGiveInDate: '',

  // Partner
  partnerEmail: '',
  partnerName: '',
  partnerNotifyOnUnlock: true,
  partnerNotifyOnBypass: false,

  // Schedule
  blockScheduleEnabled: false,
  blockScheduleStart: '22:00',
  blockScheduleEnd: '08:00',
  blockScheduleDays: [] as number[], // empty = every day
  focusSessionEnd: null as number | null,
  triggerCounts: {} as Record<string, number>,
  reflectionCounts: {} as Record<string, number>,
  walkAwayActivity: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number],
  hourlyOpenCounts: Array(24).fill(0) as number[],

  // Journal
  journalEntries: [] as Array<{ id: string; text: string; domain: string; timestamp: number; tag?: string }>,

  // Urge journal
  urgeJournal: [] as Array<{ tag: string; domain: string; timestamp: number }>,

  // Commitment device
  pendingCommitment: null as { text: string; domain: string; timestamp: number } | null,
  commitmentLog: [] as Array<{ text: string; domain: string; timestamp: number }>,

  // 30-day consistency tracking
  dailyGateFires: {} as Record<string, number>,
  dailyWalkAways: {} as Record<string, number>,
  dailyGames: {} as Record<string, number>,

  // Lifetime activity (never pruned — see UserState comment)
  firstActiveDate: '',
  totalActiveDays: 0,


  // Walk-away count — how many times the user played and chose NOT to unlock
  walkAwayCount: 0,

  // Onboarding goal — what they said they want more time for
  intentionGoal: '',

  // Tutorial
  hasSeenTutorial: false,

  // Follow-through tracking
  followThroughLog: [] as Array<{ text: string; domain: string; timestamp: number; completed: boolean }>,

  // Daily walk-away goal
  dailyWalkAwayGoal: 3,

  // First-gate intro
  hasSeenGateIntro: false,

  // Page intro guides — first-time explainer per tab
  seenPageGuides: {} as Record<string, boolean>,
  guideReopenRequest: null as string | null,
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

      setName: (name) => {
        if (name === get().name) return;
        set({ name });
        // Keep the cloud profile's name in step (previously only the local copy changed).
        getCachedUser().then((user) => {
          if (user) backgroundWrite('profile name update', () => supabase.from('profiles').update({ name }).eq('id', user.id));
        });
      },

      completeOnboarding: () => set({ hasOnboarded: true }),

      markTutorialSeen: () => set({ hasSeenTutorial: true }),

      addPoints: (amount) =>
        set((state) => ({ points: state.points + amount })),

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

      incrementStreak: () => {
        const today = getLocalDateKey();
        const { lastStreakDate } = get();
        // Guard: only count once per calendar day
        if (lastStreakDate === today) return;
        const newStreak = get().streak + 1;
        set((state) => ({
          streak: newStreak,
          longestStreak: Math.max(state.longestStreak, newStreak),
          lastStreakDate: today,
        }));
        maybeNotifyStreak(newStreak);
      },

      resetStreak: () => set({ streak: 0, lastStreakDate: '' }),

      recordGiveIn: () => set({ lastGiveInDate: getLocalDateKey() }),

      // ── recordGamePlayed ─────────────────────────────────────────────────
      // Called when a user completes any game (from post-game.tsx).
      // 1. Increments today's bar in the weekly chart
      // 2. Increments the lifetime games counter
      // 3. Writes a row to the game_sessions table in Supabase
      recordGamePlayed: (score = 0, gameId = 'unknown') => {
        set((state) => {
          const updated = [...state.weeklyActivity] as typeof state.weeklyActivity;
          updated[6] = updated[6] + 1; // Index 6 = today
          // Date-keyed copy that doesn't need a daily roll-over; keep ~30 days.
          const today = getLocalDateKey();
          const dailyGames = { ...state.dailyGames, [today]: (state.dailyGames[today] ?? 0) + 1 };
          const keys = Object.keys(dailyGames).sort();
          for (const k of keys.slice(0, Math.max(0, keys.length - 30))) delete dailyGames[k];
          return {
            weeklyActivity: updated,
            dailyGames,
            gamesPlayed: state.gamesPlayed + 1,
          };
        });

        // Write to Supabase in the background (non-blocking)
        // This is what powers the weekly chart on the next app load
        getCachedUser().then((user) => {
          if (user) {
            backgroundWrite('game_sessions insert', () =>
              supabase.from('game_sessions').insert({
                user_id: user.id,
                score,
                game_id: gameId,
                // Local calendar day — the DB default is the UTC date, which files a
                // Hawaii evening under tomorrow.
                played_at: getLocalDateKey(),
              })
            );
          }
        });
      },

      completeDailyChallenge: () => set({ dailyChallengeCompleted: true }),

      // ── Website Blocklist ─────────────────────────────────────────────────
      addSite: (domain) => {
        const cleaned = domain
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .replace(/[/?#].*$/, '')
          .replace(/:\d+$/, '')
          .toLowerCase()
          .trim();
        if (!cleaned) return;

        const { blocklist } = get();
        // Dedupe existing list in case stale persisted data has duplicates
        const deduped = [...new Set(blocklist)];
        if (deduped.includes(cleaned)) {
          if (deduped.length !== blocklist.length) set({ blocklist: deduped });
          return;
        }
        set((st) => ({
          blocklist: [...deduped, cleaned],
          pendingSiteDeletes: st.pendingSiteDeletes.filter((d) => d !== cleaned),
        }));

        // Sync to Supabase in the background
        getCachedUser().then((user) => {
          if (user) {
            backgroundWrite('blocklist insert', () =>
              supabase.from('blocklist').insert({
                user_id: user.id,
                domain: cleaned,
              })
            );
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
          pendingSiteDeletes: state.pendingSiteDeletes.includes(domain)
            ? state.pendingSiteDeletes
            : [...state.pendingSiteDeletes, domain],
        }));

        getCachedUser().then(async (user) => {
          if (!user) return;
          const ok = await backgroundWrite('blocklist delete', () =>
            supabase.from('blocklist').delete().eq('user_id', user.id).eq('domain', domain)
          );
          if (ok) set((state) => ({ pendingSiteDeletes: state.pendingSiteDeletes.filter((d) => d !== domain) }));
        });
      },

      // ── App Blocklist ──────────────────────────────────────────────────────
      setBlockedApps: (packages) => {
        set({ blockedApps: packages });
      },

      setGameMode: (mode) => set({ gameMode: mode }),

      setNoGames: (val) => set({ noGames: val }),
      setPreferWaitingRoom: (val) => set({ preferWaitingRoom: val }),

      // ── Open-count tracking ──────────────────────────────────────────────────
      incrementOpenCount: (domain) => {
        const today = getLocalDateKey();
        const hour = new Date().getHours();
        const { openCounts, openCountDate, hourlyOpenCounts } = get();
        const counts = openCountDate === today ? { ...openCounts } : {};
        counts[domain] = (counts[domain] ?? 0) + 1;
        const updatedHourly = [...hourlyOpenCounts];
        updatedHourly[hour] = (updatedHourly[hour] ?? 0) + 1;
        set({ openCounts: counts, openCountDate: today, hourlyOpenCounts: updatedHourly });
      },

      // ── Daily intention ──────────────────────────────────────────────────────
      setDailyIntention: (text) => {
        const today = getLocalDateKey();
        set({ dailyIntention: text, intentionDate: today });
      },

      // ── Nightly pre-commitment ritual ──────────────────────────────────────
      setNightlyCommitment: (text) =>
        set({ nightlyCommitment: text, nightlyCommitmentSetAt: Date.now() }),
      clearNightlyCommitment: () =>
        set({ nightlyCommitment: '', nightlyCommitmentSetAt: 0 }),

      // ── Wind-down mode ───────────────────────────────────────────────────────
      setWindDownEnabled: (val) => set({ windDownEnabled: val }),
      setWindDownHour: (hour) => set({ windDownHour: hour }),

      // ── BRICKED mode ────────────────────────────────────────────────────────
      enableBricked: () =>
        set({
          isBricked: true,
          brickedEnabledAt: Date.now(),
          brickedDisableRequestedAt: null,
        }),

      // User taps "Disable BRICKED" — starts the 24hr safety countdown.
      // They can't immediately turn it off — that would defeat the purpose.
      // A second request must not restart the clock.
      requestDisableBricked: () => {
        if (get().brickedDisableRequestedAt) return;
        set({ brickedDisableRequestedAt: Date.now() });
      },

      cancelDisableBricked: () => set({ brickedDisableRequestedAt: null }),

      // Nothing else ever acted on the request, so Hard Mode could never actually
      // turn off. Called on app open / foreground.
      settleBricked: () => {
        const s = get();
        if (!s.isBricked || !s.brickedDisableRequestedAt) return;
        if (s.isColdTurkey) return; // Cold Turkey keeps Hard Mode on until it is lifted itself
        if (Date.now() - s.brickedDisableRequestedAt >= 24 * 60 * 60 * 1000) {
          set({ isBricked: false, brickedEnabledAt: null, brickedDisableRequestedAt: null });
        }
      },

      // Called after the 24hr cooldown has expired.
      confirmDisableBricked: () =>
        set({
          isBricked: false,
          brickedEnabledAt: null,
          brickedDisableRequestedAt: null,
        }),

      // ── Cold Turkey mode ─────────────────────────────────────────────────────
      // Nuclear option: no unlock path whatsoever. 48hr re-enable delay.
      enableColdTurkey: () =>
        set({
          isColdTurkey: true,
          coldTurkeyEnabledAt: Date.now(),
          coldTurkeyDisableRequestedAt: null,
          // Enabling Cold Turkey also enables BRICKED (superset)
          isBricked: true,
          brickedEnabledAt: Date.now(),
          brickedDisableRequestedAt: null,
        }),

      requestDisableColdTurkey: () =>
        set({ coldTurkeyDisableRequestedAt: Date.now() }),

      // Only called from settings after 48hrs have elapsed AND the user has
      // typed the confirmation phrase. UI enforces both checks before calling.
      confirmDisableColdTurkey: () =>
        set({
          isColdTurkey: false,
          coldTurkeyEnabledAt: null,
          coldTurkeyDisableRequestedAt: null,
        }),

      // ── Curfew / sleep mode ──────────────────────────────────────────────────
      setCurfew: (enabled, start, end) =>
        set({ curfewEnabled: enabled, curfewStart: start, curfewEnd: end }),

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
        const thisMonth = getLocalMonthKey(); // 'YYYY-MM', device-local
        const { streakRestoreMonth } = get();
        if (streakRestoreMonth !== thisMonth) {
          set({ streakRestoresLeft: 1, streakRestoreMonth: thisMonth });
        }
      },

      // ── Streak continuity check ──────────────────────────────────────────────
      // Call on every app open. A streak counts days of resisting, so a quiet
      // day (no gate, nothing unlocked) must NOT break it — before, anyone who
      // simply wasn't tempted for two days lost their streak. It only ends when
      // the user actually gave in (unlocked an app) on a day they didn't also
      // walk away:
      // - Same day / yesterday → intact
      // - Longer gap, no give-in since the last walk-away → intact; keep it alive
      // - Longer gap with a give-in → burn a freeze token if there is one,
      //   otherwise reset
      checkStreakContinuity: () => {
        const { lastStreakDate, lastGiveInDate, streak, streakFreezeTokens } = get();
        if (!lastStreakDate || streak === 0) return; // no streak to protect
        const today = getLocalDateKey();
        if (lastStreakDate === today) return; // still the same calendar day
        const daysDiff = localDateKeyDiffDays(today, lastStreakDate);
        if (daysDiff <= 1) return; // yesterday — streak still alive

        const yestDate = parseLocalDateKey(today);
        yestDate.setDate(yestDate.getDate() - 1);
        const yesterday = getLocalDateKey(yestDate);

        const gaveIn = !!lastGiveInDate && lastGiveInDate > lastStreakDate;
        if (!gaveIn) {
          // Clean gap: carry the streak forward so the next walk-away today
          // continues it instead of starting over.
          set({ lastStreakDate: yesterday });
        } else if (streakFreezeTokens > 0) {
          set({ streakFreezeTokens: streakFreezeTokens - 1, lastStreakDate: yesterday });
        } else {
          set({ streak: 0, lastStreakDate: '' });
        }
      },

      // ── Partner ──────────────────────────────────────────────────────────────
      // FIXED: Validates email format before storing (audit item 7)
      setPartner: (email, name) => {
        if (!isValidEmail(email)) {
          console.warn('[NoGoon] Invalid partner email format:', email);
          return;
        }

        const sanitizedEmail = email.trim().toLowerCase();
        set({ partnerEmail: sanitizedEmail, partnerName: name });

        // Sync partner info to Supabase
        getCachedUser().then((user) => {
          if (user) {
            backgroundWrite('partner update', () =>
              supabase.from('profiles').update({
                partner_email: sanitizedEmail,
                partner_name: name,
              }).eq('id', user.id)
            );
          }
        });
      },

      setPartnerNotifications: (onUnlock, onBypass) =>
        set({
          partnerNotifyOnUnlock: onUnlock,
          partnerNotifyOnBypass: onBypass,
        }),

      notifyPartner: (domain, event) => {
        const { partnerEmail, partnerNotifyOnUnlock, partnerNotifyOnBypass } = get();
        if (!partnerEmail) return;
        if (event === 'unlock' && !partnerNotifyOnUnlock) return;
        if (event === 'bypass' && !partnerNotifyOnBypass) return;
        // Fire-and-forget — errors are swallowed so a failed notification never
        // blocks the user's flow (unlocking or navigating away from the gate).
        supabase.functions
          .invoke('notify-partner', { body: { domain } })
          .catch((e) => console.warn('[NoGoon] Partner notification failed:', e));
      },

      // ── Block schedule ───────────────────────────────────────────────────────
      setBlockSchedule: (enabled, start, end, days = []) =>
        set({
          blockScheduleEnabled: enabled,
          blockScheduleStart: start,
          blockScheduleEnd: end,
          blockScheduleDays: days,
        }),

      // ── Focus session ────────────────────────────────────────────────────────
      startFocusSession: (minutes) => {
        const endMs = Date.now() + minutes * 60_000;
        set({ focusSessionEnd: endMs });
        syncFocusSessionToNative(endMs);
      },

      endFocusSession: () => {
        set({ focusSessionEnd: null });
        syncFocusSessionToNative(0);
      },

      // ── Trigger tagging ──────────────────────────────────────────────────────
      logTrigger: (tag) =>
        set((state) => ({
          triggerCounts: {
            ...state.triggerCounts,
            [tag]: (state.triggerCounts[tag] ?? 0) + 1,
          },
        })),

      // ── Post-walk-away reflection ────────────────────────────────────────────
      logReflection: (tag) =>
        set((state) => ({
          reflectionCounts: {
            ...state.reflectionCounts,
            [tag]: (state.reflectionCounts[tag] ?? 0) + 1,
          },
        })),

      // ── 30-day consistency tracking ──────────────────────────────────────────
      // Helper: prune entries older than 30 days
      recordDailyGateFire: () => {
        const today = getLocalDateKey();
        const cutoff = getLocalDateKey(new Date(Date.now() - 30 * 86_400_000));
        set((state) => {
          const updated = { ...state.dailyGateFires };
          updated[today] = (updated[today] ?? 0) + 1;
          // Prune old entries
          for (const key of Object.keys(updated)) {
            if (key < cutoff) delete updated[key];
          }
          return { dailyGateFires: updated };
        });
      },

      recordWalkAway: () => {
        const { incrementStreak, incrementWalkAway, recordDailyWalkAway } = get();
        incrementStreak();
        incrementWalkAway();
        recordDailyWalkAway();
      },

      recordDailyWalkAway: () => {
        const today = getLocalDateKey();
        const cutoff = getLocalDateKey(new Date(Date.now() - 30 * 86_400_000));
        set((state) => {
          const updated = { ...state.dailyWalkAways };
          const wasAlreadyActiveToday = (updated[today] ?? 0) > 0;
          updated[today] = (updated[today] ?? 0) + 1;
          for (const key of Object.keys(updated)) {
            if (key < cutoff) delete updated[key];
          }

          // Lifetime activity tracking — independent of the 30-day-pruned
          // map above (see UserState comment). Only touched on the first
          // walk-away of a given local day.
          let { firstActiveDate, totalActiveDays } = state;
          if (!wasAlreadyActiveToday) {
            totalActiveDays += 1;
            if (!firstActiveDate) {
              // First time these lifetime fields are populated for an
              // existing user: backfill firstActiveDate from whatever's
              // still in the rolling 30-day map rather than defaulting to
              // "today", so a long-time user doesn't suddenly look brand
              // new. totalActiveDays can't be recovered the same way (the
              // pre-fix map never kept more than 30 keys), so it starts
              // counting forward from here.
              const existingKeys = Object.keys(updated).sort();
              firstActiveDate = existingKeys[0] ?? today;
            }
          }

          return { dailyWalkAways: updated, firstActiveDate, totalActiveDays };
        });
      },

      // ── Walk-away tracking ───────────────────────────────────────────────────
      // Called when user taps "Walk Away" on the post-game screen.
      // Also increments today's slot in walkAwayActivity and schedules the
      // 8pm daily summary notification with the updated count.
      // Awards a streak freeze token at each 5 walk-away milestone.
      incrementWalkAway: () => {
        const prev = get().walkAwayCount;
        const newCount = prev + 1;
        let newTodayWalkAways = 1;
        set((state) => {
          const updated = [...state.walkAwayActivity] as typeof state.walkAwayActivity;
          updated[6] = updated[6] + 1;
          // walkAwayActivity[6] is never rolled over by date, so it is a lifetime count by now.
          // Today's real number comes from dailyWalkAways (recordDailyWalkAway runs right after).
          newTodayWalkAways = (state.dailyWalkAways[getLocalDateKey()] ?? 0) + 1;
          // Award a freeze token at each 5-walk-away milestone (5, 10, 15 …)
          const crossedMilestone = Math.floor(newCount / 5) > Math.floor(prev / 5);
          return {
            walkAwayCount: newCount,
            walkAwayActivity: updated,
            streakFreezeTokens: crossedMilestone
              ? state.streakFreezeTokens + 1
              : state.streakFreezeTokens,
          };
        });
        maybeNotifyWalkAway(newCount);
        // Reschedule the 8pm summary with the fresh daily count
        const { openCounts, openCountDate } = get();
        const today = getLocalDateKey();
        const todayCounts = openCountDate === today ? openCounts : {};
        const topDomain = Object.entries(todayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        scheduleDailySummary(newTodayWalkAways, topDomain).catch(() => {});
      },

      // ── Intention goal ───────────────────────────────────────────────────────
      setIntentionGoal: (goal) => set({ intentionGoal: goal }),

      // ── Impulse journal ──────────────────────────────────────────────────────
      addJournalEntry: (text, domain, tag) => {
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text,
          domain,
          timestamp: Date.now(),
          ...(tag ? { tag } : {}),
        };
        set((state) => ({
          journalEntries: [entry, ...state.journalEntries].slice(0, 90),
        }));

        // Sync to Supabase in background
        getCachedUser().then((user) => {
          if (user && text.trim()) {
            backgroundWrite('journal_entries insert', () =>
              supabase.from('journal_entries').insert({
                user_id: user.id,
                text,
                domain,
              })
            );
          }
        });
      },

      clearOldJournalEntries: () =>
        set((state) => ({
          journalEntries: state.journalEntries.slice(0, 90),
        })),

      // ── Urge journal ─────────────────────────────────────────────────────────
      addUrgeEntry: (tag, domain) =>
        set((state) => {
          const cutoff = Date.now() - 90 * 86_400_000; // 90d: comfortably past the 30d window Insights reads
          const pruned = state.urgeJournal.filter((e) => e.timestamp > cutoff);
          return {
            // Prune by age, not a fixed count — Insights' "last 30 days" trend
            // needs entries older than 30 days to still be present to filter
            // out live. A 500-entry safety cap guards against unbounded growth
            // from an extremely heavy logger; ordinary use never approaches it.
            urgeJournal: [{ tag, domain, timestamp: Date.now() }, ...pruned].slice(0, 500),
          };
        }),

      // ── Commitment device ─────────────────────────────────────────────────
      setCommitment: (text, domain) =>
        set((state) => {
          const entry = { text, domain, timestamp: Date.now() };
          return {
            pendingCommitment: entry,
            commitmentLog: [entry, ...state.commitmentLog].slice(0, 30),
          };
        }),
      clearCommitment: () => set({ pendingCommitment: null }),

      // ── Follow-through ────────────────────────────────────────────────────
      logFollowThrough: (text, domain, completed) =>
        set((state) => ({
          followThroughLog: [
            { text, domain, timestamp: Date.now(), completed },
            ...state.followThroughLog,
          ].slice(0, 30),
        })),

      // ── Daily walk-away goal ──────────────────────────────────────────────
      setDailyWalkAwayGoal: (n) => set({ dailyWalkAwayGoal: Math.max(1, Math.min(20, n)) }),

      // ── First-gate intro ──────────────────────────────────────────────────
      markGateIntroSeen: () => set({ hasSeenGateIntro: true }),

      markPageGuideSeen: (page) =>
        set((state) => ({
          seenPageGuides: { ...state.seenPageGuides, [page]: true },
        })),

      requestGuideReopen: (page) => set({ guideReopenRequest: page }),
      clearGuideReopenRequest: () => set({ guideReopenRequest: null }),

      // Expose the constant so UI can read it without a separate import
      REMOVE_COST,

      // ── Supabase sync ─────────────────────────────────────────────────────
      // Called after login — fetches the user's data from Supabase and
      // updates the local store so the UI shows real numbers, not zeros.
      loadFromSupabase: async (userId) => {
        try {
        // Build the date range for the last 7 days
        const days = getLast7Days(); // ['2025-01-09', ..., '2025-01-15']

        const [profileResult, blocklistResult, sessionsResult] =
          await Promise.all([
            // Fetch the user's main profile stats
            supabase.from('profiles').select('*').eq('id', userId).single(),

            // Fetch all blocked websites
            supabase.from('blocklist').select('domain').eq('user_id', userId),

            // Fetch game sessions from the last 7 days for the weekly chart
            supabase
              .from('game_sessions')
              .select('played_at')
              .eq('user_id', userId)
              .gte('played_at', days[0])   // Greater than or equal to 6 days ago
              .lte('played_at', days[6]),   // Less than or equal to today
          ]);

        // ── Profile data ──
        if (profileResult.data) {
          const p = profileResult.data;
          // MERGE, don't overwrite. Progress is written on this device first and
          // uploaded later (see hooks/useCloudSync.ts), so the cloud copy can be
          // older — or still all zeros for an account whose profile row was just
          // created. Taking the larger of the two means a launch can never wipe
          // progress, and a reinstall/new phone still recovers it from the cloud.
          set((state) => {
            const xp = Math.max(state.xp, p.xp ?? 0);
            return {
              name: state.name || p.name || '',
              points: Math.max(state.points, p.points ?? 0),
              xp,
              level: getLevelProgress(xp).label,
              // Once this device tracks its own streak date it is authoritative: a cloud
              // copy that is merely older (e.g. an unsynced reset) must not revive an
              // ended streak.
              streak: state.lastStreakDate ? state.streak : Math.max(state.streak, p.streak ?? 0),
              longestStreak: Math.max(state.longestStreak, p.longest_streak ?? 0),
              gamesPlayed: Math.max(state.gamesPlayed, p.games_played ?? 0),
              walkAwayCount: Math.max(state.walkAwayCount, p.walk_away_count ?? 0),
              // Blocked apps: a fresh install/new phone has none locally, so take the
              // cloud list then. Otherwise the device wins (it is uploaded on change),
              // so an app the user removed never comes back.
              blockedApps:
                state.blockedApps.length === 0 && !useModesStore.getState().baseSnapshot && Array.isArray(p.blocked_apps)
                  ? (p.blocked_apps as string[])
                  : state.blockedApps,
              // A brand-new account also has a (zeroed) profile row, so a row alone
              // proves nothing — only real progress marks someone as a returning user
              // who shouldn't be walked through onboarding again.
              hasOnboarded:
                state.hasOnboarded ||
                (p.points ?? 0) > 0 || (p.xp ?? 0) > 0 || (p.streak ?? 0) > 0 ||
                (p.games_played ?? 0) > 0 || (p.walk_away_count ?? 0) > 0,
            };
          });
        }

        // ── Blocklist ──
        // First finish any removals that never reached the cloud, and keep those
        // domains out of the merge below so a removed site doesn't come back.
        const pending = get().pendingSiteDeletes;
        if (pending.length > 0) {
          const results = await Promise.all(
            pending.map((d) =>
              backgroundWrite('blocklist delete (retry)', () =>
                supabase.from('blocklist').delete().eq('user_id', userId).eq('domain', d)
              ).then((ok) => (ok ? d : null))
            )
          );
          const done = results.filter((d): d is string => !!d);
          if (done.length > 0) set((st) => ({ pendingSiteDeletes: st.pendingSiteDeletes.filter((d) => !done.includes(d)) }));
        }
        if (blocklistResult.data) {
          const stillPending = new Set(get().pendingSiteDeletes);
          set((state) => ({
            // Union, not replace: a failed background insert (or a Mode that swapped
            // the live list) must never leave the user with fewer blocked sites after
            // a launch. Removals already delete the cloud row at the time they happen.
            blocklist: Array.from(new Set([
              ...state.blocklist,
              ...blocklistResult.data.map((r: { domain: string }) => r.domain),
            ])).filter((d) => !stillPending.has(d)),
            hasOnboarded: state.hasOnboarded || blocklistResult.data.length > 0,
          }));
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
          const weeklyActivity = days.map((d) => activityMap[d] ?? 0) as [number, number, number, number, number, number, number];
          // Merge the cloud's per-day counts into the date-keyed map (never lower a local count).
          set((state) => {
            const dailyGames = { ...state.dailyGames };
            days.forEach((d) => { dailyGames[d] = Math.max(dailyGames[d] ?? 0, activityMap[d] ?? 0); });
            return { weeklyActivity, dailyGames };
          });
        }
      } catch (err) {
        console.error('[loadFromSupabase] error:', err);
      }
    },

      syncToSupabase: async (userId, blockedApps) => {
        const { points, xp, level, streak, longestStreak, gamesPlayed, walkAwayCount } = get();
        const apps = blockedApps ?? get().blockedApps;
        const base = {
          id: userId,
          points,
          xp,
          level,
          streak,
          longest_streak: longestStreak,
          games_played: gamesPlayed,
        };
        // walk_away_count may not exist on older `profiles` tables. If the full
        // upsert is rejected, retry without it so the rest of the progress still
        // reaches the cloud instead of the whole sync silently failing.
        // The same applies to blocked_apps (see supabase/migrations). Try the full
        // row first, then without the newest column, then the bare minimum.
        const full = { ...base, walk_away_count: walkAwayCount, blocked_apps: apps };
        try {
          const { error } = await supabase.from('profiles').upsert(full);
          if (!error) return true;
          const { error: e2 } = await supabase.from('profiles').upsert({ ...base, walk_away_count: walkAwayCount });
          if (!e2) return true;
          return await backgroundWrite('syncToSupabase (minimal)', () =>
            supabase.from('profiles').upsert(base)
          );
        } catch (e) {
          console.warn('[NoGoon] syncToSupabase failed:', e);
          return false;
        }
      },

      // Called on sign out so the next person who logs in starts fresh.
      // The persist middleware automatically clears SecureStore as part
      // of the state reset.
      resetStore: () => {
        // Self-imposed locks (Hard Mode, Cold Turkey, Focus Session, Curfew) are
        // commitments about THIS phone, and the Android service keeps enforcing them
        // regardless. Wiping them on sign-out turned "sign out, sign back in" into a
        // free way around the 24-hour disable wait, so they survive a reset.
        const s = get();
        set({
          ...DEFAULT_STATE,
          isBricked: s.isBricked,
          brickedEnabledAt: s.brickedEnabledAt,
          brickedDisableRequestedAt: s.brickedDisableRequestedAt,
          isColdTurkey: s.isColdTurkey,
          coldTurkeyEnabledAt: s.coldTurkeyEnabledAt,
          coldTurkeyDisableRequestedAt: s.coldTurkeyDisableRequestedAt,
          focusSessionEnd: s.focusSessionEnd,
          curfewEnabled: s.curfewEnabled,
          curfewStart: s.curfewStart,
          curfewEnd: s.curfewEnd,
        });
      },
    }),
    // \u2500\u2500 Persist config \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    {
      name: 'nogoon-user-store', // Key used in SecureStore
      storage: secureStorage,
      // Only persist the data fields, not the async action functions
      partialize: (state) => ({
        name: state.name,
        hasOnboarded: state.hasOnboarded,
        streak: state.streak,
        longestStreak: state.longestStreak,
        points: state.points,
        xp: state.xp,
        level: state.level,
        gamesPlayed: state.gamesPlayed,
        weeklyActivity: state.weeklyActivity,
        dailyChallengeCompleted: state.dailyChallengeCompleted,
        blocklist: state.blocklist,
        blockedApps: state.blockedApps,
        pendingSiteDeletes: state.pendingSiteDeletes,
        gameMode: state.gameMode,
        noGames: state.noGames,
        preferWaitingRoom: state.preferWaitingRoom,
        isBricked: state.isBricked,
        brickedEnabledAt: state.brickedEnabledAt,
        brickedDisableRequestedAt: state.brickedDisableRequestedAt,
        isColdTurkey: state.isColdTurkey,
        coldTurkeyEnabledAt: state.coldTurkeyEnabledAt,
        coldTurkeyDisableRequestedAt: state.coldTurkeyDisableRequestedAt,
        curfewEnabled: state.curfewEnabled,
        curfewStart: state.curfewStart,
        curfewEnd: state.curfewEnd,
        gameDuration: state.gameDuration,
        streakRestoresLeft: state.streakRestoresLeft,
        streakRestoreMonth: state.streakRestoreMonth,
        streakFreezeTokens: state.streakFreezeTokens,
        lastStreakDate: state.lastStreakDate,
        lastGiveInDate: state.lastGiveInDate,
        partnerEmail: state.partnerEmail,
        partnerName: state.partnerName,
        partnerNotifyOnUnlock: state.partnerNotifyOnUnlock,
        partnerNotifyOnBypass: state.partnerNotifyOnBypass,
        blockScheduleEnabled: state.blockScheduleEnabled,
        blockScheduleStart: state.blockScheduleStart,
        blockScheduleEnd: state.blockScheduleEnd,
        blockScheduleDays: state.blockScheduleDays,
        openCounts: state.openCounts,
        openCountDate: state.openCountDate,
        dailyIntention: state.dailyIntention,
        intentionDate: state.intentionDate,
        nightlyCommitment: state.nightlyCommitment,
        nightlyCommitmentSetAt: state.nightlyCommitmentSetAt,
        windDownEnabled: state.windDownEnabled,
        windDownHour: state.windDownHour,
        intentionGoal: state.intentionGoal,
        journalEntries: state.journalEntries,
        urgeJournal: state.urgeJournal,
        pendingCommitment: state.pendingCommitment,
        commitmentLog: state.commitmentLog,
        dailyGateFires: state.dailyGateFires,
        dailyWalkAways: state.dailyWalkAways,
        dailyGames: state.dailyGames,
        firstActiveDate: state.firstActiveDate,
        totalActiveDays: state.totalActiveDays,
        walkAwayCount: state.walkAwayCount,
        triggerCounts: state.triggerCounts,
        reflectionCounts: state.reflectionCounts,
        walkAwayActivity: state.walkAwayActivity,
        hourlyOpenCounts: state.hourlyOpenCounts,
        focusSessionEnd: state.focusSessionEnd,
        followThroughLog: state.followThroughLog,
        dailyWalkAwayGoal: state.dailyWalkAwayGoal,
        hasSeenGateIntro: state.hasSeenGateIntro,
        hasSeenTutorial: state.hasSeenTutorial,
        seenPageGuides: state.seenPageGuides,
      }),
      // After SecureStore rehydration, push focusSessionEnd to SharedPreferences
      // so the Kotlin Accessibility Service sees it immediately on the next app open.
      onRehydrateStorage: () => (state) => {
        if (state?.focusSessionEnd) {
          syncFocusSessionToNative(state.focusSessionEnd);
        }
      },
    }
  )
);
