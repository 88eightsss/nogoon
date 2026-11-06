// ─── Week strip ──────────────────────────────────────────────────────────────────────────────
// Seven small dots, today on the right. Filled when there was at least one walk-away that day.
// Only fills, never shows a missed day as a gap with a cross, and never resets: days gained is
// read separately from the user store and only goes up.

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeekStrip() {
  const { colors } = useTheme();
  const daily = useUserStore((s) => s.dailyWalkAways);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { key: getLocalDateKey(d), letter: LETTERS[d.getDay()], today: i === 6 };
  });
  return (
    <View style={styles.row} accessibilityLabel="This week">
      {days.map((d) => {
        const on = (daily?.[d.key] ?? 0) > 0;
        return (
          <View key={d.key} style={styles.cell}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: on ? colors.text : d.today ? 'transparent' : colors.border,
                  borderColor: on || d.today ? colors.text : colors.border,
                  borderWidth: d.today && !on ? 2 : 0,
                },
              ]}
            />
            <Text style={[styles.letter, { color: d.today ? colors.text : colors.textMuted }]}>{d.letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.xs },
  cell: { alignItems: 'center', gap: 4, flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, borderStyle: 'solid' },
  letter: { fontFamily: FONTS.mono, fontSize: 11 },
});
