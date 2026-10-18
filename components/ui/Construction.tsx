// ─── Caution tape and the Under construction sign ────────────────────────────
// For parts of the app that are built but not fully live yet (see constants/construction.ts).
// Fixed hazard yellow and ink, so it reads the same on every theme.

import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Polygon, Rect, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { PackSprite } from '@/components/page/PackSprite';
import { CHARACTER_LABELS, useMascot } from '@/components/page/useCharacter';

const YELLOW = '#FFD23F';
const INK = '#1B1B1B';

/** A strip of diagonal yellow and black stripes. */
export function ConstructionTape({ height = 16, tilt = 0 }: { height?: number; tilt?: number }) {
  const [w, setW] = useState(0);
  const step = height * 1.6;
  const count = w > 0 ? Math.ceil(w / step) + 2 : 0;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{ height, overflow: 'hidden', transform: [{ rotate: `${tilt}deg` }] }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && (
        <Svg width={w} height={height}>
          <Rect x={0} y={0} width={w} height={height} fill={YELLOW} />
          {Array.from({ length: count }).map((_, i) => {
            const x = i * step - height;
            return <Polygon key={i} points={`${x},${height} ${x + height},0 ${x + height + step / 2},0 ${x + step / 2},${height}`} fill={INK} />;
          })}
        </Svg>
      )}
    </View>
  );
}

/** A little hard hat for the companion. */
function HardHat() {
  return (
    <Svg width={36} height={16}>
      <Path d="M5 13 A13 11 0 0 1 31 13 Z" fill={YELLOW} stroke={INK} strokeWidth={2} />
      <Rect x={1} y={12} width={34} height={3.5} rx={1.5} fill={YELLOW} stroke={INK} strokeWidth={2} />
      <Rect x={16} y={3} width={4} height={8} fill={INK} opacity={0.35} />
    </Svg>
  );
}

/** The full sign: tape above and below, your companion in a hard hat, and a short note. */
export function ConstructionSign({ note }: { note: string }) {
  const { char, stage } = useMascot();
  const name = CHARACTER_LABELS[char];
  return (
    <View style={s.wrap} accessible accessibilityLabel={`Under construction. ${note}`}>
      <ConstructionTape tilt={-1.2} />
      <View style={s.sign}>
        <View style={s.pal}>
          <View style={s.hat}><HardHat /></View>
          <PackSprite char={char} stage={stage} cell={3} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            <Feather name="tool" size={14} color={INK} />
            <Text style={s.title}>UNDER CONSTRUCTION</Text>
          </View>
          <Text style={s.note}>{note}</Text>
          <Text style={s.by}>{name} is on it.</Text>
        </View>
      </View>
      <ConstructionTape tilt={1.2} />
    </View>
  );
}

/** A small label for rows and section titles. */
export function ConstructionBadge({ label = 'Under construction' }: { label?: string }) {
  return (
    <View style={s.badge} accessible accessibilityLabel={label}>
      <Feather name="tool" size={10} color={INK} />
      <Text style={s.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 0 },
  sign: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#FFF1B8', borderLeftWidth: 2, borderRightWidth: 2, borderColor: INK, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  pal: { width: 40, height: 52, alignItems: 'center', justifyContent: 'flex-end' },
  hat: { position: 'absolute', top: 2, zIndex: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: YELLOW, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 2, borderColor: INK },
  title: { fontFamily: FONTS.display, fontSize: 12, letterSpacing: 0.8, color: INK },
  note: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: '#4A3C00' },
  by: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#4A3C00' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: YELLOW, borderColor: INK, borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: FONTS.bodyBold, fontSize: 9, letterSpacing: 0.6, color: INK },
});
