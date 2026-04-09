// DailyChallengeCard — highlights today's daily challenge.
// Completing the daily challenge earns bonus points and XP.
// This card is elevated (lighter background) to make it stand out from other cards.
//
// In a future milestone, the challenge will be fetched from Supabase.
// For now it's hardcoded so the UI looks right.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

// The shape of a daily challenge
interface Challenge {
  title: string;
  description: string;
  target: number;      // Total steps needed (e.g., 3 games)
  completed: number;   // Steps done so far
  rewardPoints: number;
  rewardXP: number;
}

// Hardcoded challenge for now — will be dynamic in Milestone 2+
const TODAY_CHALLENGE: Challenge = {
  title: 'Mindful Moments',
  description: 'Complete 3 games without unlocking a blocked site',
  target: 3,
  completed: 1,
  rewardPoints: 150,
  rewardXP: 50,
};

interface DailyChallengeCardProps {
  alreadyCompleted?: boolean;
  onPress?: () => void; // Called when the user taps "Play Now"
}

export function DailyChallengeCard({
  alreadyCompleted = false,
  onPress,
}: DailyChallengeCardProps) {
  const challenge = TODAY_CHALLENGE;
  const progressPercent = challenge.completed / challenge.target; // 0–1
  const isDone = alreadyCompleted || challenge.completed >= challenge.target;

  return (
    // 'elevated' makes this card slightly brighter to draw the eye
    <Card elevated style={styles.card}>
      {/* Header row with calendar icon and label */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar" size={16} color={COLORS.cyan} />
          <Text style={[TYPE.label, styles.headerLabel]}>Daily Challenge</Text>
        </View>

        {/* Reward badges */}
        <View style={styles.rewardRow}>
          <Text style={styles.rewardText}>+{challenge.rewardPoints} pts</Text>
          <Text style={styles.rewardDivider}>·</Text>
          <Text style={styles.rewardText}>+{challenge.rewardXP} XP</Text>
        </View>
      </View>

      {/* Challenge title */}
      <Text style={[TYPE.headingS, styles.title]}>{challenge.title}</Text>

      {/* Challenge description */}
      <Text style={[TYPE.bodyS, styles.description]}>{challenge.description}</Text>

      {/* Progress bar + step count */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progressPercent * 100, 100)}%`,
                backgroundColor: isDone ? COLORS.green : COLORS.cyan,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {isDone ? 'Complete!' : `${challenge.completed} / ${challenge.target}`}
        </Text>
      </View>

      {/* CTA button or completed state */}
      {isDone ? (
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
          <Text style={styles.completedText}>Challenge completed</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={onPress}
          activeOpacity={0.75}
        >
          <Text style={styles.buttonText}>Play Now</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.background} />
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    // Cyan accent border to make this card pop
    borderColor: COLORS.cyan + '44',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerLabel: {
    color: COLORS.cyan,
    marginLeft: SPACING.xs,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.cyan,
  },
  rewardDivider: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  title: {
    marginBottom: SPACING.xs,
  },
  description: {
    marginBottom: SPACING.md,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  buttonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.background,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  completedText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.green,
  },
});
