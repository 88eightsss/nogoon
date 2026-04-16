// StreakBadge — shows the user's consecutive intentional days.
//
// PHILOSOPHY SHIFT:
// This used to be "Day Streak" framed as retention bait — don't break it or you lose!
// Now it's "Intentional Days" — celebrating what the user DIDN'T mindlessly do.
// No guilt messaging. No "losing" a streak. Just honest encouragement.
//
// The flame gets brighter as the streak grows, but there's no alarm if it resets.

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

interface StreakBadgeProps {
  streak: number;        // Current streak in days
  longestStreak: number; // Personal best
  walkAwayCount?: number; // How many times they played and still walked away
}

export function StreakBadge({ streak, longestStreak, walkAwayCount = 0 }: StreakBadgeProps) {
  // Flame color scales with streak length — but never goes red/urgent
  // 0: dim grey | 3+: warm orange | 7+: bright orange
  const flameColor =
    streak === 0 ? COLORS.textMuted :
    streak < 3   ? '#ff8c00' :
    streak < 7   ? '#ff6b00' :
                   '#ff4500';

  // Milestone message — shown when streak is at a meaningful number
  // Non-manipulative: celebrates the achievement, doesn't threaten loss
  const milestone =
    streak === 3  ? '3 days of pausing first. Real.' :
    streak === 7  ? 'A week of intentional choices.' :
    streak === 14 ? 'Two weeks. You\'re building this.' :
    streak === 30 ? 'A month. You\'ve got this.' :
    null;

  return (
    <Card style={styles.card}>
      {/* Section label — renamed from "Streak" to frame it as encouragement */}
      <Text style={TYPE.label}>Intentional Days</Text>

      {/* Flame icon + number on the same row */}
      <View style={styles.mainRow}>
        <Feather name="flame" size={28} color={flameColor} />
        <Text style={[TYPE.monoL, styles.number]}>{streak}</Text>
      </View>

      {/* Sub-label — no mention of "losing" anything */}
      <Text style={styles.dayLabel}>days stayed intentional</Text>

      {/* Milestone message — shown only at key milestones */}
      {milestone ? (
        <Text style={styles.milestone}>{milestone}</Text>
      ) : (
        /* Walk-away count — shown when there's no milestone to display.
           This is the real success metric: how many times you paused and chose differently. */
        walkAwayCount > 0 ? (
          <Text style={styles.best}>
            {walkAwayCount}× walked away ✓
          </Text>
        ) : (
          <Text style={styles.best}>Best: {longestStreak}d</Text>
        )
      )}
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
    color: COLORS.indigoBright,
  },
  dayLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  milestone: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.indigoBright,
    marginTop: SPACING.sm,
    lineHeight: 15,
  },
  best: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
});
