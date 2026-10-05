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
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { ProceedButton } from '@/components/ui/ProceedButton';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';

// ─── Game constants ────────────────────────────────────────────────────────────

const GAME_DURATION_S   = 30;
const FLASH_DURATION_MS = 500;   // how long each tile stays lit during playback
const FLASH_GAP_MS      = 200;   // pause between flashes
const BASE_POINTS       = 15;    // points per completed round
const SPEED_BONUS       = 5;     // bonus for completing a round in < 3 seconds
const SPEED_THRESHOLD   = 3000;  // ms

// ─── 80s arcade neon palette ──────────────────────────────────────────────────

const NEON = {
  pink:    '#ff2d78',
  blue:    '#00e5ff',
  green:   '#39ff14',
  yellow:  '#ffe600',
  bg:      '#000000',
  surface: '#0c0c1e',
  border:  '#1a1a40',
  text:    '#ffffff',
  muted:   '#555577',
};

// ─── Tile definitions — 4 colored tiles in a 2×2 grid ────────────────────────

const TILES = [
  { id: 0, color: NEON.pink,   dimColor: '#2a0010' },
  { id: 1, color: NEON.blue,   dimColor: '#001520' },
  { id: 2, color: NEON.green,  dimColor: '#001500' },
  { id: 3, color: NEON.yellow, dimColor: '#1a1400' },
] as const;

type TileId = 0 | 1 | 2 | 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = 'countdown' | 'showing' | 'input' | 'complete';

export interface PatternMemoryProps {
  onComplete: (score: number) => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PatternMemory({ onComplete }: PatternMemoryProps) {
  const schedule = useSafeTimeout();   // timers are cancelled if the player leaves mid-finish

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
        useNativeDriver: true,
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
          schedule(() => startRound([]), 0);
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

      schedule(() => {
        setLitTile(null);
        i++;
        schedule(flashNext, FLASH_GAP_MS);
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
      schedule(() => startRound(sequence), 600);
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
    timeLeft > 15 ? NEON.green :
    timeLeft > 7  ? NEON.yellow :
                    NEON.pink;

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Countdown
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'countdown') {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.arcadeTitle}>PATTERN{'\n'}MEMORY</Text>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleText}>
            WATCH THE TILES LIGHT UP{'\n'}TAP THEM BACK{' '}
            <Text style={[styles.ruleText, { color: NEON.blue }]}>IN ORDER</Text>
          </Text>
          <Text style={styles.ruleSubtext}>ONE WRONG TAP = GAME OVER</Text>
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
        <Text style={styles.gameOverText}>GAME OVER</Text>
        <Text style={styles.finalScore}>{String(score).padStart(6, '0')}</Text>
        <Text style={styles.finalScoreLabel}>SCORE</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: NEON.green }]}>{round}</Text>
            <Text style={styles.statLabel}>ROUNDS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: NEON.blue }]}>{sequence.length}</Text>
            <Text style={styles.statLabel}>SEQ LEN</Text>
          </View>
        </View>
        <ProceedButton label="Continue →" onPress={() => onComplete(score)} />
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Showing / Input
  // ══════════════════════════════════════════════════════════════════════════

  const phaseColor = phase === 'showing' ? NEON.yellow : NEON.green;

  return (
    <SafeAreaView style={styles.gameContainer}>

      {/* ── Timer bar ── */}
      <View style={styles.timerTrack}>
        <Animated.View
          style={[
            styles.timerFill,
            {
              transform: [{ scaleX: timerBarWidth }],
              transformOrigin: 'left',
              backgroundColor: timerColor,
            },
          ]}
        />
      </View>

      {/* ── HUD ── */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{String(score).padStart(5, '0')}</Text>
        </View>
        <View style={styles.hudCenter}>
          <Text style={[styles.phaseLabel, { color: phaseColor }]}>
            {phase === 'showing' ? '◉ WATCH' : '▶ TAP!'}
          </Text>
          <Text style={styles.roundNumber}>LVL {String(round).padStart(2, '0')}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>TIME</Text>
          <Text style={[styles.hudValue, timeLeft <= 7 && { color: NEON.pink }]}>
            {String(timeLeft).padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* ── Progress dots ── */}
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
          { backgroundColor: isLit ? tile.color : tile.dimColor },
          isLit && {
            shadowColor: tile.color,
            shadowOpacity: 0.9,
            shadowRadius: 20,
            elevation: 12,
            borderColor: tile.color,
          },
          !isLit && { borderColor: tile.color + '55' },
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
    backgroundColor: NEON.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // ── Countdown ──
  arcadeTitle: {
    fontFamily: FONTS.monoBold,
    fontSize: 36,
    color: NEON.pink,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: SPACING.xl,
    textShadowColor: NEON.pink,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  ruleBox: {
    alignItems: 'center',
    backgroundColor: NEON.surface,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: NEON.blue + '66',
    padding: SPACING.xl,
    marginBottom: SPACING.xxxl,
    width: '100%',
  },
  ruleText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: NEON.text,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 1,
  },
  ruleSubtext: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: NEON.pink,
    marginTop: SPACING.md,
    letterSpacing: 1.5,
  },
  countdownNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 96,
    color: NEON.yellow,
    lineHeight: 108,
    textShadowColor: NEON.yellow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },

  // ── Complete ──
  gameOverText: {
    fontFamily: FONTS.monoBold,
    fontSize: 38,
    color: NEON.pink,
    letterSpacing: 6,
    marginBottom: SPACING.xl,
    textShadowColor: NEON.pink,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  finalScore: {
    fontFamily: FONTS.monoBold,
    fontSize: 72,
    color: NEON.yellow,
    lineHeight: 80,
    textShadowColor: NEON.yellow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  finalScoreLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: NEON.muted,
    letterSpacing: 4,
    marginBottom: SPACING.xxl,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEON.surface,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: NEON.border,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    color: NEON.text,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: NEON.muted,
    marginTop: 2,
    letterSpacing: 2,
  },
  statDivider: {
    width: 2,
    height: 36,
    backgroundColor: NEON.border,
  },

  // ── Playing screen ──
  gameContainer: {
    flex: 1,
    backgroundColor: NEON.bg,
  },
  timerTrack: {
    height: 6,
    backgroundColor: NEON.border,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: 1,
    overflow: 'hidden',
  },
  timerFill: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  hudCenter: { alignItems: 'center' },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: NEON.muted,
    letterSpacing: 2,
  },
  hudValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 26,
    color: NEON.text,
    letterSpacing: 2,
  },
  phaseLabel: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    letterSpacing: 2,
  },
  roundNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: NEON.text,
    letterSpacing: 3,
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
    borderRadius: 2,
    backgroundColor: NEON.border,
  },
  progressDotDone: {
    backgroundColor: NEON.blue + '55',
  },
  progressDotCurrent: {
    backgroundColor: NEON.blue,
    width: 12,
    height: 12,
    borderRadius: 2,
    shadowColor: NEON.blue,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
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
    borderRadius: 6,
    borderWidth: 2,
  },
});
