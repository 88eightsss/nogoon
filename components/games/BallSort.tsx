// ─── BallSort — Standard Game ────────────────────────────────────────────────
//
// Classic tube-sort puzzle. Sort colored balls so each tube contains only one
// color. Tap a tube to pick up the top ball, tap another to drop it there
// (only valid if top of destination is same color OR tube is empty).
//
// BOARD: 5 tubes, 4 balls tall, 4 colors. One tube starts empty (free slot).
//
// SCORING:
//   Solved ≤ 15 moves: 110 pts
//   Solved ≤ 25 moves:  80 pts
//   Any solve:          55 pts
//
// RULE: You can only move the top ball, and only onto the same color or empty.

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Config ───────────────────────────────────────────────────────────────────

const TUBE_COUNT   = 5;
const TUBE_DEPTH   = 4;
const COLOR_COUNT  = 4; // = TUBE_COUNT - 1 (one empty tube)

const BALL_COLORS = ['#7c3aed', '#0e7490', '#b45309', '#be185d']; // purple, teal, amber, pink
const BALL_LABELS = ['A', 'B', 'C', 'D'];

// ─── Board helpers ────────────────────────────────────────────────────────────
// Each tube is an array where index 0 = BOTTOM, index length-1 = TOP

type Tube = number[]; // color index, -1 = empty slot

function makeSolvedTubes(): Tube[] {
  const tubes: Tube[] = [];
  for (let c = 0; c < COLOR_COUNT; c++) {
    tubes.push(Array(TUBE_DEPTH).fill(c));
  }
  tubes.push([]); // one empty tube
  return tubes;
}

function shuffleTubes(tubes: Tube[]): Tube[] {
  // Collect all balls and redistribute randomly across non-empty tubes
  const allBalls: number[] = [];
  for (let t = 0; t < tubes.length - 1; t++) {
    allBalls.push(...tubes[t]);
  }
  // Fisher-Yates shuffle
  for (let i = allBalls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
  }
  const result: Tube[] = [];
  let ptr = 0;
  for (let t = 0; t < tubes.length - 1; t++) {
    result.push(allBalls.slice(ptr, ptr + TUBE_DEPTH));
    ptr += TUBE_DEPTH;
  }
  result.push([]); // keep empty tube
  return result;
}

function isSolvedTubes(tubes: Tube[]): boolean {
  for (const tube of tubes) {
    if (tube.length === 0) continue;
    if (tube.length !== TUBE_DEPTH) return false;
    if (!tube.every((b) => b === tube[0])) return false;
  }
  return true;
}

function makeGame(): Tube[] {
  const solved = makeSolvedTubes();
  let game = shuffleTubes(solved);
  while (isSolvedTubes(game)) game = shuffleTubes(solved);
  return game;
}

function canDrop(from: Tube, to: Tube): boolean {
  if (from.length === 0) return false;
  if (to.length >= TUBE_DEPTH) return false;
  if (to.length === 0) return true; // empty tube accepts anything
  return to[to.length - 1] === from[from.length - 1];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BallSort({ onComplete }: Props) {
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'solved'>('ready');
  const [tubes, setTubes]       = useState<Tube[]>(() => makeGame());
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves]       = useState(0);

  // Per-tube bounce animation
  const tubeScale = useRef<Animated.Value[]>(
    Array.from({ length: TUBE_COUNT }, () => new Animated.Value(1))
  ).current;

  const bounceTube = (idx: number) => {
    Animated.sequence([
      Animated.timing(tubeScale[idx], { toValue: 0.92, duration: 70, useNativeDriver: true }),
      Animated.spring(tubeScale[idx],  { toValue: 1,    damping: 10,  useNativeDriver: true }),
    ]).start();
  };

  const handleTubeTap = useCallback((tubeIdx: number) => {
    bounceTube(tubeIdx);

    if (selected === null) {
      if (tubes[tubeIdx].length === 0) return; // can't select empty tube
      setSelected(tubeIdx);
      return;
    }

    if (selected === tubeIdx) {
      setSelected(null);
      return;
    }

    const from = tubes[selected];
    const to   = tubes[tubeIdx];

    if (!canDrop(from, to)) {
      // Invalid move — deselect
      setSelected(null);
      return;
    }

    // Move top ball from → to
    const next     = tubes.map((t) => [...t]);
    const ball     = next[selected].pop()!;
    next[tubeIdx].push(ball);

    const newMoves = moves + 1;
    setTubes(next);
    setMoves(newMoves);
    setSelected(null);

    if (isSolvedTubes(next)) {
      const pts = newMoves <= 15 ? 110 : newMoves <= 25 ? 80 : 55;
      setPhase('solved');
      setTimeout(() => onComplete(pts), 900);
    }
  }, [tubes, selected, moves]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>🧪</Text>
          <Text style={styles.readyTitle}>Ball Sort</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              Tap a tube to pick up the top ball. Tap another tube to drop it — but only
              if the top ball matches or the tube is empty.{'\n\n'}
              Sort every tube so each holds only one color.
            </Text>
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Let's sort →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / SOLVED
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ball Sort</Text>
          <View style={styles.movesPill}>
            <Text style={styles.movesText}>{moves} moves</Text>
          </View>
        </View>

        {/* ── Hint ── */}
        <Text style={styles.hint}>
          {selected !== null
            ? `Tap a tube to drop the ball`
            : 'Tap a tube to pick up the top ball'}
        </Text>

        {/* ── Tubes ── */}
        <View style={styles.tubesRow}>
          {tubes.map((tube, tIdx) => {
            const isSelected = tIdx === selected;
            const topBall    = tube.length > 0 ? tube[tube.length - 1] : -1;
            return (
              <Animated.View
                key={tIdx}
                style={[
                  styles.tubeWrap,
                  { transform: [{ scale: tubeScale[tIdx] }] },
                ]}
              >
                <Pressable
                  style={[
                    styles.tube,
                    isSelected && { borderColor: '#ffffff', borderWidth: 2 },
                  ]}
                  onPress={() => handleTubeTap(tIdx)}
                >
                  {/* Empty slots (top) */}
                  {Array.from({ length: TUBE_DEPTH - tube.length }).map((_, i) => (
                    <View key={`e${i}`} style={styles.ballEmpty} />
                  ))}
                  {/* Balls (bottom to top, rendered top to bottom in column) */}
                  {[...tube].reverse().map((colorId, bIdx) => {
                    const isTop = bIdx === 0;
                    return (
                      <View
                        key={bIdx}
                        style={[
                          styles.ball,
                          { backgroundColor: BALL_COLORS[colorId] },
                          isTop && isSelected && styles.ballSelected,
                        ]}
                      >
                        <Text style={styles.ballLabel}>{BALL_LABELS[colorId]}</Text>
                      </View>
                    );
                  })}
                </Pressable>

                {/* Tube solved indicator */}
                {tube.length === TUBE_DEPTH && tube.every((b) => b === tube[0]) && (
                  <Text style={styles.tubeCheck}>✓</Text>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* ── Solved overlay ── */}
        {phase === 'solved' && (
          <View style={styles.solvedOverlay}>
            <Text style={styles.solvedEmoji}>🧪</Text>
            <Text style={styles.solvedTitle}>Sorted!</Text>
            <Text style={styles.solvedSub}>{moves} moves</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BALL_SIZE  = 52;
const TUBE_WIDTH = 60;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Ready ─────────────────────────────────────────────────────────────────
  readyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },

  readyEmoji: { fontSize: 72, lineHeight: 84 },

  readyTitle: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
  },

  readyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    width: '100%',
  },

  readyRule: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },

  startButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  // ── Playing ───────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
  },

  movesPill: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },

  movesText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  hint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  tubesRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-end',
    marginTop: SPACING.lg,
  },

  tubeWrap: {
    alignItems: 'center',
    gap: 4,
  },

  tube: {
    width: TUBE_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 4,
    alignItems: 'center',
    overflow: 'hidden',
  },

  ballEmpty: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
  },

  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ballSelected: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  ballLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  tubeCheck: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.green,
  },

  // ── Solved overlay ────────────────────────────────────────────────────────
  solvedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },

  solvedEmoji: { fontSize: 56, lineHeight: 68 },

  solvedTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
  },

  solvedSub: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: COLORS.textMuted,
  },
});
