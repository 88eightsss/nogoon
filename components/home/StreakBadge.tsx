// ConsistencyBadge (StreakBadge.tsx) — 30-day rolling consistency score
//
// PHILOSOPHY: Streaks punish missed days catastrophically and create anxiety.
// Consistency % is resilient — a bad day barely moves the needle, but a good
// month shows clearly. "78% consistent over 30 days" is more honest and more
// motivating than "14-day streak" that resets to 0 on one off day.
//
// Secondary: streak is still shown small for users who track it personally.

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { computeConsistencyScore } from '@/utils/consistencyScore';

interface StreakBadgeProps {
  streak: number;
  longestStreak: number;
  walkAwayCount?: number;
  freezeTokens?: number;
  dailyGateFires: Record<string, number>;
  dailyWalkAways: Record<string, number>;
}

const GRADE_COLOR: Record<string, string> = {
  S: COLORS.indigoBright,
  A: COLORS.green,
  B: COLORS.cyan,
  C: '#e0a500',
  D: COLORS.danger,
};

export function StreakBadge({
  streak,
  longestStreak,
  walkAwayCount = 0,
  freezeTokens = 0,
  dailyGateFires,
  dailyWalkAways,
}: StreakBadgeProps) {
  const consistency = computeConsistencyScore(dailyGateFires, dailyWalkAways);
  const gradeColor = GRADE_COLOR[consistency.grade] ?? COLORS.textMuted;

  // Zero state — no gate fires recorded yet
  if (consistency.daysActive === 0) {
    return (
      <Card style={styles.card}>
        <Text style={TYPE.label}>Consistency</Text>
        <View style={styles.mainRow}>
          <Feather name="activity" size={26} color={COLORS.textMuted} />
        </View>
        <Text style={styles.sub}>
          {walkAwayCount > 0 ? 'Keep going to build your score' : 'Walk away once to start tracking'}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={TYPE.label}>Consistency</Text>

      <View style={styles.mainRow}>
        <Text style={[styles.score, { color: gradeColor }]}>
          {consistency.score}%
        </Text>
        <View style={[styles.gradePill, { backgroundColor: gradeColor + '22' }]}>
          <Text style={[styles.grade, { color: gradeColor }]}>{consistency.grade}</Text>
        </View>
      </View>

      <Text style={styles.sub}>
        {consistency.daysWon}/{consistency.daysActive} days walked away
      </Text>

      {streak > 0 && (
        <View style={styles.streakRow}>
          <Feather name="zap" size={10} color={COLORS.textMuted} />
          <Text style={styles.streakText}>{streak}d streak</Text>
          {freezeTokens > 0 && (
            <>
              <Feather name="shield" size={10} color={COLORS.cyan} style={{ marginLeft: 6 }} />
              <Text style={[styles.streakText, { color: COLORS.cyan }]}>
                {freezeTokens}×
              </Text>
            </>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  score: {
    fontFamily: FONTS.display,
    fontSize: 36,
    lineHeight: 40,
  },
  gradePill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  grade: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: SPACING.sm,
  },
  streakText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
  },
});
