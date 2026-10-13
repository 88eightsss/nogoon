// Streak milestones as a collection: chips (Core), hanko seals (Tokyo), 88x31
// badges (Webcore). Earned from the user's longest streak; nothing is invented.

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import type { PackManifest } from '@/constants/packs';

export const STAMPS = [
  { n: 1,  kanji: '初日', label: '1 day' },
  { n: 3,  kanji: '三日', label: '3 days' },
  { n: 7,  kanji: '七日', label: '1 week' },
  { n: 14, kanji: '十四', label: '2 weeks' },
  { n: 30, kanji: '三十', label: '30 days' },
  { n: 60, kanji: '六十', label: '60 days' },
];
const BADGE_BG = ['#000080', '#800000', '#006400', '#800080', '#806000', '#006666'];

export function Stamps({ pack, best }: { pack: PackManifest; best: number }) {
  const { colors, cardStyle } = useTheme();
  const look = pack.parts.page.look;
  const kind = pack.parts.page.stamps;
  const title = kind === 'hanko' ? 'Stamp book' : kind === 'badge' ? 'My badges' : 'Milestones';
  const mark = look.mark ?? colors.accent;
  const got = STAMPS.filter((s) => best >= s.n).length;

  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>{got} of {STAMPS.length}</Text>
      </View>
      <View style={styles.grid}>
        {STAMPS.map((s) => {
          const earned = best >= s.n;
          if (kind === 'hanko') {
            return (
              <View key={s.n} style={styles.cell3}>
                <View style={[
                  styles.hanko,
                  earned
                    ? { borderColor: mark, transform: [{ rotate: `${((s.n * 7) % 9) - 4}deg` }] }
                    : { borderColor: colors.border, borderStyle: 'dashed' },
                ]}>
                  {earned
                    ? [...s.kanji].map((ch, i) => <Text key={i} style={[styles.hankoChar, { color: mark }]}>{ch}</Text>)
                    : <Text style={[styles.hankoChar, { color: colors.border }]}>·</Text>}
                </View>
                <Text style={[styles.sub, { color: colors.textMuted }]}>{earned ? s.label : `${s.n} days`}</Text>
              </View>
            );
          }
          if (kind === 'badge') {
            return (
              <View key={s.n} style={styles.cell2}>
                <View style={[
                  styles.badge,
                  {
                    backgroundColor: earned ? BADGE_BG[STAMPS.indexOf(s) % BADGE_BG.length] : '#808080',
                    borderTopColor: look.hi ?? '#fff', borderLeftColor: look.hi ?? '#fff',
                    borderRightColor: look.lo ?? '#404040', borderBottomColor: look.lo ?? '#404040',
                  },
                ]}>
                  <Text style={styles.badgeText}>{earned ? `${s.label.toUpperCase()} CLEAN` : 'LOCKED'}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={s.n} style={styles.cell3}>
              <View style={[styles.chip, { borderColor: earned ? colors.accent : colors.border, backgroundColor: earned ? colors.accentDim : 'transparent' }]}>
                <Text style={[styles.chipText, { color: earned ? colors.accent : colors.textMuted }]}>{s.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:  { padding: SPACING.md, gap: SPACING.sm },
  head:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  count: { fontFamily: FONTS.body, fontSize: 12 },
  grid:  { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  cell3: { width: '33.33%', alignItems: 'center', gap: 4 },
  cell2: { width: '50%', alignItems: 'center' },
  hanko: { width: 54, height: 54, borderWidth: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hankoChar: { fontFamily: FONTS.bodyBold, fontSize: 19, lineHeight: 21 },
  sub:   { fontFamily: FONTS.body, fontSize: 10.5 },
  badge: { width: 88, height: 31, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.monoBold, fontSize: 8.5, color: '#ffffff', letterSpacing: 0.5 },
  chip:  { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
});
