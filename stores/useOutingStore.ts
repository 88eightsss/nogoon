// ─── Outings ──────────────────────────────────────────────────────────────────
//
// "I went." Going to a market, a cleanup or a community event earns the companion a treat, the same
// as a walk-away does, and every few outings earns a souvenir for the Passport on Step Out.
//
// Proof comes in tiers, because the rewards are cosmetic and nobody loses anything if someone fibs:
//   'self'  — tapped "I went". 1 treat.
//   'place' — the phone was at the place during the event (checked on the phone, nothing is sent). 2 treats.
// Caps keep it from being farmed: one reward per event per day, MAX_REWARDED_PER_DAY a day.
// Everything lives on the phone.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey } from '@/utils/date';
import { useMascotStore } from '@/stores/useMascotStore';
import { track } from '@/lib/usage';

export type OutingProof = 'self' | 'place';

export type Outing = {
  key: string;        // event id, or a slug of the title for hand-listed things
  title: string;
  day: string;        // local YYYY-MM-DD
  proof: OutingProof;
  at: number;
};

export type Souvenir = { id: string; name: string; earnedDay: string };

/** Treats an outing pays. */
export const TREATS_FOR: Record<OutingProof, number> = { self: 1, place: 2 };
export const MAX_REWARDED_PER_DAY = 2;
/** A souvenir after this many points (an honor outing is 1, a place-verified one is 2). */
export const SOUVENIR_EVERY = 5;
export const DEFAULT_WEEKLY_GOAL = 1;
const LOG_MAX = 200;

/** Names handed out in order. Plain on purpose; the sprite for each can come later. */
export const SOUVENIR_NAMES = [
  'Market basket', 'Trail map', 'Tide pool shell', 'Sun hat', 'Lei of the week', 'Garden gloves',
  'Beach-cleanup bucket', 'Kite', 'Picnic blanket', 'Little lantern', 'Surf wax', 'Seed packet',
];

/** Monday of the local week containing `day`, as YYYY-MM-DD. */
export function weekStart(day: string = getLocalDateKey()): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const back = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - back);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export const outingKey = (id: string | undefined, title: string) =>
  (id && id.length > 0 ? id : title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 80);

export type CheckInResult =
  | { ok: true; treats: number; souvenir: Souvenir | null }
  | { ok: false; reason: 'already' | 'cap' };

interface OutingState {
  log: Outing[];
  souvenirs: Souvenir[];
  /** Points toward the next souvenir. */
  progress: number;
  weeklyGoal: number;
  setWeeklyGoal: (n: number) => void;
  checkIn: (o: { key: string; title: string; proof: OutingProof }) => CheckInResult;
}

export const useOutingStore = create<OutingState>()(
  persist(
    (set, get) => ({
      log: [],
      souvenirs: [],
      progress: 0,
      weeklyGoal: DEFAULT_WEEKLY_GOAL,
      setWeeklyGoal: (n) => set({ weeklyGoal: Math.max(1, Math.min(7, Math.floor(n))) }),
      checkIn: ({ key, title, proof }) => {
        const day = getLocalDateKey();
        const { log, souvenirs, progress } = get();
        const sameToday = log.find((o) => o.key === key && o.day === day);
        // Upgrading an honor check-in to a verified one pays the difference, once.
        if (sameToday && !(sameToday.proof === 'self' && proof === 'place')) return { ok: false, reason: 'already' };
        const rewardedToday = log.filter((o) => o.day === day).length;
        if (!sameToday && rewardedToday >= MAX_REWARDED_PER_DAY) return { ok: false, reason: 'cap' };

        const treats = sameToday ? TREATS_FOR.place - TREATS_FOR.self : TREATS_FOR[proof];
        const gained = sameToday ? 1 : proof === 'place' ? 2 : 1;
        let nextProgress = progress + gained;
        let souvenir: Souvenir | null = null;
        let nextSouvenirs = souvenirs;
        if (nextProgress >= SOUVENIR_EVERY) {
          nextProgress -= SOUVENIR_EVERY;
          souvenir = {
            id: `s${souvenirs.length + 1}`,
            name: SOUVENIR_NAMES[souvenirs.length % SOUVENIR_NAMES.length],
            earnedDay: day,
          };
          nextSouvenirs = [...souvenirs, souvenir];
        }
        const entry: Outing = { key, title: title.slice(0, 120), day, proof, at: Date.now() };
        const nextLog = sameToday ? log.map((o) => (o === sameToday ? entry : o)) : [entry, ...log].slice(0, LOG_MAX);
        set({ log: nextLog, souvenirs: nextSouvenirs, progress: nextProgress });
        useMascotStore.getState().addTreat(treats);
        track('outing');
        return { ok: true, treats, souvenir };
      },
    }),
    {
      name: 'nogoon-outings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<OutingState>;
        const log = Array.isArray(p.log)
          ? p.log.filter((o): o is Outing => !!o && typeof o.key === 'string' && typeof o.day === 'string' && (o.proof === 'self' || o.proof === 'place')).slice(0, LOG_MAX)
          : [];
        const souvenirs = Array.isArray(p.souvenirs)
          ? p.souvenirs.filter((s): s is Souvenir => !!s && typeof s.id === 'string' && typeof s.name === 'string')
          : [];
        return {
          ...current,
          log,
          souvenirs,
          progress: typeof p.progress === 'number' && p.progress >= 0 ? Math.min(SOUVENIR_EVERY - 1, Math.floor(p.progress)) : 0,
          weeklyGoal: typeof p.weeklyGoal === 'number' ? Math.max(1, Math.min(7, Math.floor(p.weeklyGoal))) : DEFAULT_WEEKLY_GOAL,
        };
      },
    },
  ),
);

/** Outings logged in the local week containing `day`. */
export function outingsThisWeek(log: Outing[], day: string = getLocalDateKey()): number {
  const start = weekStart(day);
  return log.filter((o) => o.day >= start).length;
}
