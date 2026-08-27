// ─── Pet Stat Store ────────────────────────────────────────────────────────────
//
// Per-character hunger, happiness, and energy — each companion evolves
// independently. Feeding, petting, and playing only affect the active character.
//
// Hunger mechanics:
//   • Decays 10 pts/hour when not fed
//   • Restored by feeding (costs 1 feed token)
//
// Happiness mechanics:
//   • Decays 4 pts/hour
//   • Restored by petting (+10) or playing (+8)
//
// Energy mechanics:
//   • Drains 10 pts per play session
//   • Refills 20 pts/hour (resting)
//   • Low energy limits game sessions naturally (soft cap, not hard block)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CharacterId = 0 | 1 | 2;

// ── Decay/restore constants ────────────────────────────────────────────────────

const HUNGER_DECAY_PER_HOUR     = 10;
const HAPPINESS_DECAY_PER_HOUR  = 4;
const ENERGY_FILL_PER_HOUR      = 20;

const FEED_HUNGER_RESTORE       = 35;
const FEED_HAPPINESS_BONUS      = 5;
const PET_HAPPINESS_RESTORE     = 10;
const PLAY_HAPPINESS_RESTORE    = 8;
const PLAY_ENERGY_COST          = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PetStats {
  hunger:     number;  // 0–100  (100 = perfectly fed)
  happiness:  number;  // 0–100
  energy:     number;  // 0–100
  lastSyncAt: number;  // unix ms
}

type CharStats = Record<CharacterId, PetStats>;

const DEFAULT_STATS: PetStats = { hunger: 70, happiness: 80, energy: 100, lastSyncAt: Date.now() };

const DEFAULT_CHAR_STATS: CharStats = {
  0: { ...DEFAULT_STATS },
  1: { ...DEFAULT_STATS },
  2: { ...DEFAULT_STATS },
};

interface PetState {
  stats: CharStats;

  /** Apply time-based decay for a specific character. */
  syncDecay: (charId: CharacterId) => void;

  /** Feed the pet (caller already spent feed token). Returns false if full. */
  feedPet: (charId: CharacterId) => boolean;

  /** Tap/groom the pet — boosts happiness. */
  petPet: (charId: CharacterId) => void;

  /** Play with the pet — boosts happiness, costs energy. Returns false if low energy. */
  playWithPet: (charId: CharacterId) => boolean;

  /** Debug/admin reset for a specific character. */
  resetPet: (charId: CharacterId) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
      stats: DEFAULT_CHAR_STATS,

      syncDecay: (charId) => {
        const char = get().stats[charId];
        const now = Date.now();
        const hoursElapsed = (now - char.lastSyncAt) / 3_600_000;
        if (hoursElapsed < 0.01) return;

        set((s) => ({
          stats: {
            ...s.stats,
            [charId]: {
              hunger:     clamp(char.hunger    - HUNGER_DECAY_PER_HOUR    * hoursElapsed, 0, 100),
              happiness:  clamp(char.happiness - HAPPINESS_DECAY_PER_HOUR * hoursElapsed, 0, 100),
              energy:     clamp(char.energy    + ENERGY_FILL_PER_HOUR     * hoursElapsed, 0, 100),
              lastSyncAt: now,
            },
          },
        }));
      },

      feedPet: (charId) => {
        get().syncDecay(charId);
        const char = get().stats[charId];
        if (char.hunger >= 100) return false;
        set((s) => ({
          stats: {
            ...s.stats,
            [charId]: {
              ...s.stats[charId],
              hunger:    clamp(s.stats[charId].hunger    + FEED_HUNGER_RESTORE,  0, 100),
              happiness: clamp(s.stats[charId].happiness + FEED_HAPPINESS_BONUS, 0, 100),
            },
          },
        }));
        return true;
      },

      petPet: (charId) => {
        get().syncDecay(charId);
        set((s) => ({
          stats: {
            ...s.stats,
            [charId]: {
              ...s.stats[charId],
              happiness: clamp(s.stats[charId].happiness + PET_HAPPINESS_RESTORE, 0, 100),
            },
          },
        }));
      },

      playWithPet: (charId) => {
        get().syncDecay(charId);
        const char = get().stats[charId];
        if (char.energy < PLAY_ENERGY_COST) return false;
        set((s) => ({
          stats: {
            ...s.stats,
            [charId]: {
              ...s.stats[charId],
              energy:    clamp(s.stats[charId].energy    - PLAY_ENERGY_COST,       0, 100),
              happiness: clamp(s.stats[charId].happiness + PLAY_HAPPINESS_RESTORE, 0, 100),
            },
          },
        }));
        return true;
      },

      resetPet: (charId) => {
        set((s) => ({
          stats: {
            ...s.stats,
            [charId]: { hunger: 70, happiness: 80, energy: 100, lastSyncAt: Date.now() },
          },
        }));
      },
    }),
    {
      name: 'nogoon-pet-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ stats: s.stats }),
    },
  ),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Derive a mood label from stats. */
export function getPetMood(stats: Pick<PetStats, 'hunger' | 'happiness' | 'energy'>): string {
  if (stats.hunger < 20)     return 'starving';
  if (stats.happiness < 20)  return 'sad';
  if (stats.energy < 20)     return 'tired';
  if (stats.hunger > 80 && stats.happiness > 80) return 'thriving';
  if (stats.happiness > 70)  return 'happy';
  return 'okay';
}

/** Auto-generated speech based on mood. No emojis. */
export function getPetSpeech(mood: ReturnType<typeof getPetMood>, petName: string): string {
  switch (mood) {
    case 'starving':  return `${petName} is really hungry... please feed me.`;
    case 'sad':       return `${petName} misses you. Come hang out!`;
    case 'tired':     return `${petName} needs a rest. Give me a break!`;
    case 'thriving':  return `${petName} feels amazing! You're crushing it.`;
    case 'happy':     return `${petName} is doing great. Keep it up!`;
    default:          return `${petName} is here. Put the phone down for a bit.`;
  }
}
