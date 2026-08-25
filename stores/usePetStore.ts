// ─── Pet Stat Store ────────────────────────────────────────────────────────────
//
// Zustand store tracking the mascot's hunger, happiness, and energy.
// All three decay/fill over real time — syncDecay() is called on app open
// and computes elapsed hours since last sync.
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
//
// Stats are shown only when the user toggles the hidden panel.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Decay/restore constants ────────────────────────────────────────────────────

const HUNGER_DECAY_PER_HOUR     = 10;   // empty in ~10 hours
const HAPPINESS_DECAY_PER_HOUR  = 4;    // empty in ~25 hours
const ENERGY_FILL_PER_HOUR      = 20;   // full in ~5 hours rest

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
}

interface PetState extends PetStats {
  lastSyncAt: number; // unix ms

  /** Must be called on app foreground to apply time-based decay/fill. */
  syncDecay: () => void;

  /**
   * Feed the pet. Returns false if hunger is already full or no tokens
   * (caller is responsible for spending a feed token before calling this).
   */
  feedPet: () => boolean;

  /** Tap/groom the pet — boosts happiness. */
  petPet: () => void;

  /**
   * Play with the pet — boosts happiness, costs energy.
   * Returns false if energy < PLAY_ENERGY_COST.
   */
  playWithPet: () => boolean;

  /** Direct stat setter (for debugging / admin resets). */
  resetPet: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
      hunger:     70,
      happiness:  80,
      energy:     100,
      lastSyncAt: Date.now(),

      syncDecay: () => {
        const { lastSyncAt, hunger, happiness, energy } = get();
        const now          = Date.now();
        const hoursElapsed = (now - lastSyncAt) / 3_600_000;

        // Skip if less than ~36 seconds — avoids micro-drift on rapid re-renders
        if (hoursElapsed < 0.01) return;

        set({
          hunger:     clamp(hunger    - HUNGER_DECAY_PER_HOUR    * hoursElapsed, 0, 100),
          happiness:  clamp(happiness - HAPPINESS_DECAY_PER_HOUR * hoursElapsed, 0, 100),
          energy:     clamp(energy    + ENERGY_FILL_PER_HOUR     * hoursElapsed, 0, 100),
          lastSyncAt: now,
        });
      },

      feedPet: () => {
        get().syncDecay();
        const { hunger } = get();
        if (hunger >= 100) return false;
        set((s) => ({
          hunger:    clamp(s.hunger    + FEED_HUNGER_RESTORE,   0, 100),
          happiness: clamp(s.happiness + FEED_HAPPINESS_BONUS,  0, 100),
        }));
        return true;
      },

      petPet: () => {
        get().syncDecay();
        set((s) => ({
          happiness: clamp(s.happiness + PET_HAPPINESS_RESTORE, 0, 100),
        }));
      },

      playWithPet: () => {
        get().syncDecay();
        const { energy } = get();
        if (energy < PLAY_ENERGY_COST) return false;
        set((s) => ({
          energy:    clamp(s.energy    - PLAY_ENERGY_COST,       0, 100),
          happiness: clamp(s.happiness + PLAY_HAPPINESS_RESTORE, 0, 100),
        }));
        return true;
      },

      resetPet: () => {
        set({ hunger: 70, happiness: 80, energy: 100, lastSyncAt: Date.now() });
      },
    }),
    {
      name: 'nogoon-pet',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        hunger:     s.hunger,
        happiness:  s.happiness,
        energy:     s.energy,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Derive a mood label from stats. */
export function getPetMood(stats: PetStats): string {
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
