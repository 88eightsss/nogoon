// StreakBadge — shows the user's current daily streak with a flame icon.
// A streak is the number of consecutive days the user has engaged with GATE.
// Keeping the streak visible motivates daily use (a core habit-loop mechanic).

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

interface StreakBadgeProps {
  streak: number;        // Current streak in days
  longestStreak: number; // Personal best
}

export function StreakBadge({ streak, longestStreak }: StreakBadgeProps) {
  // Pick the flame color based on streak length:
  // 0–2 days: dim  |  3–6: orange  |  7+: fully lit
  const flameColor =
    streak === 0 ? COLORS.textMuted :
    streak < 3   ? '#ff8c00' :
    streak < 7   ? '#ff6b00' :
                   '#ff4500';

  return (
    <Card style={styles.card}>
      {/* Section label */}
      <Text style={TYPE.label}>Streak</Text>

      {/* Flame icon + number on the same row */}
      <View style={styles.mainRow}>
        <Ionicons name="flame" size={28} color={flameColor} />
        <Text style={[TYPE.monoL, styles.number]}>{streak}</Text>
      </View>

      {/* Sub-label */}
      <Text style={styles.dayLabel}>day streak</Text>

      {/* Personal best */}
      <Text style={styles.best}>Best: {longestStreak}d</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // The card fills half the row (parent sets flex: 1 on each card)
  card: {
    flex: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  number: {
    // Override the default mono color to green for streak emphasis
    color: COLORS.green,
  },
  dayLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  best: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
});
