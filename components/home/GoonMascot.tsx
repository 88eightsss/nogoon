// ─── Companion sprite ─────────────────────────────────────────────────────────
//
// The pixel companion: five evolution stages driven by how much that companion has been fed (see stores/useMascotStore.ts)
//   0 (0–4) Dormant · 1 (5–14) Awakening · 2 (15–29) Standing · 3 (30–59) Powered · 4 (60+) Legendary
// Sprite data lives in constants/sprites.ts (shared with the pack system).

import { CHAR_COLORS } from '@/constants/sprites';
import { CompanionArt } from '@/components/home/CompanionArt';
import type { CharacterId } from '@/stores/usePetStore';


// ─── Stage system ─────────────────────────────────────────────────────────────

export type GoonStage = 0 | 1 | 2 | 3 | 4;

export function getGoonStage(walkAwayCount: number): GoonStage {
  if (walkAwayCount >= 60) return 4;
  if (walkAwayCount >= 30) return 3;
  if (walkAwayCount >= 15) return 2;
  if (walkAwayCount >= 5)  return 1;
  return 0;
}

export { CHAR_COLORS };

// ─── Sprite renderer ──────────────────────────────────────────────────────────
// Uses the shaded 32x32 companion art (constants/companionArt.ts). The old 10x12 grids in constants/sprites.ts
// are still used by the pack system's single-ink LCD mode.

export function GoonSprite({
  char, stage, size = 1,
}: { char: CharacterId; stage: GoonStage; size?: number }) {
  return <CompanionArt char={char} stage={stage} size={size} />;
}
