// PointsBadge — shows the user's current spendable points balance.
// Points are earned by completing games and spent to unlock blocked sites
// for 10 minutes (costs 200 points and resets the streak).
// Using JetBrains Mono for the number makes it feel like a currency counter.

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

interface PointsBadgeProps {
  points: number;
  level: string; // e.g. "Explorer"
  xpPercent: number; // 0–1, how far through current level
}

export function PointsBadge({ points, level, xpPercent }: PointsBadgeProps) {
  // Format points with a comma separator for readability (e.g. 1,250)
  const formattedPoints = points.toLocaleString();

  return (
    <Card style={styles.card}>
      {/* Section label */}
      <Text style={TYPE.label}>Points</Text>

      {/* Star icon + number */}
      <View style={styles.mainRow}>
        <Feather name="star" size={22} color={COLORS.purple} />
        <Text style={[TYPE.monoL, styles.number]}>{formattedPoints}</Text>
      </View>

      <Text style={styles.subLabel}>available</Text>

      {/* XP level + thin progress bar */}
      <View style={styles.levelRow}>
        <Text style={styles.levelLabel}>{level}</Text>
      </View>
      <View style={styles.xpBarTrack}>
        <View
          style={[
            styles.xpBarFill,
            // The bar width is a percentage of the full track
            { width: `${Math.round(xpPercent * 100)}%` },
          ]}
        />
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
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  number: {
    color: COLORS.purple,
  },
  subLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
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
