// ═══════════════════════════════════════════════════════════════════════════
//  REACTION SPEED — Pro Game (WarioWare style)
//  ────────────────────────────────────────────
//  A bright target appears suddenly at a random position on screen.
//  The user must tap it as fast as possible. It disappears after 800ms
//  if missed. 5 rounds, random delay between each (0.5–3 seconds).
//
//  WHY IT WORKS AS A PATTERN INTERRUPT:
//  Pure reaction requires conscious attention — you can't be on autopilot.
//  The suspense between rounds creates micro-moments of alertness that
//  reset the passive "scroll brain" state. It's surprising, fast, and
//  satisfying — exactly the WarioWare feeling.
//
//  SCORING (based on average reaction time across 5 rounds):
//    < 200ms avg = 120 pts
//    < 300ms avg = 100 pts
//    < 400ms avg = 80 pts
//    < 600ms avg = 60 pts
//    ≥ 600ms avg = 40 pts (or any misses)
//
//  ROUNDS: 5
//  TARGET VISIBLE: 800ms max before it disappears (counts as miss)
//  WAIT BETWEEN ROUNDS: 0.8 – 3 seconds (random, keeps you on edge)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Dimensions,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TOTAL_ROUNDS      = 5;     // Number of targets
const TARGET_SIZE       = 90;    // Diameter of tap target in pixels
const TARGET_VISIBLE_MS = 800;   // Target disappears after 800ms if not tapped
const MIN_WAIT_MS       = 800;   // Minimum wait before target appears
const MAX_WAIT_MS       = 3000;  // Maximum wait before target appears

// Keeps target away from edges for easier tapping
const PADDING           = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoundResult {
  reactionMs: number | null; // null = missed
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function calculateScore(results: RoundResult[]): number {
  const hits = results.filter((r) => r.reactionMs !== null);
  if (hits.length === 0) return 20; // All missed — still some points for trying

  const avgMs = hits.reduce((sum, r) => sum + r.reactionMs!, 0) / hits.length;

  // Miss penalty: lose 2 pts per miss (reduced from 5 — less punishing)
  const missPenalty = (results.length - hits.length) * 2;

  // Thresholds adjusted to be achievable for average people:
  //   <300ms = very fast (achievable with practice)
  //   <450ms = good
  //   <600ms = average
  //   <800ms = slow but still rewarded
  let base = 0;
  if (avgMs < 300)      base = 120;
  else if (avgMs < 450) base = 100;
  else if (avgMs < 600) base = 80;
  else if (avgMs < 800) base = 60;
  else                  base = 40;

  return Math.max(20, base - missPenalty);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReactionGame({ onComplete }: Props) {
  // Game state machine
  // 'intro'   — instructions screen
  // 'waiting' — between rounds, target not visible, building suspense
  // 'target'  — target is visible, waiting for tap or timeout
  // 'result'  — brief feedback after tap or miss
  // 'complete'— all rounds finished
  const [phase, setPhase] = useState<'intro' | 'waiting' | 'target' | 'result' | 'complete'>('intro');

  // Current round (0-indexed)
  const [round, setRound] = useState(0);

  // Results array — one entry per completed round
  const [results, setResults] = useState<RoundResult[]>([]);

  // Last round result for feedback display
  const [lastResult, setLastResult] = useState<'hit' | 'miss' | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);

  // Target position (random on each round)
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });

  // When the target appeared — used to calculate reaction time
  const targetAppearedAt = useRef<number>(0);

  // Timeout refs so we can clear them on unmount
  const waitTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated scale for target pop-in
  const targetScale   = useRef(new Animated.Value(0)).current;

  // Animated opacity for "TAP!" flash text
  const tapFlashOpacity = useRef(new Animated.Value(0)).current;

  // ── Cleanup timeouts on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (waitTimeout.current)  clearTimeout(waitTimeout.current);
      if (missTimeout.current)  clearTimeout(missTimeout.current);
    };
  }, []);

  // ── Start a new round ──────────────────────────────────────────────────────

  const startRound = (roundNumber: number) => {
    setPhase('waiting');

    // Random wait time — this unpredictability is the key to the game
    const waitMs = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);

    waitTimeout.current = setTimeout(() => {
      showTarget(roundNumber);
    }, waitMs);
  };

  // ── Show the target ────────────────────────────────────────────────────────

  const showTarget = (roundNumber: number) => {
    // Random position within safe bounds
    const x = PADDING + Math.random() * (SCREEN_WIDTH  - TARGET_SIZE - PADDING * 2);
    const y = PADDING + Math.random() * (SCREEN_HEIGHT - TARGET_SIZE - PADDING * 2 - 200);

    setTargetPos({ x, y });
    setPhase('target');
    targetAppearedAt.current = Date.now();

    // Pop-in animation
    targetScale.setValue(0);
    Animated.spring(targetScale, {
      toValue: 1,
      damping: 9,
      stiffness: 300,
      useNativeDriver: true,
    }).start();

    // Flash "TAP!" text
    tapFlashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(tapFlashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(tapFlashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // Auto-miss if not tapped in time
    missTimeout.current = setTimeout(() => {
      handleMiss(roundNumber);
    }, TARGET_VISIBLE_MS);
  };

  // ── Handle a successful tap ────────────────────────────────────────────────

  const handleTap = () => {
    if (phase !== 'target') return;

    if (missTimeout.current) clearTimeout(missTimeout.current);

    const reactionMs = Date.now() - targetAppearedAt.current;
    setLastMs(reactionMs);
    setLastResult('hit');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const newResult: RoundResult = { reactionMs };
    const newResults = [...results, newResult];
    setResults(newResults);

    setPhase('result');

    // After brief feedback, advance
    setTimeout(() => advanceRound(newResults), 700);
  };

  // ── Handle a miss (target expired) ────────────────────────────────────────

  const handleMiss = (roundNumber: number) => {
    setLastResult('miss');
    setLastMs(null);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const newResult: RoundResult = { reactionMs: null };
    const newResults = [...results, newResult];
    setResults(newResults);

    setPhase('result');

    setTimeout(() => advanceRound(newResults), 700);
  };

  // ── Move to next round or finish ───────────────────────────────────────────

  const advanceRound = (currentResults: RoundResult[]) => {
    const nextRound = round + 1;

    if (nextRound >= TOTAL_ROUNDS) {
      setPhase('complete');
    } else {
      setRound(nextRound);
      startRound(nextRound);
    }
  };

  // ── Begin game ─────────────────────────────────────────────────────────────

  const handleStart = () => {
    setRound(0);
    setResults([]);
    setLastResult(null);
    startRound(0);
  };

  // ── Final score ────────────────────────────────────────────────────────────

  const finalScore = calculateScore(results);
  const hitCount   = results.filter((r) => r.reactionMs !== null).length;
  const avgMs      = hitCount > 0
    ? Math.round(results.filter((r) => r.reactionMs !== null).reduce((s, r) => s + r.reactionMs!, 0) / hitCount)
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Intro
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>

          <Text style={styles.heroEmoji}>⚡</Text>
          <Text style={styles.title}>Reaction Speed</Text>

          <Text style={styles.subtitle}>
            A bright target will appear somewhere on screen.{'\n'}
            Tap it as fast as you can.{'\n\n'}
            Don't blink.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoRow}>🎯  5 rounds</Text>
            <Text style={styles.infoRow}>⏱️  Target visible for 0.8 seconds</Text>
            <Text style={styles.infoRow}>🎲  Appears at a random time</Text>
          </View>

          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Ready — GO →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Complete
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>

          <Text style={styles.heroEmoji}>{hitCount === TOTAL_ROUNDS ? '🏆' : '⚡'}</Text>
          <Text style={styles.title}>
            {hitCount === TOTAL_ROUNDS ? 'Perfect!' : `${hitCount}/${TOTAL_ROUNDS} hits`}
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreNumber}>{finalScore}</Text>
            <Text style={styles.scoreLabel}>points earned</Text>
          </View>

          {avgMs !== null && (
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Avg reaction</Text>
                <Text style={[styles.statValue, { color: avgMs < 300 ? COLORS.green : COLORS.warning }]}>
                  {avgMs}ms
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Hits</Text>
                <Text style={[styles.statValue, { color: COLORS.cyan }]}>
                  {hitCount} / {TOTAL_ROUNDS}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.scienceNote}>
            💡 Average human reaction time is 250ms. Fighter pilots train to 150ms.
          </Text>

          <Pressable style={styles.startButton} onPress={() => onComplete(finalScore)}>
            <Text style={styles.startButtonText}>Continue →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Playing (waiting / target / result)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={styles.playField}>

      {/* ── Round tracker at top ── */}
      <SafeAreaView>
        <View style={styles.roundTracker}>
          <Text style={styles.roundLabel}>
            Round {round + 1} of {TOTAL_ROUNDS}
          </Text>

          {/* Small dot indicators for each round */}
          <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
              const result = results[i];
              const isActive = i === round;
              return (
                <View
                  key={i}
                  style={[
                    styles.roundDot,
                    isActive && styles.roundDotActive,
                    result?.reactionMs !== null && result !== undefined && styles.roundDotHit,
                    result?.reactionMs === null && result !== undefined && styles.roundDotMiss,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* ── Center instruction / feedback text ── */}
      <View style={styles.centerText} pointerEvents="none">
        {phase === 'waiting' && (
          <Text style={styles.waitingText}>Get ready...</Text>
        )}

        {/* Flash "TAP!" briefly when target appears */}
        <Animated.Text style={[styles.tapFlash, { opacity: tapFlashOpacity }]}>
          TAP!
        </Animated.Text>

        {phase === 'result' && lastResult === 'hit' && (
          <View style={styles.hitFeedback}>
            <Text style={styles.hitFeedbackText}>
              ✅ {lastMs}ms
              {lastMs !== null && lastMs < 300 ? ' — lightning fast!' : lastMs !== null && lastMs < 450 ? ' — nice!' : ''}
            </Text>
          </View>
        )}

        {phase === 'result' && lastResult === 'miss' && (
          <Text style={styles.missFeedbackText}>❌ Too slow!</Text>
        )}
      </View>

      {/* ── Tappable target — only visible during 'target' phase ── */}
      {phase === 'target' && (
        <Pressable
          style={[styles.targetWrapper, { left: targetPos.x, top: targetPos.y }]}
          onPress={handleTap}
        >
          <Animated.View
            style={[
              styles.target,
              { transform: [{ scale: targetScale }] },
            ]}
          >
            <Text style={styles.targetEmoji}>⚡</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Intro / Complete ──────────────────────────────────────────────────────
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },

  heroEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    width: '100%',
    gap: SPACING.sm,
  },

  infoRow: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },

  startButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    width: '100%',
  },

  scoreNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 72,
    color: COLORS.green,
    lineHeight: 84,
  },

  scoreLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    width: '100%',
    gap: SPACING.md,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: COLORS.textPrimary,
  },

  scienceNote: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Playing screen ────────────────────────────────────────────────────────

  // The play field fills the entire screen — target can appear anywhere
  playField: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  roundTracker: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
  },

  roundLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  roundDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  roundDotActive: {
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.cyan + '40',
  },

  roundDotHit: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  roundDotMiss: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },

  // Centered overlay text (waiting message, tap flash, result feedback)
  centerText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  waitingText: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  tapFlash: {
    fontFamily: FONTS.display,
    fontSize: 52,
    color: COLORS.green,
    letterSpacing: 4,
    position: 'absolute',
  },

  hitFeedback: {
    backgroundColor: COLORS.green + '20',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },

  hitFeedbackText: {
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    color: COLORS.green,
  },

  missFeedbackText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: COLORS.danger,
  },

  // The tappable target itself — absolutely positioned
  targetWrapper: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
  },

  target: {
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow/glow effect
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },

  targetEmoji: {
    fontSize: 36,
  },
});
