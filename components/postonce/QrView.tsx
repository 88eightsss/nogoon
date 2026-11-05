// A QR code drawn with SVG. Uses lib/qr.ts (no library). Includes the four-module quiet zone so it scans.
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { encodeQR } from '@/lib/qr';

export function QrView({ text, size, fg = '#000000', bg = '#ffffff' }: { text: string; size: number; fg?: string; bg?: string }) {
  const { d, n } = useMemo(() => {
    const m = encodeQR(text);
    const q = 4;
    let path = '';
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) if (m[r][c]) path += `M${c + q} ${r + q}h1v1h-1z`;
    return { d: path, n: m.length + q * 2 };
  }, [text]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR code for the link">
      <Rect x={0} y={0} width={n} height={n} fill={bg} />
      <Path d={d} fill={fg} />
    </Svg>
  );
}
