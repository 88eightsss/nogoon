// ─── "Make it yours" setup questions ──────────────────────────────────────────
//
// The four skippable questions shown after the Accessibility step in onboarding
// (and again from Me > Account & help > Setup & fixes). Copy and the
// answer-to-default mapping live here so they can be edited without touching
// the screens (components/onboarding/SetupQuestions.tsx applies them through
// utils/setupDefaults.ts).
//
// Rules:
// - An answer only sets a default in an existing store. Changing it later
//   happens where that setting already lives (Me > Protection, Customize).
// - A skipped question changes nothing.
// - The answers themselves are never saved or sent anywhere. Only the
//   settings they produce are kept, in the same stores as before.
// - Nothing here turns on Curfew, Hard Mode or a block schedule: a schedule
//   would switch blocking OFF outside its window, and curfew has no unlock path.

import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

type FeatherName = ComponentProps<typeof Feather>['name'];

// ── Q1: what to cut back on (multi-select) ───────────────────────────────────

export type CutBackId = 'shortVideo' | 'social' | 'adult' | 'games' | 'news' | 'other';

export const CUT_BACK_CHOICES: { id: CutBackId; label: string; sub: string; icon: FeatherName }[] = [
  { id: 'shortVideo', label: 'Short videos', sub: 'TikTok, YouTube',              icon: 'play-circle' },
  { id: 'social',     label: 'Social feeds', sub: 'Instagram, Facebook, X, Reddit', icon: 'users' },
  { id: 'adult',      label: 'Adult sites',  sub: 'Porn and similar sites',       icon: 'eye-off' },
  { id: 'games',      label: 'Games',        sub: 'Roblox, Clash of Clans',       icon: 'target' },
  { id: 'news',       label: 'News',         sub: 'Endless headlines',            icon: 'globe' },
  { id: 'other',      label: 'Something else', sub: 'Add it in Me, under Protection', icon: 'plus' },
];

/** Starter blocklist per choice. Domains go through addSite(); app ids must be in BLOCKABLE_APPS
 *  (hooks/useAppBlocker.ts) so they show up, and can be removed, in Apps & sites. Apps that are
 *  not installed are skipped when the answers are applied. */
export const CUT_BACK_STARTERS: Record<CutBackId, { domains: string[]; apps: string[] }> = {
  shortVideo: {
    domains: ['tiktok.com', 'youtube.com'],
    apps: ['com.zhiliaoapp.musically', 'com.google.android.youtube'],
  },
  social: {
    domains: ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'snapchat.com', 'reddit.com'],
    apps: ['com.instagram.android', 'com.facebook.katana', 'com.twitter.android', 'com.snapchat.android', 'com.reddit.frontpage'],
  },
  adult: {
    domains: ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'onlyfans.com'],
    apps: [],
  },
  games: {
    domains: ['roblox.com'],
    apps: ['com.roblox.client', 'com.supercell.clashofclans', 'com.kiloo.subwaysurf'],
  },
  news: {
    domains: ['cnn.com', 'foxnews.com', 'nytimes.com', 'news.google.com', 'msn.com'],
    apps: [],
  },
  other: { domains: [], apps: [] },
};

// ── Q2: hardest time (single choice) + optional Briefing reminder ────────────

export type HardTimeId = 'morning' | 'work' | 'evening' | 'late';

export const HARD_TIME_CHOICES: { id: HardTimeId; label: string; icon: FeatherName; effect: string }[] = [
  { id: 'morning', label: 'First thing in the morning', icon: 'sunrise', effect: 'Turns on a daily Briefing reminder, so the first thing you open is a short read.' },
  { id: 'work',    label: 'During work or school',      icon: 'briefcase', effect: 'Blocking already runs all day. Nothing extra turns on.' },
  { id: 'evening', label: 'Evenings',                   icon: 'sunset', effect: 'Turns on Wind-down from 8pm: until 5am the pause screen goes straight to breathing.' },
  { id: 'late',    label: 'Late at night, in bed',      icon: 'moon', effect: 'Turns on Wind-down from 10pm: until 5am the pause screen goes straight to breathing.' },
];

/** What each Q2 answer sets. windDownHour null = leave Wind-down alone. */
export const HARD_TIME_DEFAULTS: Record<HardTimeId, { windDownHour: number | null; briefingReminder: boolean }> = {
  morning: { windDownHour: null, briefingReminder: true },
  work:    { windDownHour: null, briefingReminder: false },
  evening: { windDownHour: 20,   briefingReminder: false },
  late:    { windDownHour: 22,   briefingReminder: false },
};

// ── Q3: what replaces the scroll (single choice) ─────────────────────────────
// Stored as useRoomStore.helpFirst and changeable in Customize > Layout & news.
// It only reorders; nothing is hidden.

export type HelpFirst = 'standard' | 'briefing' | 'breathe' | 'game' | 'write';

export const REPLACE_CHOICES: { id: Exclude<HelpFirst, 'standard'>; label: string; sub: string; icon: FeatherName }[] = [
  { id: 'briefing', label: 'Read the Briefing', sub: 'A short daily read', icon: 'file-text' },
  { id: 'breathe',  label: 'Breathe',           sub: 'One minute, guided', icon: 'wind' },
  { id: 'game',     label: 'A quick game',      sub: 'Hands busy, head clear', icon: 'zap' },
  { id: 'write',    label: 'Write it out',      sub: 'A line in the journal', icon: 'book-open' },
];

/** Customize > Layout & news chips (Standard = the original order). */
export const HELP_FIRST_CHOICES: { id: HelpFirst; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'breathe',  label: 'Breathe' },
  { id: 'game',     label: 'Game' },
  { id: 'write',    label: 'Write' },
];

export function isHelpFirst(v: unknown): v is HelpFirst {
  return typeof v === 'string' && HELP_FIRST_CHOICES.some((c) => c.id === v);
}

/** Unwind groups (app/(tabs)/calm.tsx). 'standard' is the original order. */
export type UnwindGroupId = 'now' | 'play' | 'out';
export const UNWIND_GROUP_ORDER: Record<HelpFirst, UnwindGroupId[]> = {
  standard: ['now', 'play', 'out'],
  briefing: ['now', 'play', 'out'],   // the Briefing is its own tab; Unwind keeps its order
  breathe:  ['now', 'play', 'out'],
  game:     ['play', 'now', 'out'],
  write:    ['out', 'now', 'play'],
};

/** Options in Today's "Need a minute" sheet (components/page/TemptedSheet.tsx).
 *  'briefing' is only listed when it was chosen, as the first option. */
export type TemptedOptionId = 'briefing' | 'breathe' | 'game' | 'calm' | 'write';
export const TEMPTED_ORDER: Record<HelpFirst, TemptedOptionId[]> = {
  standard: ['breathe', 'game', 'calm', 'write'],
  briefing: ['briefing', 'breathe', 'game', 'calm', 'write'],
  breathe:  ['breathe', 'game', 'calm', 'write'],
  game:     ['game', 'breathe', 'calm', 'write'],
  write:    ['write', 'breathe', 'game', 'calm'],
};

// ── Answers and the plan they produce ────────────────────────────────────────

/** Only what the person actually answered. Undefined = skipped. Held in memory only. */
export interface SetupAnswers {
  cutBack?: CutBackId[];
  hardTime?: HardTimeId;
  /** Set only when the person changed the reminder box on Q2. */
  briefingReminder?: boolean;
  replace?: Exclude<HelpFirst, 'standard'>;
}

export interface SetupPlan {
  addDomains: string[];
  addApps: string[];          // before the installed-app filter
  windDownHour: number | null;
  briefingReminder: boolean | null;   // null = leave alone
  helpFirst: HelpFirst | null;        // null = leave alone
}

/** Pure: answers → the changes to make. Skipped answers produce no change. */
export function planSetupDefaults(a: SetupAnswers): SetupPlan {
  const domains = new Set<string>();
  const apps = new Set<string>();
  for (const id of a.cutBack ?? []) {
    CUT_BACK_STARTERS[id].domains.forEach((d) => domains.add(d));
    CUT_BACK_STARTERS[id].apps.forEach((p) => apps.add(p));
  }
  const time = a.hardTime ? HARD_TIME_DEFAULTS[a.hardTime] : null;
  return {
    addDomains: [...domains],
    addApps: [...apps],
    windDownHour: time?.windDownHour ?? null,
    briefingReminder: a.briefingReminder ?? null,
    helpFirst: a.replace ?? null,
  };
}
