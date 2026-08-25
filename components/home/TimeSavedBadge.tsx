// TimeSavedBadge — shows estimated time reclaimed from distraction.
//
// WHY TIME, NOT POINTS:
// Points are circular (earn → spend to unlock the thing you're blocking).
// Time saved is directly meaningful — it maps to the user's stated intention goal.
// "You've saved 4h 20m this week" is more motivating than "1,250 points available."
//
// Estimate: each walk-away saves ~20 minutes of mindless scrolling.
// This is conservative and based on average Instagram/TikTok session length.

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

const MINS_PER_WALKAWAY = 20;

interface TimeSavedBadgeProps {
  walkAwayCount: number;    // lifetime total
  walkAwaysThisWeek: number; // last 7 days (index 6 = today)
  level: string;
  xpPercent: number; // 0–1
}

function formatTime(totalMinutes: number): { value: string; unit: string } {
  if (totalMinutes < 60) return { value: String(totalMinutes), unit: 'min' };
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { value: m > 0 ? `${h}h ${m}m` : `${h}h`, unit: 'saved' };
}

export function TimeSavedBadge({ walkAwayCount, walkAwaysThisWeek, level, xpPercent }: TimeSavedBadgeProps) {
  const lifetimeMinutes = walkAwayCount * MINS_PER_WALKAWAY;
  const weekMinutes     = walkAwaysThisWeek * MINS_PER_WALKAWAY;
  const { value, unit } = formatTime(lifetimeMinutes);

  return (
    <Card style={styles.card}>
      <Text style={TYPE.label}>Time Reclaimed</Text>

      <View style={styles.mainRow}>
        <Feather name="clock" size={20} color={COLORS.green} />
        <Text style={[styles.value, { color: COLORS.green }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {weekMinutes > 0 ? (
        <Text style={styles.sub}>+{formatTime(weekMinutes).value} this week</Text>
      ) : (
        <Text style={styles.sub}>~{MINS_PER_WALKAWAY} min per walk-away</Text>
      )}

      {/* Level progress — demoted to secondary, small */}
      <View style={styles.levelRow}>
        <Text style={styles.levelLabel}>{level}</Text>
      </View>
      <View style={styles.xpBarTrack}>
        <View style={[styles.xpBarFill, { width: `${Math.round(xpPercent * 100)}%` }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  value: {
    fontFamily: FONTS.display,
    fontSize: 28,
    lineHeight: 32,
  },
  unit: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelRow: {
    marginTop: SPACING.sm,
  },
  levelLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  xpBarTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: 2,
  },
});
