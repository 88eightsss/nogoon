// ─── Companion sprite ─────────────────────────────────────────────────────────
//
// The pixel companion: five evolution stages driven by lifetime walk-aways
//   0 (0–4) Dormant · 1 (5–14) Awakening · 2 (15–29) Standing · 3 (30–59) Powered · 4 (60+) Legendary
// Sprite data lives in constants/sprites.ts (shared with the pack system).

import Svg, { Rect } from 'react-native-svg';
import { CHAR_COLORS, GRIDS } from '@/constants/sprites';
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

/** AsyncStorage key for the chosen companion. */
export const STORAGE_KEY = '@nogoon_goon_character';

const CELL = 8;

export { CHAR_COLORS };

// ─── Sprite renderer ──────────────────────────────────────────────────────────

export function GoonSprite({
  char, stage, size = 1,
}: { char: CharacterId; stage: GoonStage; size?: number }) {
  const grid   = GRIDS[char][stage];
  const px     = CELL * size;
  const colors = CHAR_COLORS[char][stage];
  return (
    <Svg width={10 * px} height={12 * px}>
      {grid.map((row, r) =>
        row.map((val, c) => {
          if (val === 0) return null;
          return (
            <Rect
              key={`${r}-${c}`}
              x={c * px}
              y={r * px}
              width={px - 1}
              height={px - 1}
              fill={colors[val]}
              rx={val === 4 ? 0 : 1}
            />
          );
        })
      )}
    </Svg>
  );
}
