import Svg, { Rect } from 'react-native-svg';
import { PIXEL_PALETTE, PIXEL_SIZE } from '@/stores/useMakeStore';

/** Draws a saved pixel picture. `cells` is PIXEL_SIZE * PIXEL_SIZE digits; 0 is empty. */
export function PixelView({ cells, size, bg }: { cells: string; size: number; bg: string }) {
  const n = PIXEL_SIZE;
  const c = size / n;
  return (
    <Svg width={size} height={size} accessibilityLabel="A pixel picture you made">
      <Rect x={0} y={0} width={size} height={size} fill={bg} />
      {Array.from(cells).map((ch, i) => {
        const v = Number(ch);
        if (!v || !PIXEL_PALETTE[v]) return null;
        return <Rect key={i} x={(i % n) * c} y={Math.floor(i / n) * c} width={c} height={c} fill={PIXEL_PALETTE[v]} />;
      })}
    </Svg>
  );
}
