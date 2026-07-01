// ─── GemMatch — Standard Game ────────────────────────────────────────────────
//
// Turn-based match-3. Swap adjacent gems to form rows or columns of 3 or more.
// No timer — every move is deliberate. Matched gems clear and new ones fall in.
//
// WIN: Clear 20 gems within 15 moves.
//
// SCORING:
//   20+ gems cleared in ≤ 8 moves: 110 pts
//   20+ gems cleared in ≤ 15 moves: 80 pts
//   Clears 15+ gems:                 55 pts (partial success)

import { useState, useRef, useCallback, useEffect } from 'react';
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

const COLS       = 6;
const ROWS       = 6;
const GEM_TYPES  = 5;
const TARGET_CLEARS = 20;
const MAX_MOVES     = 15;
const CELL_SIZE     = 48;
const CELL_GAP      = 4;

const GEM_COLORS = ['#7c3aed', '#0e7490', '#b45309', '#be185d', '#166534'];
const GEM_EMOJIS = ['💜', '💎', '🔶', '💗', '💚'];

// ─── Board helpers ────────────────────────────────────────────────────────────

type Board = number[][]; // ROWS × COLS, each cell is gem type 0–4 or -1 (empty)

function randomGem(): number { return Math.floor(Math.random() * GEM_TYPES); }

function makeBoard(): Board {
  let board: Board;
  do {
    board = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => randomGem())
    );
  } while (findMatches(board).length > 0); // start with no matches
  return board;
}

interface Match { cells: Array<[number, number]> }

function findMatches(board: Board): Match[] {
  const matches: Match[] = [];
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS - 2) {
      const gem = board[r][c];
      if (gem < 0) { c++; continue; }
      let len = 1;
      while (c + len < COLS && board[r][c + len] === gem) len++;
      if (len >= 3) {
        matches.push({ cells: Array.from({ length: len }, (_, i) => [r, c + i] as [number, number]) });
        c += len;
      } else c++;
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS - 2) {
      const gem = board[r][c];
      if (gem < 0) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && board[r + len][c] === gem) len++;
      if (len >= 3) {
        matches.push({ cells: Array.from({ length: len }, (_, i) => [r + i, c] as [number, number]) });
        r += len;
      } else r++;
    }
  }
  return matches;
}

function clearMatches(board: Board, matches: Match[]): { next: Board; cleared: number } {
  const next = board.map((row) => [...row]);
  let cleared = 0;
  for (const m of matches) {
    for (const [r, c] of m.cells) {
      if (next[r][c] >= 0) { next[r][c] = -1; cleared++; }
    }
  }
  return { next, cleared };
}

function applyGravity(board: Board): Board {
  const next = board.map((row) => [...row]);
  for (let c = 0; c < COLS; c++) {
    // Collect non-empty gems from bottom up
    const gems: number[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (next[r][c] >= 0) gems.push(next[r][c]);
    }
    // Fill column from bottom
    for (let r = ROWS - 1; r >= 0; r--) {
      next[r][c] = gems.shift() ?? randomGem();
    }
  }
  return next;
}

function swapCells(board: Board, r1: number, c1: number, r2: number, c2: number): Board {
  const next = board.map((row) => [...row]);
  [next[r1][c1], next[r2][c2]] = [next[r2][c2], next[r1][c1]];
  return next;
}

function adjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GemMatch({ onComplete }: Props) {
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'done'>('ready');
  const [board, setBoard]       = useState<Board>(() => makeBoard());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [moves, setMoves]       = useState(0);
  const [cleared, setCleared]   = useState(0);
  const [processing, setProcessing] = useState(false);

  // Per-cell flash animation (for matches)
  const cellFlash = useRef<Animated.Value[][]>(
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => new Animated.Value(1))
    )
  ).current;

  // Flash matched cells then resolve
  const flashAndClear = (b: Board, matches: Match[], totalCleared: number, moveCount: number) => {
    const anims = matches.flatMap((m) =>
      m.cells.map(([r, c]) =>
        Animated.sequence([
          Animated.timing(cellFlash[r][c], { toValue: 1.4, duration: 120, useNativeDriver: true }),
          Animated.timing(cellFlash[r][c], { toValue: 0,   duration: 150, useNativeDriver: true }),
        ])
      )
    );

    Animated.parallel(anims).start(() => {
      // Reset flash values
      matches.forEach((m) => m.cells.forEach(([r, c]) => cellFlash[r][c].setValue(1)));

      const { next: cleared_board, cleared: newClears } = clearMatches(b, matches);
      const settled = applyGravity(cleared_board);
      const total   = totalCleared + newClears;

      setBoard(settled);
      setCleared(total);

      // Check for cascading matches
      const cascadeMatches = findMatches(settled);
      if (cascadeMatches.length > 0) {
        setTimeout(() => flashAndClear(settled, cascadeMatches, total, moveCount), 200);
        return;
      }

      setProcessing(false);

      // Check win/loss
      if (total >= TARGET_CLEARS) {
        setPhase('done');
        const pts = moveCount <= 8 ? 110 : moveCount <= 15 ? 80 : 55;
        setTimeout(() => onComplete(pts), 600);
      } else if (moveCount >= MAX_MOVES) {
        setPhase('done');
        const pts = total >= 15 ? 55 : 30;
        setTimeout(() => onComplete(pts), 600);
      }
    });
  };

  const handleTap = useCallback((r: number, c: number) => {
    if (processing || phase !== 'playing') return;

    if (selected === null) {
      setSelected([r, c]);
      return;
    }

    const [sr, sc] = selected;
    setSelected(null);

    if (sr === r && sc === c) return; // deselect

    if (!adjacent(sr, sc, r, c)) {
      setSelected([r, c]); // reselect new cell
      return;
    }

    const swapped = swapCells(board, sr, sc, r, c);
    const matches = findMatches(swapped);

    if (matches.length === 0) {
      // Invalid swap — no matches, don't count it
      return;
    }

    const newMoves = moves + 1;
    setMoves(newMoves);
    setBoard(swapped);
    setProcessing(true);

    setTimeout(() => flashAndClear(swapped, matches, cleared, newMoves), 100);
  }, [board, selected, moves, cleared, processing, phase]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>💎</Text>
          <Text style={styles.readyTitle}>Gem Match</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              Swap adjacent gems to match 3 or more in a row or column. Clear {TARGET_CLEARS} gems
              in {MAX_MOVES} moves to win.{'\n\n'}
              Only valid swaps (ones that create a match) are counted as moves.
            </Text>
          </View>
          <View style={styles.gemRow}>
            {GEM_EMOJIS.map((e, i) => (
              <Text key={i} style={styles.gemPreview}>{e}</Text>
            ))}
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Play →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / DONE
  // ─────────────────────────────────────────────────────────────────────────

  const clearedPct = Math.min(cleared / TARGET_CLEARS, 1);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>CLEARED</Text>
            <Text style={styles.headerStat}>{cleared} / {TARGET_CLEARS}</Text>
          </View>
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBar, { width: `${clearedPct * 100}%` as any }]} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.headerLabel}>MOVES</Text>
            <Text style={[styles.headerStat, moves > MAX_MOVES - 3 && { color: COLORS.hotPink }]}>
              {MAX_MOVES - moves} left
            </Text>
          </View>
        </View>

        {/* ── Hint ── */}
        <Text style={styles.hint}>
          {selected ? 'Tap an adjacent gem to swap' : 'Tap a gem to select it'}
        </Text>

        {/* ── Board ── */}
        <View style={styles.grid}>
          {board.map((row, r) =>
            row.map((gem, c) => {
              const isSelected = selected && selected[0] === r && selected[1] === c;
              return (
                <Animated.View
                  key={`${r}-${c}`}
                  style={[
                    styles.cellWrap,
                    { transform: [{ scale: cellFlash[r][c] }] },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.cell,
                      { backgroundColor: GEM_COLORS[gem] + '33', borderColor: GEM_COLORS[gem] + '66' },
                      isSelected && { borderColor: '#ffffff', borderWidth: 2 },
                    ]}
                    onPress={() => handleTap(r, c)}
                  >
                    <Text style={styles.gemEmoji}>{GEM_EMOJIS[gem]}</Text>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </View>

        {/* ── Done overlay ── */}
        {phase === 'done' && (
          <View style={styles.doneOverlay}>
            <Text style={styles.doneEmoji}>{cleared >= TARGET_CLEARS ? '💎' : '💫'}</Text>
            <Text style={styles.doneTitle}>
              {cleared >= TARGET_CLEARS ? 'Cleared!' : `${cleared} gems cleared`}
            </Text>
            <Text style={styles.doneSub}>{moves} moves</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    fontSize:   34,
    color:      COLORS.textPrimary,
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

  gemRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  gemPreview: { fontSize: 28 },

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
    gap: SPACING.md,
  },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
    gap:            SPACING.md,
  },

  headerLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      10,
    color:         COLORS.textMuted,
    letterSpacing: 0.8,
  },

  headerStat: {
    fontFamily: FONTS.bodyBold,
    fontSize:   18,
    color:      COLORS.textPrimary,
  },

  progressBarWrap: {
    flex:            1,
    height:          6,
    backgroundColor: COLORS.surface,
    borderRadius:    3,
    overflow:        'hidden',
  },

  progressBar: {
    height:          6,
    backgroundColor: COLORS.purple,
    borderRadius:    3,
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
    width:         COLS * CELL_SIZE + (COLS - 1) * CELL_GAP,
    gap:           CELL_GAP,
    marginTop:     SPACING.sm,
  },

  cellWrap: {
    width:  CELL_SIZE,
    height: CELL_SIZE,
  },

  cell: {
    width:          CELL_SIZE,
    height:         CELL_SIZE,
    borderRadius:   RADIUS.sm,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  gemEmoji: { fontSize: 22 },

  // ── Done overlay ──────────────────────────────────────────────────────────
  doneOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  doneEmoji: { fontSize: 56, lineHeight: 68 },

  doneTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
  },

  doneSub: {
    fontFamily: FONTS.mono,
    fontSize:   16,
    color:      COLORS.textMuted,
  },
});
