// Draws a companion from the shared sprite data. `mono` renders it as a single-ink
// LCD sprite (Tokyo egg, Webcore counter); otherwise it uses the real stage colors.

import Svg, { Rect } from 'react-native-svg';
import { GRIDS, CHAR_COLORS, type GoonStage } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';

const MONO_OPACITY: Record<number, number> = { 1: 0.72, 2: 1, 3: 0.35 };

export function PackSprite({
  char, stage, cell = 8, mono = false, ink = '#222222',
}: { char: CharacterId; stage: GoonStage; cell?: number; mono?: boolean; ink?: string }) {
  const grid = GRIDS[char][stage];
  const pal = CHAR_COLORS[char][stage];
  return (
    <Svg width={10 * cell} height={12 * cell}>
      {grid.map((row, r) =>
        row.map((v, c) => {
          if (v === 0) return null;
          if (mono && v === 4) return null;
          return (
            <Rect
              key={`${r}-${c}`}
              x={c * cell} y={r * cell} width={cell} height={cell}
              fill={mono ? ink : pal[v]}
              opacity={mono ? MONO_OPACITY[v] : 1}
            />
          );
        })
      )}
    </Svg>
  );
}
