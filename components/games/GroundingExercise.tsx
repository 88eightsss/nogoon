// ═══════════════════════════════════════════════════════════════════════════
//  GROUNDING EXERCISE — "Ground Yourself"
//  ───────────────────────────────────────
//  Walks the user through the 5-4-3-2-1 grounding technique.
//  This is a clinically-validated anxiety and craving reduction method that
//  works by anchoring attention to physical senses — breaking the automatic
//  "open → scroll" loop by redirecting to the present moment.
//
//  HOW IT WORKS:
//    5 things you can SEE
//    4 things you can TOUCH / FEEL
//    3 things you can HEAR
//    2 things you can SMELL
//    1 thing you can TASTE
//
//  The user taps through each item. Completing all 25 taps takes ~60–90 seconds.
//  Research shows this duration is enough to let a craving wave pass naturally.
//
//  WHY THIS REPLACES ANIMAL FACTS:
//  Animal Facts was passive (read, guess, done). Grounding requires active
//  attention and body awareness — a genuine pattern interrupt, not entertainment.
//
//  Props:
//    onComplete(score) — called when all steps are done (always 35 pts)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface GroundingExerciseProps {
  onComplete: (score: number) => void;
}

// ─── The 5 senses, with how many items to notice for each ─────────────────────

const SENSES = [
  {
    count: 5,
    sense: 'SEE',
    icon: '👁️',
    color: COLORS.cyan,
    prompt: 'Look around. Find 5 things you can see.',
    tapLabel: 'I see something',
    completion: 'Good eyes. Keep going.',
  },
  {
    count: 4,
    sense: 'TOUCH',
    icon: '✋',
    color: COLORS.purple,
    prompt: 'Notice 4 things you can physically feel right now.',
    tapLabel: 'I feel something',
    completion: 'Your body is here. So are you.',
  },
  {
    count: 3,
    sense: 'HEAR',
    icon: '👂',
    color: COLORS.indigoBright,
    prompt: 'Listen for 3 sounds in the room or outside.',
    tapLabel: 'I hear something',
    completion: 'The world is going on without you scrolling.',
  },
  {
    count: 2,
    sense: 'SMELL',
    icon: '👃',
    color: '#ff9d4d',
    prompt: 'Notice 2 things you can smell (or the absence of smell).',
    tapLabel: 'I notice a smell',
    completion: 'Almost there.',
  },
  {
    count: 1,
    sense: 'TASTE',
    icon: '👅',
    color: COLORS.green,
    prompt: 'Notice 1 thing you can taste right now.',
    tapLabel: 'I notice a taste',
    completion: 'Done.',
  },
] as const;

// Fixed score — 35 pause tokens. The exercise itself is the reward.
const SCORE = 35;

// ─── Main component ────────────────────────────────────────────────────────────

export function GroundingExercise({ onComplete }: GroundingExerciseProps) {
  // Which sense we're currently on (0–4)
  const [senseIndex, setSenseIndex] = useState(0);
  // How many taps done for the current sense
  const [tapsForSense, setTapsForSense] = useState(0);
  // Whether we're showing the completion message for the current sense
  const [showCompletion, setShowCompletion] = useState(false);
  // Whether we've finished all senses (show final screen)
  const [allDone, setAllDone] = useState(false);

  const currentSense = SENSES[senseIndex];
  const totalTaps    = SENSES.reduce((sum, s) => sum + s.count, 0); // = 15
  const doneTaps     = SENSES.slice(0, senseIndex).reduce((sum, s) => sum + s.count, 0) + tapsForSense;
  const progress     = doneTaps / totalTaps;

  // ── Tap animation ──────────────────────────────────────────────────────────
  const tapScale = useRef(new Animated.Value(1)).current;

  const doTapBounce = () => {
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, damping: 8, useNativeDriver: true }),
    ]).start();
  };

  // ── Handle a tap ──────────────────────────────────────────────────────────

  const handleTap = () => {
    if (showCompletion || allDone) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    doTapBounce();

    const newTaps = tapsForSense + 1;
    setTapsForSense(newTaps);

    if (newTaps >= currentSense.count) {
      // Finished all taps for this sense
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCompletion(true);

      // Show completion message briefly, then advance
      setTimeout(() => {
        const nextIndex = senseIndex + 1;
        if (nextIndex >= SENSES.length) {
          // All 5 senses done
          setAllDone(true);
        } else {
          setSenseIndex(nextIndex);
          setTapsForSense(0);
          setShowCompletion(false);
        }
      }, 1200);
    }
  };

  // ── Finish ─────────────────────────────────────────────────────────────────

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(SCORE);
  };

  // ── Dot progress indicator ─────────────────────────────────────────────────
  // Shows all 5 senses as dots, filled/empty based on completion

  const dots = SENSES.map((s, i) => {
    const isCompleted = i < senseIndex || (i === senseIndex && showCompletion && senseIndex === SENSES.length - 1);
    const isCurrent   = i === senseIndex && !allDone;
    return { sense: s, isCompleted, isCurrent };
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: All done — final screen
  // ══════════════════════════════════════════════════════════════════════════

  if (allDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🌿</Text>
          <Text style={styles.doneTitle}>You're here.</Text>
          <Text style={styles.doneBody}>
            Most cravings last 90 seconds.{'\n'}
            You just waited them out.{'\n\n'}
            Now decide — with a clear head.
          </Text>

          <Pressable style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Continue (+{SCORE} tokens)</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Active sense
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Progress bar ── */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: currentSense.color }]} />
        </View>

        {/* ── Sense dots ── */}
        <View style={styles.dotsRow}>
          {dots.map(({ sense, isCompleted, isCurrent }, i) => (
            <View
              key={sense.sense}
              style={[
                styles.dot,
                {
                  backgroundColor: isCompleted
                    ? sense.color
                    : isCurrent
                      ? sense.color + '55'
                      : COLORS.border,
                  borderColor: isCurrent ? sense.color : 'transparent',
                  borderWidth: isCurrent ? 2 : 0,
                },
              ]}
            />
          ))}
        </View>

        {/* ── Current sense header ── */}
        <View style={styles.senseHeader}>
          <Text style={styles.senseIcon}>{currentSense.icon}</Text>
          <Text style={[styles.senseName, { color: currentSense.color }]}>
            {currentSense.sense}
          </Text>
          <Text style={[styles.senseCount, { color: currentSense.color }]}>
            {tapsForSense} / {currentSense.count}
          </Text>
        </View>

        {/* ── Prompt text ── */}
        <Text style={styles.prompt}>{currentSense.prompt}</Text>

        {/* ── Completion message (briefly shown after all taps for a sense) ── */}
        {showCompletion && (
          <Text style={[styles.completionMsg, { color: currentSense.color }]}>
            {currentSense.completion}
          </Text>
        )}

        {/* ── Big tap button ── */}
        {!showCompletion && (
          <Animated.View style={{ transform: [{ scale: tapScale }] }}>
            <Pressable
              style={[styles.tapButton, { backgroundColor: currentSense.color + '22', borderColor: currentSense.color + '66' }]}
              onPress={handleTap}
            >
              <Text style={[styles.tapButtonText, { color: currentSense.color }]}>
                {currentSense.tapLabel}
              </Text>
              <Text style={[styles.tapCounter, { color: currentSense.color + '88' }]}>
                {currentSense.count - tapsForSense} more
              </Text>
            </Pressable>
          </Animated.View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.xl,
  },

  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
  },

  senseHeader: {
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  senseIcon: {
    fontSize: 52,
  },
  senseName: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 3,
  },
  senseCount: {
    fontFamily: FONTS.monoBold,
    fontSize: 32,
  },

  prompt: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },

  completionMsg: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    textAlign: 'center',
  },

  tapButton: {
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: 220,
  },
  tapButtonText: {
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  tapCounter: {
    fontFamily: FONTS.mono,
    fontSize: 13,
  },

  // ── Done screen ──
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.xl,
  },
  doneEmoji: {
    fontSize: 64,
  },
  doneTitle: {
    fontFamily: FONTS.display,
    fontSize: 40,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  doneBody: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  finishButton: {
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.md,
  },
  finishButtonText: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.background,
    letterSpacing: -0.3,
  },
});
