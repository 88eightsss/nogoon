// Streak milestones as a collection: chips (Core), hanko seals with brush icons
// (Tokyo), 88x31 badges (Webcore), a checklist (Notebook). Earned from the user's
// longest streak; nothing is invented.

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import type { PackManifest } from '@/constants/packs';
import { GlyphIcon, type GlyphName } from './GlyphIcon';

export const STAMPS: { n: number; glyph: GlyphName; label: string }[] = [
  { n: 1,  glyph: 'sprout',   label: '1 day' },
  { n: 3,  glyph: 'leaf',     label: '3 days' },
  { n: 7,  glyph: 'sun',      label: '1 week' },
  { n: 14, glyph: 'moon',     label: '2 weeks' },
  { n: 30, glyph: 'mountain', label: '30 days' },
  { n: 60, glyph: 'wave',     label: '60 days' },
];
const BADGE_BG = ['#1B62C2', '#E8503A', '#0B7A44', '#7A3FD1', '#D98A00', '#0FA68A'];

export function Stamps({ pack, best }: { pack: PackManifest; best: number }) {
  const { colors, cardStyle } = useTheme();
  const look = pack.parts.page.look;
  const kind = pack.parts.page.stamps;
  const title = kind === 'hanko' ? 'Stamp book' : kind === 'badge' ? 'My badges' : kind === 'checklist' ? 'Checked off' : 'Milestones';
  const mark = look.mark ?? colors.accent;
  const got = STAMPS.filter((s) => best >= s.n).length;

  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>{got} of {STAMPS.length}</Text>
      </View>

      {kind === 'checklist' ? (
        <View style={{ gap: 8 }}>
          {STAMPS.map((s) => {
            const earned = best >= s.n;
            return (
              <View key={s.n} style={styles.checkRow}>
                <Feather name={earned ? 'check-square' : 'square'} size={18} color={earned ? colors.accent : colors.textMuted} />
                <Text style={[styles.checkText, { color: earned ? colors.text : colors.textMuted, textDecorationLine: earned ? 'line-through' : 'none' }]}>
                  {s.label} without the scroll
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.grid}>
          {STAMPS.map((s, i) => {
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
                      ? <GlyphIcon name={s.glyph} size={32} color={mark} />
                      : <Text style={[styles.dot, { color: colors.border }]}>·</Text>}
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
                    { backgroundColor: earned ? BADGE_BG[i % BADGE_BG.length] : '#8A9BB5' },
                  ]}>
                    <View style={styles.badgeGloss} pointerEvents="none" />
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
      )}
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
  dot:   { fontFamily: FONTS.bodyBold, fontSize: 19 },
  sub:   { fontFamily: FONTS.body, fontSize: 10.5 },
  badge: { width: 88, height: 31, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,40,0.28)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badgeGloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '48%', backgroundColor: 'rgba(255,255,255,0.22)' },
  badgeText: { fontFamily: FONTS.monoBold, fontSize: 8.5, color: '#ffffff', letterSpacing: 0.5 },
  chip:  { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { fontFamily: FONTS.body, fontSize: 14 },
});
