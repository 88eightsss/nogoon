// ─── ColorSort — Standard Game ───────────────────────────────────────────────
//
// Sort colored tiles into matching groups by tapping: select a tile, then tap
// its destination. No timer, no wrong-move penalty — pure visual puzzle flow.
//
// BOARD: 4×3 grid of 12 tiles in 4 colors (3 tiles each).
//        Solved when every 3-tile color group occupies its own row.
//
// SCORING:
//   Easy solve (≤10 moves): 100 pts
//   Normal solve:            70 pts
//   Any completion:          50 pts minimum
//
// PHASES: 'ready' → 'playing' → 'solved'

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

// ─── Tile colors ──────────────────────────────────────────────────────────────

const PALETTE = [
  { id: 0, bg: '#6d28d9', label: 'A' },  // purple
  { id: 1, bg: '#0e7490', label: 'B' },  // teal
  { id: 2, bg: '#b45309', label: 'C' },  // amber
  { id: 3, bg: '#be185d', label: 'D' },  // pink
];

const COLS = 4;
const ROWS = 3;
const CELL_COUNT = COLS * ROWS; // 12

// ─── Board generation ────────────────────────────────────────────────────────
// Each color appears exactly 3 times. Shuffle until not accidentally solved.

function makeSolvedBoard(): number[] {
  // Row 0: color 0 ×4, Row 1: color 1 ×4 etc — but we use 4 cols × 3 rows = 12
  // Actually 4 colors × 3 tiles = 12. Colors fill rows: row0 = color0, row1=color1, etc.
  const board: number[] = [];
  for (let c = 0; c < PALETTE.length; c++) {
    for (let t = 0; t < ROWS; t++) board.push(c);
  }
  return board;
}

function shuffleBoard(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSolved(board: number[]): boolean {
  // Each row of COLS tiles must be all same color
  for (let row = 0; row < ROWS; row++) {
    const rowColor = board[row * COLS];
    for (let col = 1; col < COLS; col++) {
      if (board[row * COLS + col] !== rowColor) return false;
    }
  }
  return true;
}

function makeBoard(): number[] {
  const solved = makeSolvedBoard();
  let board = shuffleBoard(solved);
  while (isSolved(board)) board = shuffleBoard(solved);
  return board;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ColorSort({ onComplete }: Props) {
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'solved'>('ready');
  const [board, setBoard]       = useState<number[]>(() => makeBoard());
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves]       = useState(0);

  // Per-tile scale animation for tap feedback
  const tileScale = useRef<Animated.Value[]>(
    Array.from({ length: CELL_COUNT }, () => new Animated.Value(1))
  ).current;

  const pulseTile = (idx: number) => {
    Animated.sequence([
      Animated.timing(tileScale[idx], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(tileScale[idx],  { toValue: 1,    damping: 10,  useNativeDriver: true }),
    ]).start();
  };

  const handleTap = useCallback((idx: number) => {
    pulseTile(idx);

    if (selected === null) {
      // Select this tile
      setSelected(idx);
      return;
    }

    if (selected === idx) {
      // Deselect
      setSelected(null);
      return;
    }

    // Swap tiles
    const next = [...board];
    [next[selected], next[idx]] = [next[idx], next[selected]];
    const newMoves = moves + 1;

    setBoard(next);
    setMoves(newMoves);
    setSelected(null);

    if (isSolved(next)) {
      const pts = newMoves <= 10 ? 100 : newMoves <= 20 ? 70 : 50;
      setPhase('solved');
      setTimeout(() => onComplete(pts), 900);
    }
  }, [board, selected, moves]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>🎨</Text>
          <Text style={styles.readyTitle}>Color Sort</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              Tap a tile to select it, then tap another to swap. Sort each row so all
              tiles in a row share the same color.
            </Text>
          </View>
          <View style={styles.colorDots}>
            {PALETTE.map((p) => (
              <View key={p.id} style={[styles.colorDot, { backgroundColor: p.bg }]} />
            ))}
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Sort it →</Text>
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
          <Text style={styles.headerTitle}>Color Sort</Text>
          <View style={styles.movesPill}>
            <Text style={styles.movesText}>{moves} moves</Text>
          </View>
        </View>

        {/* ── Hint ── */}
        <Text style={styles.hint}>
          {selected !== null
            ? 'Now tap a tile to swap with it'
            : 'Tap a tile to select it'}
        </Text>

        {/* ── Grid ── */}
        <View style={styles.grid}>
          {board.map((colorId, idx) => {
            const color  = PALETTE[colorId];
            const isSelected = idx === selected;
            return (
              <Animated.View
                key={idx}
                style={[
                  styles.tileWrap,
                  { transform: [{ scale: tileScale[idx] }] },
                ]}
              >
                <Pressable
                  style={[
                    styles.tile,
                    { backgroundColor: color.bg },
                    isSelected && styles.tileSelected,
                  ]}
                  onPress={() => handleTap(idx)}
                >
                  {isSelected && <View style={styles.tileSelectedRing} />}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {/* ── Row labels ── */}
        <View style={styles.rowLabels}>
          {Array.from({ length: ROWS }, (_, r) => (
            <Text key={r} style={styles.rowLabel}>Row {r + 1}</Text>
          ))}
        </View>

        {/* ── Solved overlay ── */}
        {phase === 'solved' && (
          <View style={styles.solvedOverlay}>
            <Text style={styles.solvedEmoji}>✅</Text>
            <Text style={styles.solvedTitle}>Sorted!</Text>
            <Text style={styles.solvedMoves}>{moves} moves</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const TILE_SIZE = 64;
const TILE_GAP  = 10;

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
    textAlign: 'center',
  },

  readyCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    padding:         SPACING.xl,
    width:           '100%',
  },

  readyRule: {
    fontFamily: FONTS.body,
    fontSize:   15,
    color:      COLORS.textSecondary,
    lineHeight: 22,
    textAlign:  'center',
  },

  colorDots: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  colorDot: {
    width:        28,
    height:       28,
    borderRadius: 14,
  },

  startButton: {
    backgroundColor: COLORS.purple,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   17,
    color:      COLORS.background,
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
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
  },

  headerTitle: {
    fontFamily: FONTS.display,
    fontSize:   28,
    color:      COLORS.textPrimary,
  },

  movesPill: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.full,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },

  movesText: {
    fontFamily: FONTS.mono,
    fontSize:   13,
    color:      COLORS.textMuted,
  },

  hint: {
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      COLORS.textMuted,
    textAlign:  'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           TILE_GAP,
    width:         COLS * TILE_SIZE + (COLS - 1) * TILE_GAP,
    justifyContent: 'flex-start',
  },

  tileWrap: {
    width:  TILE_SIZE,
    height: TILE_SIZE,
  },

  tile: {
    width:        TILE_SIZE,
    height:       TILE_SIZE,
    borderRadius: RADIUS.md,
    alignItems:   'center',
    justifyContent: 'center',
  },

  tileSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },

  tileSelectedRing: {
    position:     'absolute',
    top:          -6,
    left:         -6,
    right:        -6,
    bottom:       -6,
    borderRadius: RADIUS.md + 6,
    borderWidth:  2,
    borderColor:  'rgba(255,255,255,0.4)',
  },

  rowLabels: {
    width:          COLS * TILE_SIZE + (COLS - 1) * TILE_GAP,
    flexDirection:  'row',
    justifyContent: 'space-around',
    marginTop:      -SPACING.sm,
  },

  rowLabel: {
    fontFamily: FONTS.mono,
    fontSize:   10,
    color:      COLORS.textMuted,
    letterSpacing: 0.4,
  },

  // ── Solved overlay ────────────────────────────────────────────────────────
  solvedOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  solvedEmoji: { fontSize: 56, lineHeight: 68 },

  solvedTitle: {
    fontFamily: FONTS.display,
    fontSize:   36,
    color:      COLORS.textPrimary,
  },

  solvedMoves: {
    fontFamily: FONTS.mono,
    fontSize:   16,
    color:      COLORS.textMuted,
  },
});
