// Day-streak counter, three looks: plain card, flip tiles (Tokyo), visitor counter (Webcore).

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import type { PackManifest } from '@/constants/packs';

export const LANDMARKS = [7, 14, 30, 50, 100, 200, 365, 500, 777, 1000];

export function nextLandmark(d: number): { next: number; prev: number } {
  const next = LANDMARKS.find((n) => n > d) ?? d + 1;
  const prev = [0, ...LANDMARKS].filter((n) => n <= d).pop() ?? 0;
  return { next, prev };
}

// Tally marks in groups of five (four strokes and a slash), capped so it stays tidy.
function Tally({ n, color }: { n: number; color: string }) {
  const MAX = 25;
  const shown = Math.min(n, MAX);
  const groups = Math.ceil(shown / 5);
  const extra = n - shown;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      {Array.from({ length: groups }, (_, g) => {
        const inGroup = Math.min(5, shown - g * 5);
        return (
          <Svg key={g} width={34} height={28}>
            {Array.from({ length: Math.min(4, inGroup) }, (_, i) => (
              <Line key={i} x1={5 + i * 7} y1={3} x2={5 + i * 7 + (i % 2 ? 0.8 : -0.4)} y2={25} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
            ))}
            {inGroup === 5 && <Line x1={1} y1={21} x2={32} y2={6} stroke={color} strokeWidth={2.2} strokeLinecap="round" />}
          </Svg>
        );
      })}
      {extra > 0 && <Text style={{ color, fontFamily: FONTS.body, fontSize: 13 }}>+{extra}</Text>}
    </View>
  );
}

export function Counter({ pack, days }: { pack: PackManifest; days: number }) {
  const { colors, cardStyle } = useTheme();
  const look = pack.parts.page.look;
  const { next, prev } = nextLandmark(days);
  const digits = String(Math.min(days, 9999)).padStart(4, '0').split('');
  const left = next - days;
  const caption = `Next landmark is day ${next}, ${left} day${left === 1 ? '' : 's'} away.`;
  const pct = Math.max(0, Math.min(1, (days - prev) / Math.max(1, next - prev)));

  const kind = pack.parts.page.counter;
  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {kind === 'visitor' ? 'Visitor counter' : 'Day streak'}
      </Text>

      {kind === 'plain' && (
        <Text style={[styles.big, { color: colors.accent }]}>{days}</Text>
      )}

      {kind === 'notebook' && (
        <View style={{ gap: 6 }}>
          <Text style={[styles.big, { color: look.ink ?? colors.accent }]}>Day {days}</Text>
          <Tally n={days} color={look.ink ?? colors.accent} />
        </View>
      )}

      {kind === 'tiles' && (
        <View style={styles.row}>
          {digits.map((d, i) => (
            <View key={i} style={styles.tile}>
              <Text style={styles.tileText}>{d}</Text>
              <View style={styles.tileSeam} />
            </View>
          ))}
        </View>
      )}

      {kind === 'visitor' && (
        <View style={[styles.visitor, { backgroundColor: look.lcdBg ?? '#0B1020' }]}>
          <Text style={[styles.visitorLabel, { color: look.lcdInk ?? '#33ff66' }]}>YOU ARE VISITOR No.</Text>
          <View style={styles.row}>
            {digits.map((d, i) => (
              <View key={i} style={[styles.vCell, { borderColor: (look.lcdInk ?? '#33ff66') + '55' }]}>
                <Text style={[styles.visitorDigits, { color: look.lcdInk ?? '#33ff66', textShadowColor: look.lcdInk ?? '#33ff66' }]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[styles.caption, { color: colors.textSecondary }]}>{caption}</Text>
      <View style={[styles.bar, { backgroundColor: colors.border }]}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:    { padding: SPACING.md, gap: SPACING.sm },
  title:   { fontFamily: FONTS.bodyBold, fontSize: 15 },
  big:     { fontFamily: FONTS.display, fontSize: 44 },
  row:     { flexDirection: 'row', gap: 6 },
  tile:    { flex: 1, height: 52, borderRadius: 8, backgroundColor: '#23232c', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileText:{ fontFamily: FONTS.monoBold, fontSize: 32, color: '#f5f1e8' },
  tileSeam:{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, backgroundColor: 'rgba(0,0,0,0.7)' },
  visitor: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  visitorLabel:  { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1.2 },
  vCell:   { flex: 1, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  visitorDigits: { fontFamily: FONTS.monoBold, fontSize: 28, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  caption: { fontFamily: FONTS.body, fontSize: 12.5 },
  bar:     { height: 6, borderRadius: 6, overflow: 'hidden' },
});
