// ═══════════════════════════════════════════════════════════════════════════
//  PLACEHOLDER GAME
//  ────────────────
//  A temporary stand-in for the 4 games that haven't been built yet
//  (Pattern Memory, Orb Catcher, Breathing Exercise, Quick Math).
//
//  It runs for 10 seconds with an animated progress bar, then auto-completes
//  with a random score. This lets the full GATE flow work end-to-end
//  even before all games exist.
//
//  Will be REPLACED by the real game component when that game is built.
//
//  Props:
//    gameName   — e.g. "Pattern Memory"
//    accentColor — the game's brand color
//    emoji       — the game's emoji icon
//    onComplete(score) — called when the 10 seconds are up
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// How long the placeholder session lasts before auto-completing
const SESSION_DURATION_S = 10;

export interface PlaceholderGameProps {
  gameName: string;
  accentColor: string;
  emoji: string;
  onComplete: (score: number) => void;
}

export function PlaceholderGame({
  gameName,
  accentColor,
  emoji,
  onComplete,
}: PlaceholderGameProps) {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION_S);

  // Guard so the completion callback only fires once even if the component
  // somehow re-renders right at the boundary
  const completedRef = useRef(false);

  // Animated progress bar fills from 0 → full width over SESSION_DURATION_S
  const barProgress = useRef(new Animated.Value(0)).current;
  const barStyle = {
    width: barProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }) as any,
  };

  useEffect(() => {
    // Start the visual progress bar immediately
    Animated.timing(barProgress, {
      toValue: 1,
      duration: SESSION_DURATION_S * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Tick the countdown and fire haptics each second
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed   = Date.now() - startTime;
      const remaining = Math.max(0, SESSION_DURATION_S - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      // Soft tap haptic each second so it feels alive
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(interval);

        // Award a random score in the 60–120 range
        const score = Math.floor(Math.random() * 61) + 60;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete(score);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Game identity */}
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.gameName, { color: accentColor }]}>{gameName}</Text>

      {/* Honest "coming soon" message */}
      <Text style={styles.comingSoon}>Full game coming next</Text>
      <Text style={styles.subText}>
        Completing a quick session now…
      </Text>

      {/* Countdown number */}
      <Text style={[styles.countdown, { color: accentColor }]}>{timeLeft}</Text>
      <Text style={styles.secondsLabel}>seconds remaining</Text>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            barStyle,
            { backgroundColor: accentColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.sm,
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  gameName: {
    fontFamily: FONTS.display,
    fontSize: 32,
    letterSpacing: -0.3,
  },
  comingSoon: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: SPACING.xs,
  },
  subText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  countdown: {
    fontFamily: FONTS.monoBold,
    fontSize: 80,
    lineHeight: 88,
  },
  secondsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.xxxl,
  },
  barTrack: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
});
