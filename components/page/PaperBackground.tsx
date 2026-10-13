// Ruled / grid / dotted paper behind a page, drawn once with an SVG pattern.

import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line, Circle } from 'react-native-svg';
import type { PaperStyle } from '@/constants/packs';

export function PaperBackground({ paper, line, margin }: { paper: PaperStyle; line: string; margin?: string }) {
  const { width, height } = useWindowDimensions();
  if (paper === 'none') return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {paper === 'ruled' && (
          <Pattern id="p" width={width} height={28} patternUnits="userSpaceOnUse" y={14}>
            <Line x1={0} y1={27} x2={width} y2={27} stroke={line} strokeWidth={1} />
          </Pattern>
        )}
        {paper === 'grid' && (
          <Pattern id="p" width={24} height={24} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={24} y2={0} stroke={line} strokeWidth={1} />
            <Line x1={0} y1={0} x2={0} y2={24} stroke={line} strokeWidth={1} />
          </Pattern>
        )}
        {paper === 'dots' && (
          <Pattern id="p" width={24} height={24} patternUnits="userSpaceOnUse">
            <Circle cx={12} cy={12} r={1.3} fill={line} />
          </Pattern>
        )}
      </Defs>
      <Rect width={width} height={height} fill="url(#p)" />
      {paper === 'ruled' && margin ? <Line x1={46} y1={0} x2={46} y2={height} stroke={margin} strokeWidth={1.5} /> : null}
    </Svg>
  );
}
