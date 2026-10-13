// Brush-style pictograms drawn as strokes. They stand in for kanji: the same
// stamp-and-ink feel, but they are icons of the thing (sun, moon, leaf...) so
// nothing depends on reading or translating Japanese.

import Svg, { Path, Circle, Line } from 'react-native-svg';

export type GlyphName = 'sprout' | 'leaf' | 'sun' | 'moon' | 'mountain' | 'wave' | 'star' | 'torii' | 'blossom';

export function GlyphIcon({ name, size = 28, color = '#D3382C', weight = 4.5 }: { name: GlyphName; size?: number; color?: string; weight?: number }) {
  const p = { stroke: color, strokeWidth: weight, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {name === 'sprout' && (<>
        <Path d="M24 42 L24 24" {...p} />
        <Path d="M24 26 C14 26 9 20 9 12 C18 12 24 17 24 26 Z" {...p} />
        <Path d="M24 22 C24 15 29 10 38 10 C38 18 33 22 24 22 Z" {...p} />
      </>)}
      {name === 'leaf' && (<>
        <Path d="M10 38 C8 20 20 8 40 8 C40 28 28 40 10 38 Z" {...p} />
        <Path d="M10 38 L30 18" {...p} />
      </>)}
      {name === 'sun' && (<>
        <Circle cx={24} cy={24} r={8} {...p} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const r = (a * Math.PI) / 180;
          return <Line key={a} x1={24 + Math.cos(r) * 14} y1={24 + Math.sin(r) * 14} x2={24 + Math.cos(r) * 20} y2={24 + Math.sin(r) * 20} {...p} />;
        })}
      </>)}
      {name === 'moon' && (<>
        <Path d="M32 8 C20 10 14 20 18 31 C22 41 34 44 42 36 C32 38 24 32 24 22 C24 16 27 11 32 8 Z" {...p} />
      </>)}
      {name === 'mountain' && (<>
        <Path d="M5 40 L19 14 L28 28 L33 21 L43 40 Z" {...p} />
        <Path d="M15 21 L19 26 L23 21" {...p} />
      </>)}
      {name === 'wave' && (<>
        <Path d="M6 16 C12 8 18 8 24 16 C30 24 36 24 42 16" {...p} />
        <Path d="M6 26 C12 18 18 18 24 26 C30 34 36 34 42 26" {...p} />
        <Path d="M6 36 C12 28 18 28 24 36 C30 44 36 44 42 36" {...p} />
      </>)}
      {name === 'star' && (
        <Path d="M24 6 L29 18 L42 19 L32 28 L35 41 L24 34 L13 41 L16 28 L6 19 L19 18 Z" {...p} />
      )}
      {name === 'torii' && (<>
        <Path d="M5 12 Q24 6 43 12" {...p} />
        <Path d="M9 19 L39 19" {...p} />
        <Path d="M14 12 L14 42" {...p} />
        <Path d="M34 12 L34 42" {...p} />
      </>)}
      {name === 'blossom' && (<>
        {[0, 72, 144, 216, 288].map((a) => {
          const r = ((a - 90) * Math.PI) / 180;
          return <Circle key={a} cx={24 + Math.cos(r) * 11} cy={24 + Math.sin(r) * 11} r={7} {...p} />;
        })}
        <Circle cx={24} cy={24} r={2.5} stroke={color} strokeWidth={2} fill={color} />
      </>)}
    </Svg>
  );
}
