// ─── BallSort — Standard Game ────────────────────────────────────────────────
//
// Classic tube-sort puzzle. Sort colored balls so each tube contains only one
// color. Tap a tube to pick up its top ball, tap another to drop it there.
//
// BOARD: 5 tubes, 4 balls tall, 4 colors, 1 empty tube buffer.
//
// PUZZLE GENERATION: reverse-from-solved (20 random reverse moves) so the
// puzzle is always solvable and never one-move trivial.
//
// SCORING:
//   Solved ≤ 15 moves: 110 pts
//   Solved ≤ 25 moves:  80 pts
//   Any solve:          55 pts

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Config ───────────────────────────────────────────────────────────────────

const TUBE_COUNT  = 5;
const TUBE_DEPTH  = 4;
const COLOR_COUNT = 4; // TUBE_COUNT - 1 (one empty tube)

const BALL_COLORS = ['#7c3aed', '#0e7490', '#b45309', '#be185d'];
const BALL_LABELS = ['A', 'B', 'C', 'D'];
const SHUFFLE_MOVES = 25; // reverse moves from solved → guarantees solvable + non-trivial

// ─── Types ────────────────────────────────────────────────────────────────────

type Tube = number[]; // color index; index 0 = BOTTOM, last = TOP

// ─── Puzzle helpers ───────────────────────────────────────────────────────────

function solvedTubes(): Tube[] {
  const t: Tube[] = [];
  for (let c = 0; c < COLOR_COUNT; c++) t.push(Array(TUBE_DEPTH).fill(c));
  t.push([]); // empty buffer tube
  return t;
}

/** Deep-copy tubes array */
function copyTubes(tubes: Tube[]): Tube[] {
  return tubes.map((t) => [...t]);
}

/** A reverse move: pick the top of `to` and push it onto `from`.
 *  Valid if `from` has room AND (from is empty OR from's top matches). */
function canReverseMove(tubes: Tube[], from: number, to: number): boolean {
  if (from === to) return false;
  if (tubes[to].length === 0) return false; // nothing to pick from `to`
  if (tubes[from].length >= TUBE_DEPTH) return false; // `from` is full
  if (tubes[from].length === 0) return true; // `from` is empty — accept anything
  return tubes[from][tubes[from].length - 1] === tubes[to][tubes[to].length - 1];
}

/** Generate a puzzle by applying SHUFFLE_MOVES random reverse moves from solved state. */
function makeGame(): Tube[] {
  let tubes = solvedTubes();
  let steps = 0;
  let tries = 0;

  while (steps < SHUFFLE_MOVES && tries < 10000) {
    tries++;
    const from = Math.floor(Math.random() * TUBE_COUNT);
    const to   = Math.floor(Math.random() * TUBE_COUNT);
    if (!canReverseMove(tubes, from, to)) continue;
    const next = copyTubes(tubes);
    const ball = next[to].pop()!;
    next[from].push(ball);
    tubes = next;
    steps++;
  }

  return tubes;
}

/** Forward move: can we move the top ball from `from` onto `to`? */
function canDrop(tubes: Tube[], from: number, to: number): boolean {
  if (from === to) return false;
  if (tubes[from].length === 0) return false;
  if (tubes[to].length >= TUBE_DEPTH) return false;
  if (tubes[to].length === 0) return true; // empty tube accepts anything
  return tubes[to][tubes[to].length - 1] === tubes[from][tubes[from].length - 1];
}

function isSolved(tubes: Tube[]): boolean {
  for (const tube of tubes) {
    if (tube.length === 0) continue;
    if (tube.length !== TUBE_DEPTH) return false;
    if (!tube.every((b) => b === tube[0])) return false;
  }
  return true;
}

function isTubeDone(tube: Tube): boolean {
  return tube.length === TUBE_DEPTH && tube.every((b) => b === tube[0]);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

export function BallSort({ onComplete }: Props) {
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'solved'>('ready');
  const [tubes, setTubes]       = useState<Tube[]>(() => makeGame());
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves]       = useState(0);

  const tap = (tubeIdx: number) => {
    if (phase !== 'playing') return;

    if (selected === null) {
      if (tubes[tubeIdx].length === 0) return;
      setSelected(tubeIdx);
      return;
    }

    if (selected === tubeIdx) {
      setSelected(null);
      return;
    }

    if (!canDrop(tubes, selected, tubeIdx)) {
      // Re-select new tube if it has balls
      if (tubes[tubeIdx].length > 0) {
        setSelected(tubeIdx);
      } else {
        setSelected(null);
      }
      return;
    }

    // Execute move
    const next = copyTubes(tubes);
    const ball = next[selected].pop()!;
    next[tubeIdx].push(ball);

    const newMoves = moves + 1;
    setTubes(next);
    setMoves(newMoves);
    setSelected(null);

    if (isSolved(next)) {
      const pts = newMoves <= 15 ? 110 : newMoves <= 25 ? 80 : 55;
      setPhase('solved');
      setTimeout(() => onComplete(pts), 800);
    }
  };

  // ── READY ──────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🧪</Text>
          <Text style={styles.title}>Ball Sort</Text>
          <View style={styles.rulesCard}>
            <Text style={styles.rulesText}>
              Tap a tube to pick up its top ball.{'\n'}
              Tap another tube to drop it there.{'\n\n'}
              You can only drop onto the same color{'\n'}
              or into an empty tube.{'\n\n'}
              Sort every tube so each holds one color.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={() => setPhase('playing')}>
            <Text style={styles.startBtnText}>Let's sort →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── PLAYING / SOLVED ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.gameContainer}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ball Sort</Text>
          <View style={styles.movesPill}>
            <Text style={styles.movesText}>{moves} moves</Text>
          </View>
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          {selected !== null
            ? 'Now tap a tube to drop the ball'
            : 'Tap a tube to pick up the top ball'}
        </Text>

        {/* Tubes */}
        <View style={styles.tubesRow}>
          {tubes.map((tube, tIdx) => {
            const isSelected = tIdx === selected;
            const isDone     = isTubeDone(tube);
            const canReceive = selected !== null && selected !== tIdx && canDrop(tubes, selected, tIdx);

            return (
              <Pressable
                key={tIdx}
                style={[
                  styles.tube,
                  isSelected && styles.tubeSelected,
                  canReceive && styles.tubeCanReceive,
                  isDone     && styles.tubeDone,
                ]}
                onPress={() => tap(tIdx)}
              >
                {/* Empty slots */}
                {Array.from({ length: TUBE_DEPTH - tube.length }).map((_, i) => (
                  <View key={`e${i}`} style={styles.emptySlot} />
                ))}
                {/* Balls — stored bottom-first, rendered top-first */}
                {[...tube].reverse().map((colorId, bIdx) => {
                  const isTopBall = bIdx === 0;
                  return (
                    <View
                      key={bIdx}
                      style={[
                        styles.ball,
                        { backgroundColor: BALL_COLORS[colorId] },
                        isTopBall && isSelected && styles.ballLifted,
                      ]}
                    >
                      <Text style={styles.ballLabel}>{BALL_LABELS[colorId]}</Text>
                    </View>
                  );
                })}
              </Pressable>
            );
          })}
        </View>

        {/* Solved overlay — shown ONLY when solved to not block touch */}
        {phase === 'solved' && (
          <View pointerEvents="none" style={styles.solvedOverlay}>
            <Text style={styles.solvedEmoji}>🎉</Text>
            <Text style={styles.solvedTitle}>Sorted!</Text>
            <Text style={styles.solvedSub}>{moves} moves</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BALL_SIZE  = 46;
const TUBE_WIDTH = 54;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // ── Ready ─────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },

  bigEmoji: { fontSize: 64, lineHeight: 76 },

  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
  },

  rulesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    width: '100%',
  },

  rulesText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },

  startBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  // ── Game ──────────────────────────────────────────────────────────────────
  gameContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: SPACING.sm,
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
    minHeight: 18,
  },

  tubesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-end',
    marginTop: SPACING.xl,
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
    minHeight: TUBE_DEPTH * (BALL_SIZE + 4) + 12,
    justifyContent: 'flex-end',
  },

  tubeSelected: {
    borderColor: COLORS.indigoBright,
    borderWidth: 2,
    backgroundColor: COLORS.indigoBright + '18',
  },

  tubeCanReceive: {
    borderColor: COLORS.green,
    borderWidth: 2,
    backgroundColor: COLORS.green + '12',
  },

  tubeDone: {
    borderColor: COLORS.green + '66',
    backgroundColor: COLORS.green + '0a',
  },

  emptySlot: {
    width: BALL_SIZE,
    height: BALL_SIZE,
  },

  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ballLifted: {
    borderWidth: 2,
    borderColor: '#ffffff',
    opacity: 0.85,
    transform: [{ scale: 1.08 }],
  },

  ballLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Solved overlay ────────────────────────────────────────────────────────
  solvedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.85)',
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
