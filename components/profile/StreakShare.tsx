// ─── StreakShare ──────────────────────────────────────────────────────────────
//
// A shareable card: "Day X clean from [App]."
//
// Generates a styled text card the user can screenshot and share.
// Uses Share API for the message text (no native image generation needed).
//
// Displayed on the profile screen and the walk-away celebration screen.
// Tapping "Share" opens the native share sheet with pre-written copy.

import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface Props {
  compact?: boolean; // compact = inline badge, full = large card
}

// Days since user first hit a walk-away (approximated from walkAwayCount)
function estimateDayStreak(walkAwayCount: number, streak: number): number {
  // Use the actual streak if > 0, otherwise estimate from walk-aways
  return streak > 0 ? streak : Math.floor(walkAwayCount / 2);
}

export function StreakShare({ compact = false }: Props) {
  const { walkAwayCount, streak } = useUserStore();

  const days = estimateDayStreak(walkAwayCount, streak);
  if (days < 1 && walkAwayCount < 3) return null; // Not enough history yet

  const shareText = days >= 1
    ? `Day ${days} with NoGoon. ${walkAwayCount} times I've walked away from social media instead of opening it.\n\nBuilding the habit one walk-away at a time. 📵`
    : `${walkAwayCount} walk-aways and counting. NoGoon is helping me break the scroll loop. 📵`;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: shareText,
        title: 'My NoGoon progress',
      });
    } catch { /* user cancelled */ }
  }, [shareText]);

  if (compact) {
    return (
      <Pressable style={styles.compactRow} onPress={handleShare}>
        <Text style={styles.compactText}>
          {days >= 1 ? `Day ${days}` : `${walkAwayCount} walk-aways`}
        </Text>
        <Feather name="share-2" size={14} color={COLORS.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      {/* Card content (visual preview of what they're sharing) */}
      <View style={styles.preview}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewApp}>nogoon</Text>
          <View style={styles.greenDot} />
        </View>
        <Text style={styles.previewDay}>
          {days >= 1 ? `Day ${days}` : `${walkAwayCount}×`}
        </Text>
        <Text style={styles.previewSub}>
          {days >= 1
            ? `${walkAwayCount} walk-aways · ${days}-day streak`
            : 'walk-aways and counting'}
        </Text>
      </View>

      {/* Share button */}
      <Pressable style={styles.shareBtn} onPress={handleShare}>
        <Feather name="share-2" size={16} color={COLORS.background} />
        <Text style={styles.shareBtnText}>Share your progress</Text>
      </Pressable>

      <Text style={styles.hint}>Opens your share sheet — screenshot or send as text.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Compact (inline badge) ──
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  compactText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // ── Full card ──
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: SPACING.md,
  },
  preview: {
    backgroundColor: '#0d1612',
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.green + '44',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  previewApp: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.green,
    letterSpacing: 0.5,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.green,
  },
  previewDay: {
    fontFamily: FONTS.monoBold || FONTS.bodyBold,
    fontSize: 56,
    color: COLORS.textPrimary,
    letterSpacing: -2,
    lineHeight: 62,
  },
  previewSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  shareBtn: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.background,
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
