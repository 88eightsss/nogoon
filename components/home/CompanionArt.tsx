// ─── Companion art renderer ───────────────────────────────────────────────────────────────────────────
//
// Draws a companion from constants/companionArt.ts (32 by 32 shaded sprites, generated from the design
// sprite engine). One <Path> per colour keeps it light. Stages: 0 Dormant egg, 1 Awakening, 2 Standing,
// 3 Powered, 4 Legendary. `size` matches the old 10x12 sprite scale (size 1 = 80 wide, 96 tall box).

import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COMPANION_ART, type Look } from '@/constants/companionArt';

const ALPH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

type Layer = { fill: string; opacity: number; d: string };
const cache = new Map<string, Layer[]>();

function layersFor(char: number, stage: number, look: Look): Layer[] {
  const key = `${char}:${stage}:${look}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = COMPANION_ART[char]?.[stage]?.[look];
  if (!sprite) return [];
  const pal = sprite.p.split(' ').map((entry) => {
    const [hex, a] = entry.split('@');
    return { fill: `#${hex}`, opacity: a ? parseFloat(a) : 1 };
  });
  const ds: string[] = pal.map(() => '');
  sprite.r.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x += 1; continue; }
      let x2 = x;
      while (x2 + 1 < row.length && row[x2 + 1] === ch) x2 += 1;
      const i = ALPH.indexOf(ch);
      const w = x2 - x + 1;
      if (i >= 0 && i < ds.length) ds[i] += `M${x} ${y}h${w}v1h-${w}z`;
      x = x2 + 1;
    }
  });
  const layers = pal.map((p, i) => ({ ...p, d: ds[i] })).filter((l) => l.d.length > 0);
  cache.set(key, layers);
  return layers;
}

export function CompanionArt({
  char, stage, look = 'simple', size = 1,
}: { char: number; stage: number; look?: Look; size?: number }) {
  const side = 96 * size;
  const layers = layersFor(char, stage, look);
  return (
    <View style={{ width: 80 * size, height: 96 * size, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
      <Svg width={side} height={side} viewBox="0 0 32 32" style={{ marginBottom: -3 * size }}>
        {layers.map((l, i) => (
          <Path key={i} d={l.d} fill={l.fill} fillOpacity={l.opacity} />
        ))}
      </Svg>
    </View>
  );
}
