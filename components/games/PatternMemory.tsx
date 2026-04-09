// ═══════════════════════════════════════════════════════════════════════════
//  PATTERN MEMORY
//  ──────────────
//  Simon-style memory game: colored tiles flash a sequence and the user
//  must tap them back in the same order.
//
//  Each round adds one more tile to the sequence.
//  A wrong tap ends the game immediately.
//  The game also ends when the 30-second timer runs out.
//
//  Scoring:
//    +15 pts per completed round
//    +5 speed bonus if the round is completed in under 3 seconds
//
//  Props:
//    onComplete(score) — called when the game ends
//
//  Uses React Native's built-in Animated API (not Reanimated) so it
//  works in Expo Go without any native modules.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Game constants ────────────────────────────────────────────────────────────

const GAME_DURATION_S   = 30;
const FLASH_DURATION_MS = 500;   // how long each tile stays lit during playback
const FLASH_GAP_MS      = 200;   // pause between flashes
const BASE_POINTS       = 15;    // points per completed round
const SPEED_BONUS       = 5;     // bonus for completing a round in < 3 seconds
const SPEED_THRESHOLD   = 3000;  // ms

// ─── Tile definitions — 4 colored tiles in a 2×2 grid ────────────────────────

const TILES = [
  { id: 0, color: COLORS.purple,  dimColor: COLORS.purple  + '33' },
  { id: 1, color: COLORS.cyan,    dimColor: COLORS.cyan    + '33' },
  { id: 2, color: COLORS.green,   dimColor: COLORS.green   + '33' },
  { id: 3, color: COLORS.warning, dimColor: COLORS.warning + '33' },
] as const;

type TileId = 0 | 1 | 2 | 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = 'countdown' | 'showing' | 'input' | 'complete';

export interface PatternMemoryProps {
  onComplete: (score: number) => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PatternMemory({ onComplete }: PatternMemoryProps) {

  // ── Game state ────────────────────────────────────────────────────────────

  const [phase, setPhase]           = useState<GamePhase>('countdown');
  const [countdownNum, setCountdown] = useState(3);
  const [sequence, setSequence]     = useState<TileId[]>([]);  // the full sequence so far
  const [inputIndex, setInputIndex] = useState(0);             // which step the user is on
  const [litTile, setLitTile]       = useState<TileId | null>(null); // currently flashing tile
  const [timeLeft, setTimeLeft]     = useState(GAME_DURATION_S);
  const [score, setScore]           = useState(0);
  const [round, setRound]           = useState(0);

  const roundStartRef = useRef(Date.now());
  const inputDisabledRef = useRef(true); // true during playback, false during input phase

  // ── Animated values ────────────────────────────────────────────────────────

  // Timer bar shrinks from full width to 0
  const timerBarWidth = useRef(new Animated.Value(1)).current; // 0–1, interpolated to %

  // Each tile has its own scale for tap feedback
  const tileScales = useRef(TILES.map(() => new Animated.Value(1))).current;

  // ── Timer bar ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'showing' && phase !== 'input') return;
    // Start the bar animation only once (on first 'showing' entry)
    if (round === 1) {
      Animated.timing(timerBarWidth, {
        toValue: 0,
        duration: GAME_DURATION_S * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }
  }, [round]);

  // ── Countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return;
    const tick = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(tick);
          setTimeout(() => startRound([]), 0);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase]);

  // ── Game timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'showing' && phase !== 'input') return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed   = Date.now() - startTime;
      const remaining = Math.max(0, GAME_DURATION_S - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        endGame();
      }
    }, 100);
    return () => clearInterval(interval);
    // We only want this to run once on mount of the playing phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start a round ────────────────────────────────────────────────────────
  // Appends one new tile to the sequence, then plays back the whole thing.

  const startRound = useCallback((prevSequence: TileId[]) => {
    inputDisabledRef.current = true;

    // Add a random new tile to the sequence
    const newTile = Math.floor(Math.random() * 4) as TileId;
    const newSeq  = [...prevSequence, newTile];

    setSequence(newSeq);
    setRound(newSeq.length);
    setPhase('showing');

    // Play back the sequence with timed flashes
    playSequence(newSeq, () => {
      // After playback, switch to input mode
      setInputIndex(0);
      inputDisabledRef.current = false;
      roundStartRef.current = Date.now();
      setPhase('input');
    });
  }, []);

  // ── Sequence playback ────────────────────────────────────────────────────
  // Lights up each tile in order, then calls onDone when finished.

  const playSequence = (seq: TileId[], onDone: () => void) => {
    let i = 0;

    const flashNext = () => {
      if (i >= seq.length) {
        setLitTile(null);
        onDone();
        return;
      }

      const tileId = seq[i];
      setLitTile(tileId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setTimeout(() => {
        setLitTile(null);
        i++;
        setTimeout(flashNext, FLASH_GAP_MS);
      }, FLASH_DURATION_MS);
    };

    flashNext();
  };

  // ── Handle tile tap ──────────────────────────────────────────────────────

  const handleTileTap = useCallback((tileId: TileId) => {
    if (inputDisabledRef.current || phase !== 'input') return;

    // Animate the tile scale: quick squish down and back
    Animated.sequence([
      Animated.timing(tileScales[tileId], { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(tileScales[tileId], { toValue: 1, damping: 10, useNativeDriver: true }),
    ]).start();

    const expected = sequence[inputIndex];

    if (tileId !== expected) {
      // Wrong tile — game over
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      endGame();
      return;
    }

    // Correct tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const nextIndex = inputIndex + 1;

    if (nextIndex === sequence.length) {
      // Completed the whole sequence for this round
      const elapsed    = Date.now() - roundStartRef.current;
      const speedBonus = elapsed < SPEED_THRESHOLD ? SPEED_BONUS : 0;
      setScore((s) => s + BASE_POINTS + speedBonus);

      // Brief pause then start the next round
      inputDisabledRef.current = true;
      setTimeout(() => startRound(sequence), 600);
    } else {
      setInputIndex(nextIndex);
    }
  }, [phase, sequence, inputIndex, startRound, tileScales]);

  // ── End game ─────────────────────────────────────────────────────────────

  const endGame = () => {
    inputDisabledRef.current = true;
    setPhase('complete');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Timer bar color ───────────────────────────────────────────────────────

  const timerColor =
    timeLeft > 15 ? COLORS.green :
    timeLeft > 7  ? COLORS.warning :
                    COLORS.danger;

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Countdown
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'countdown') {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.titleText}>Pattern Memory</Text>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleText}>
            Watch the tiles light up,{'\n'}then tap them back{' '}
            <Text style={styles.ruleHighlight}>in the same order</Text>.
          </Text>
          <Text style={styles.ruleSubtext}>One wrong tap ends the game.</Text>
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
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.completeHeadline}>
          {round <= 1 ? 'Nice try!' : `Round ${round}!`}
        </Text>
        <Text style={styles.finalScore}>{score}</Text>
        <Text style={styles.finalScoreLabel}>points earned</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.green }]}>{round}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sequence.length}</Text>
            <Text style={styles.statLabel}>Sequence length</Text>
          </View>
        </View>
        <Pressable style={styles.continueButton} onPress={() => onComplete(score)}>
          <Text style={styles.continueButtonText}>Continue →</Text>
        </Pressable>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Showing / Input
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.gameContainer}>

      {/* ── Timer bar ── */}
      <View style={styles.timerTrack}>
        <Animated.View
          style={[
            styles.timerFill,
            {
              width: timerBarWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: timerColor,
            },
          ]}
        />
      </View>

      {/* ── HUD ── */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>
        <View style={styles.hudCenter}>
          <Text style={styles.roundLabel}>
            {phase === 'showing' ? 'WATCH' : 'YOUR TURN'}
          </Text>
          <Text style={styles.roundNumber}>Round {round}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>TIME</Text>
          <Text style={[styles.hudValue, timeLeft <= 7 && { color: COLORS.danger }]}>
            {timeLeft}s
          </Text>
        </View>
      </View>

      {/* ── Progress dots — shows how many taps are left in this round ── */}
      {phase === 'input' && (
        <View style={styles.progressDots}>
          {sequence.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < inputIndex && styles.progressDotDone,
                i === inputIndex && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── 2×2 tile grid ── */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {([0, 1] as TileId[]).map((id) => (
            <TileButton
              key={id}
              tile={TILES[id]}
              isLit={litTile === id}
              scale={tileScales[id]}
              onPress={() => handleTileTap(id)}
              disabled={phase !== 'input' || inputDisabledRef.current}
            />
          ))}
        </View>
        <View style={styles.gridRow}>
          {([2, 3] as TileId[]).map((id) => (
            <TileButton
              key={id}
              tile={TILES[id]}
              isLit={litTile === id}
              scale={tileScales[id]}
              onPress={() => handleTileTap(id)}
              disabled={phase !== 'input' || inputDisabledRef.current}
            />
          ))}
        </View>
      </View>

    </SafeAreaView>
  );
}

// ─── TileButton sub-component ────────────────────────────────────────────────

function TileButton({
  tile,
  isLit,
  scale,
  onPress,
  disabled,
}: {
  tile: typeof TILES[number];
  isLit: boolean;
  scale: Animated.Value;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.tilePressable}>
      <Animated.View
        style={[
          styles.tile,
          // When lit: full color. When dim: very faded version of the color.
          { backgroundColor: isLit ? tile.color : tile.dimColor },
          isLit && styles.tileLit,
          { transform: [{ scale }] },
        ]}
      />
    </Pressable>
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
  titleText: {
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
    color: COLORS.cyan,
  },
  ruleSubtext: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  countdownNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 88,
    color: COLORS.cyan,
    lineHeight: 100,
  },

  // ── Complete ──
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
    color: COLORS.cyan,
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
  statItem: { flex: 1, alignItems: 'center' },
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
  continueButton: {
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xxxl,
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  hudCenter: {
    alignItems: 'center',
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
  roundLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.cyan,
    letterSpacing: 2,
  },
  roundNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressDotDone: {
    backgroundColor: COLORS.cyan + '66',
  },
  progressDotCurrent: {
    backgroundColor: COLORS.cyan,
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // ── Tile grid ──
  grid: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  tilePressable: {
    flex: 1,
    aspectRatio: 1,
  },
  tile: {
    flex: 1,
    borderRadius: RADIUS.lg,
  },
  tileLit: {
    // Extra brightness effect when flashing — slightly lighter shadow
    shadowColor: '#fff',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
});
