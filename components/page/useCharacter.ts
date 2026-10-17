// Which companion is active, and how far along it is. Only the active companion is fed (one feeding
// per walk-away), so its stage comes from its own count, not from lifetime walk-aways.

import { CHARACTER_NAMES } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';
import { nextStageAt, stageOf, useMascotStore, type MascotStage } from '@/stores/useMascotStore';

export const CHARACTER_LABELS: Record<CharacterId, string> = CHARACTER_NAMES;

export function useCharacter(): CharacterId {
  return useMascotStore((s) => s.active);
}

export function useMascot(): { char: CharacterId; fed: number; stage: MascotStage; next: number | null } {
  const char = useMascotStore((s) => s.active);
  const fed = useMascotStore((s) => s.fed[s.active] ?? 0);
  return { char, fed, stage: stageOf(fed), next: nextStageAt(fed) };
}
