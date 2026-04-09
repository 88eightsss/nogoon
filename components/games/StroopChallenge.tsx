// ═══════════════════════════════════════════════════════════════════════════
//  STROOP CHALLENGE
//  ────────────────
//  The Stroop effect: your brain reads words faster than it perceives color.
//  So when a word says "RED" but is printed in blue ink, you hesitate.
//
//  Goal: tap the INK COLOR (not the word) as fast as possible.
//  Time: 30 seconds  |  +10 pts correct  |  +5 speed bonus if < 2 seconds
//
//  Props:
//    onComplete(score) — called when the player finishes or presses Continue
//
//  Animations use React Native's built-in Animated API (not Reanimated),
//  so this works in Expo Go without any native modules.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Game constants ────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// The timer bar spans the screen minus left+right padding
const TIMER_BAR_FULL_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

const GAME_DURATION_S    = 30;    // seconds the game lasts
const BASE_POINTS        = 10;    // points for any correct answer
const SPEED_BONUS_POINTS = 5;     // bonus for answering in under 2 seconds
const SPEED_THRESHOLD_MS = 2000;  // 2 000 ms = speed bonus window
const MIN_PASSING_SCORE  = 30;    // below this score → offer retry

// ─── Color word definitions ────────────────────────────────────────────────────

// Each entry: the WORD displayed, its HEX color, and the user-facing label.
// The game always shows a word in a DIFFERENT color (that's the Stroop conflict).
const STROOP_COLORS = [
  { word: 'RED',    hex: '#ff4d4d', label: 'Red'    },
  { word: 'BLUE',   hex: '#4d8bff', label: 'Blue'   },
  { word: 'GREEN',  hex: '#6cff5a', label: 'Green'  },
  { word: 'YELLOW', hex: '#ffd600', label: 'Yellow' },
  { word: 'PURPLE', hex: '#b47aff', label: 'Purple' },
  { word: 'ORANGE', hex: '#ff8c00', label: 'Orange' },
] as const;

type StroopColor = (typeof STROOP_COLORS)[number];

// ─── Round generator ───────────────────────────────────────────────────────────

// Returns a fresh round: a word, an ink color (different from the word),
// and 4 shuffled answer buttons (one correct, three distractors).
function generateRound(): {
  wordItem: StroopColor;
  inkColor: StroopColor;
  options: StroopColor[];
} {
  const wordItem =
    STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];

  const otherColors = STROOP_COLORS.filter((c) => c.word !== wordItem.word);
  const inkColor = otherColors[Math.floor(Math.random() * otherColors.length)];

  const distractors = STROOP_COLORS.filter((c) => c.word !== inkColor.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [...distractors, inkColor].sort(() => Math.random() - 0.5);

  return { wordItem, inkColor, options };
}

// ─── OptionButton ─────────────────────────────────────────────────────────────

// A single answer button with its own independent press-scale animation.

interface OptionButtonProps {
  option: StroopColor;
  disabled: boolean;
  onPress: (option: StroopColor) => void;
}

function OptionButton({ option, disabled, onPress }: OptionButtonProps) {
  // Each button owns its own scale Animated.Value
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.92,
      duration: 70,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 10,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(option)}
      disabled={disabled}
      style={styles.optionPressable}
    >
      <Animated.View
        style={[
          styles.optionButton,
          {
            borderColor: option.hex + '66',
            backgroundColor: option.hex + '14',
          },
          { transform: [{ scale }] },
        ]}
      >
        {/* Large color swatch — the main visual cue */}
        <View style={[styles.colorSwatch, { backgroundColor: option.hex }]} />
        {/* Color name label */}
        <Text style={[styles.optionLabel, { color: option.hex }]}>
          {option.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type GamePhase = 'countdown' | 'playing' | 'complete';

export interface StroopChallengeProps {
  onComplete: (score: number) => void;
}

export function StroopChallenge({ onComplete }: StroopChallengeProps) {

  // ── Game state ────────────────────────────────────────────────────────────

  const [phase, setPhase]                   = useState<GamePhase>('countdown');
  const [countdownNum, setCountdownNum]     = useState(3);
  const [timeLeft, setTimeLeft]             = useState(GAME_DURATION_S);
  const [score, setScore]                   = useState(0);
  const [totalAnswers, setTotalAnswers]     = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);

  const [roundData, setRoundData] = useState<ReturnType<typeof generateRound>>(
    () => generateRound()
  );

  // Prevents double-tap registering two answers for one round
  const [inputDisabled, setInputDisabled] = useState(false);

  // When this round started — used to calculate the speed bonus
  const roundStartRef = useRef(Date.now());

  // ── Animated values ────────────────────────────────────────────────────────

  // Timer bar shrinks from full width to 0 over 30 seconds.
  // Must use useNativeDriver: false because we're animating 'width' (a layout property).
  const timerBarWidth = useRef(new Animated.Value(TIMER_BAR_FULL_WIDTH)).current;

  // Word entrance: fades + slides up from below
  // useNativeDriver: true — only opacity and transforms
  const wordOpacity    = useRef(new Animated.Value(0)).current;
  const wordScale      = useRef(new Animated.Value(0.82)).current;
  const wordTranslateY = useRef(new Animated.Value(16)).current;

  // Wrong-answer shake: horizontal wobble on the word
  const wordShakeX = useRef(new Animated.Value(0)).current;

  // Feedback flash overlays — one green (correct), one red (wrong)
  const feedbackCorrectOpacity = useRef(new Animated.Value(0)).current;
  const feedbackWrongOpacity   = useRef(new Animated.Value(0)).current;

  // ── Word entrance animation ───────────────────────────────────────────────

  // Called at the start of each round — pop the word in with parallel animations
  const animateWordIn = useCallback(() => {
    // Reset to starting values instantly
    wordOpacity.setValue(0);
    wordScale.setValue(0.82);
    wordTranslateY.setValue(16);

    // Animate all three in parallel
    Animated.parallel([
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(wordScale, {
        toValue: 1,
        damping: 13,
        stiffness: 210,
        useNativeDriver: true,
      }),
      Animated.timing(wordTranslateY, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [wordOpacity, wordScale, wordTranslateY]);

  // ── Countdown phase ───────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return;

    const tick = setInterval(() => {
      setCountdownNum((n) => {
        if (n <= 1) {
          clearInterval(tick);
          setTimeout(() => setPhase('playing'), 0);
          return 0;
        }
        return n - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [phase]);

  // ── Game timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return;

    // Reset + start the animated timer bar
    timerBarWidth.setValue(TIMER_BAR_FULL_WIDTH);
    Animated.timing(timerBarWidth, {
      toValue: 0,
      duration: GAME_DURATION_S * 1000,
      easing: Easing.linear,
      useNativeDriver: false, // 'width' cannot run on the native thread
    }).start();

    // Animate the first word in
    animateWordIn();
    roundStartRef.current = Date.now();

    // Tick every 100ms using wall-clock time for precision
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed   = Date.now() - startTime;
      const remaining = Math.max(0, GAME_DURATION_S - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setPhase('complete');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Answer handler ────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (chosen: StroopColor) => {
      if (inputDisabled) return;

      setInputDisabled(true);

      const isCorrect  = chosen.word === roundData.inkColor.word;
      const elapsed    = Date.now() - roundStartRef.current;
      const speedBonus = elapsed < SPEED_THRESHOLD_MS ? SPEED_BONUS_POINTS : 0;

      setTotalAnswers((t) => t + 1);

      if (isCorrect) {
        setScore((s) => s + BASE_POINTS + speedBonus);
        setCorrectAnswers((c) => c + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Flash the green overlay
        Animated.sequence([
          Animated.timing(feedbackCorrectOpacity, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(feedbackCorrectOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]).start();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // Flash the red overlay
        Animated.sequence([
          Animated.timing(feedbackWrongOpacity, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(feedbackWrongOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        ]).start();

        // Shake the word left-right-left-right-center
        Animated.sequence([
          Animated.timing(wordShakeX, { toValue: -14, duration: 45, useNativeDriver: true }),
          Animated.timing(wordShakeX, { toValue:  14, duration: 45, useNativeDriver: true }),
          Animated.timing(wordShakeX, { toValue: -10, duration: 45, useNativeDriver: true }),
          Animated.timing(wordShakeX, { toValue:  10, duration: 45, useNativeDriver: true }),
          Animated.timing(wordShakeX, { toValue:   0, duration: 45, useNativeDriver: true }),
        ]).start();
      }

      // After a short feedback window, load the next round
      setTimeout(() => {
        setRoundData(generateRound());
        animateWordIn();
        roundStartRef.current = Date.now();
        setInputDisabled(false);
      }, 380);
    },
    [
      inputDisabled,
      roundData.inkColor.word,
      feedbackCorrectOpacity,
      feedbackWrongOpacity,
      wordShakeX,
      animateWordIn,
    ],
  );

  // ── Retry handler ─────────────────────────────────────────────────────────

  const handleRetry = () => {
    setPhase('countdown');
    setCountdownNum(3);
    setTimeLeft(GAME_DURATION_S);
    setScore(0);
    setTotalAnswers(0);
    setCorrectAnswers(0);
    setRoundData(generateRound());
    setInputDisabled(false);
    timerBarWidth.setValue(TIMER_BAR_FULL_WIDTH);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Countdown
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'countdown') {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.countdownTitle}>Stroop Challenge</Text>

        <View style={styles.ruleBox}>
          <Text style={styles.ruleText}>
            Tap the{' '}
            <Text style={styles.ruleHighlight}>ink color</Text>
            {'\n'}not the word
          </Text>
          {/* Live demo: the word GREEN in purple ink */}
          <Text style={[styles.demoWord, { color: COLORS.purple }]}>GREEN</Text>
          <Text style={styles.ruleSubtext}>↑ correct answer is Purple</Text>
        </View>

        <Text style={styles.countdownNumber}>
          {countdownNum === 0 ? 'GO!' : countdownNum}
        </Text>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Complete
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'complete') {
    const accuracy   = totalAnswers > 0
      ? Math.round((correctAnswers / totalAnswers) * 100)
      : 0;
    const isLowScore = score < MIN_PASSING_SCORE;

    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.completeHeadline}>Time's up!</Text>

        <Text style={styles.finalScore}>{score}</Text>
        <Text style={styles.finalScoreLabel}>points earned</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.green }]}>
              {correctAnswers}
            </Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalAnswers}</Text>
            <Text style={styles.statLabel}>Answered</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: accuracy >= 70 ? COLORS.green : COLORS.warning },
              ]}
            >
              {accuracy}%
            </Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
        </View>

        {isLowScore && (
          <View style={styles.encouragementBox}>
            <Text style={styles.encouragementText}>
              The Stroop effect is genuinely hard.{'\n'}
              Your brain will adapt — try again!
            </Text>
          </View>
        )}

        <View style={styles.completeActions}>
          {isLowScore && (
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          )}

          <Pressable
            style={[
              styles.continueButton,
              isLowScore && styles.continueDimmed,
            ]}
            onPress={() => onComplete(score)}
          >
            <Text
              style={[
                styles.continueButtonText,
                isLowScore && styles.continueDimmedText,
              ]}
            >
              {isLowScore ? 'Continue anyway' : 'Continue →'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Playing
  // ══════════════════════════════════════════════════════════════════════════

  const { wordItem, inkColor, options } = roundData;

  const timerColor =
    timeLeft > 15 ? COLORS.green :
    timeLeft > 7  ? COLORS.warning :
                    COLORS.danger;

  return (
    <SafeAreaView style={styles.gameContainer}>

      {/* ── Timer bar ── */}
      <View style={styles.timerTrack}>
        <Animated.View
          style={[
            styles.timerFill,
            { width: timerBarWidth },
            { backgroundColor: timerColor },
          ]}
        />
      </View>

      {/* ── HUD: score left, time right ── */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>TIME</Text>
          <Text
            style={[
              styles.hudValue,
              timeLeft <= 7 && { color: COLORS.danger },
            ]}
          >
            {timeLeft}s
          </Text>
        </View>
      </View>

      {/* ── Instruction text ── */}
      <Text style={styles.instruction}>What color is the ink?</Text>

      {/* ── Stroop word display ── */}
      <View style={styles.wordArea}>
        {/* Green flash on correct answer */}
        <Animated.View
          style={[
            styles.feedbackOverlay,
            styles.feedbackCorrect,
            { opacity: feedbackCorrectOpacity },
          ]}
          pointerEvents="none"
        />
        {/* Red flash on wrong answer */}
        <Animated.View
          style={[
            styles.feedbackOverlay,
            styles.feedbackWrong,
            { opacity: feedbackWrongOpacity },
          ]}
          pointerEvents="none"
        />

        {/* The word — displayed in inkColor.hex regardless of what it says */}
        <Animated.Text
          style={[
            styles.stroopWord,
            { color: inkColor.hex },
            {
              opacity: wordOpacity,
              transform: [
                { scale: wordScale },
                { translateY: wordTranslateY },
                { translateX: wordShakeX },
              ],
            },
          ]}
        >
          {wordItem.word}
        </Animated.Text>
      </View>

      {/* ── Answer buttons — 2 × 2 grid ── */}
      <View style={styles.optionsGrid}>
        <View style={styles.optionsRow}>
          {options.slice(0, 2).map((opt, i) => (
            <OptionButton
              key={`r0-${i}`}
              option={opt}
              disabled={inputDisabled}
              onPress={handleAnswer}
            />
          ))}
        </View>

        <View style={styles.optionsRow}>
          {options.slice(2, 4).map((opt, i) => (
            <OptionButton
              key={`r1-${i}`}
              option={opt}
              disabled={inputDisabled}
              onPress={handleAnswer}
            />
          ))}
        </View>
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // ── Countdown ──

  countdownTitle: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
    letterSpacing: -0.3,
  },
  ruleBox: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    marginBottom: SPACING.xxxl,
    width: '100%',
  },
  ruleText: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  ruleHighlight: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.green,
  },
  demoWord: {
    fontFamily: FONTS.display,
    fontSize: 52,
    marginTop: SPACING.lg,
    letterSpacing: 2,
  },
  ruleSubtext: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  countdownNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 88,
    color: COLORS.green,
    lineHeight: 100,
  },

  // ── Complete screen ──

  completeHeadline: {
    fontFamily: FONTS.display,
    fontSize: 40,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
    letterSpacing: -0.5,
  },
  finalScore: {
    fontFamily: FONTS.monoBold,
    fontSize: 80,
    color: COLORS.green,
    lineHeight: 90,
  },
  finalScoreLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 26,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  encouragementBox: {
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    padding: SPACING.lg,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  encouragementText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  completeActions: {
    width: '100%',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  retryButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
  continueButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  continueDimmed: {
    borderColor: 'transparent',
  },
  continueButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  continueDimmedText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.body,
    fontSize: 14,
  },

  // ── Playing screen ──

  gameContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  timerTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  hudRight: {
    alignItems: 'flex-end',
  },
  hudLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  hudValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  instruction: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
    letterSpacing: 0.3,
  },
  wordArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    pointerEvents: 'none',
  },
  feedbackCorrect: {
    backgroundColor: COLORS.green + '28',
  },
  feedbackWrong: {
    backgroundColor: COLORS.danger + '28',
  },
  stroopWord: {
    fontFamily: FONTS.display,
    fontSize: 72,
    letterSpacing: 6,
    textAlign: 'center',
  },
  optionsGrid: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  optionPressable: {
    flex: 1,
  },
  optionButton: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
  },
  optionLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
