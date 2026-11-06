// ─── Days gained card (Simple look) ──────────────────────────────────────────────────────────
// The number you care about, big and in the mono face, with this week's dots under it.
// Days gained only goes up (read from the user store), never resets.

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { WeekStrip } from './WeekStrip';

export function DaysCard() {
  const { colors, cardStyle } = useTheme();
  const days = useUserStore((s) => s.totalActiveDays);
  return (
    <View
      style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      accessibilityLabel={`${days} day${days === 1 ? '' : 's'} gained`}
    >
      <View style={styles.top}>
        <Text style={[styles.num, { color: colors.text }]}>{days}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{days === 1 ? 'day gained' : 'days gained'}</Text>
      </View>
      <WeekStrip />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.lg, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  num: { fontFamily: FONTS.mono, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  label: { fontFamily: FONTS.body, fontSize: 15 },
});
