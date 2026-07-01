// DailyChallengeCard — highlights today's daily challenge.
// Rotates through the standard game pool daily using a date-based seed.
// "Play Now" launches that specific game in the Arcade.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { getTodaysGame } from '@/constants/games';

interface DailyChallengeCardProps {
  alreadyCompleted?: boolean;
  onPress?: (gameId: string) => void; // Called with today's game ID
}

export function DailyChallengeCard({
  alreadyCompleted = false,
  onPress,
}: DailyChallengeCardProps) {
  const game = getTodaysGame();
  const isDone = alreadyCompleted;

  return (
    <Card elevated style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Feather name="calendar" size={16} color={COLORS.cyan} />
          <Text style={[TYPE.label, styles.headerLabel]}>Daily Challenge</Text>
        </View>
        <View style={styles.rewardRow}>
          <Text style={styles.rewardText}>+150 pts</Text>
          <Text style={styles.rewardDivider}>·</Text>
          <Text style={styles.rewardText}>+50 XP</Text>
        </View>
      </View>

      {/* Today's game */}
      <View style={styles.gameRow}>
        <Text style={styles.gameEmoji}>{game.emoji}</Text>
        <Text style={[TYPE.headingS, styles.title]}>{game.name}</Text>
      </View>

      <Text style={[TYPE.bodyS, styles.description]}>{game.description}</Text>

      {/* CTA or completed */}
      {isDone ? (
        <View style={styles.completedBadge}>
          <Feather name="check-circle" size={16} color={COLORS.green} />
          <Text style={styles.completedText}>Done for today — come back tomorrow</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={() => onPress?.(game.id)}
          activeOpacity={0.75}
        >
          <Text style={styles.buttonText}>Play Now</Text>
          <Feather name="arrow-forward" size={16} color={COLORS.background} />
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
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  gameEmoji: {
    fontSize: 24,
  },
  title: {
    marginBottom: 0,
  },
  description: {
    marginBottom: SPACING.md,
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
    color: COLORS.indigoBright,
  },
});
