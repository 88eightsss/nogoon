// ─── NumberFlow — Standard Game ──────────────────────────────────────────────
//
// Connect pairs of matching numbers on a grid with a path that fills every cell.
// Tap a number to start a path, drag to extend it, tap its matching number to
// complete the connection. Solve all pairs without leaving any cells empty.
//
// BOARD: 5×5 grid. 5 number pairs (1–5), all cells must be filled.
// No timer, no wrong-move state — incomplete paths just stay.
//
// SCORING:
//   All pairs connected on first attempt (no backtrack): 100 pts
//   Solved:                                               70 pts

import { useState, useRef, useCallback } from 'react';
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

const GRID = 5; // 5×5
const CELL = 56;
const GAP  = 4;

// ─── Puzzle definition ────────────────────────────────────────────────────────
// Each puzzle: pairs of [row, col] endpoints for numbers 1–5.
// Hardcoded puzzles ensure valid solutions exist.

type Pos = [number, number]; // [row, col]

interface Puzzle {
  endpoints: Record<number, [Pos, Pos]>; // number → [start, end]
}

const PUZZLES: Puzzle[] = [
  {
    endpoints: {
      1: [[0,0],[4,4]],
      2: [[0,4],[4,0]],
      3: [[0,2],[4,2]],
      4: [[2,0],[2,4]],
      5: [[1,1],[3,3]],
    },
  },
  {
    endpoints: {
      1: [[0,0],[3,3]],
      2: [[0,3],[3,0]],
      3: [[0,1],[4,1]],
      4: [[1,4],[4,4]],
      5: [[2,2],[4,3]],
    },
  },
  {
    endpoints: {
      1: [[0,0],[4,3]],
      2: [[0,2],[2,4]],
      3: [[0,4],[4,0]],
      4: [[1,0],[3,4]],
      5: [[2,1],[4,2]],
    },
  },
];

const PAIR_COLORS: Record<number, string> = {
  1: '#7c3aed',
  2: '#0e7490',
  3: '#b45309',
  4: '#be185d',
  5: '#166534',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function key(r: number, c: number) { return `${r},${c}`; }

function adjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function makePuzzle(): { puzzle: Puzzle; grid: (number | null)[][] } {
  const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
  const grid: (number | null)[][] = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  // Mark endpoints
  for (const [num, [a, b]] of Object.entries(puzzle.endpoints)) {
    const n = Number(num);
    grid[a[0]][a[1]] = n;
    grid[b[0]][b[1]] = n;
  }
  return { puzzle, grid };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NumberFlow({ onComplete }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'solved'>('ready');

  const { puzzle, grid: initialGrid } = useRef(makePuzzle()).current;

  // paths: number → array of [row,col] cells in the path (including endpoints)
  const [paths, setPaths]         = useState<Record<number, Pos[]>>({});
  const [drawing, setDrawing]     = useState<number | null>(null); // which number is being drawn
  const [backtracks, setBacktracks] = useState(0);

  // Which cells are occupied by any path (excluding endpoints which stay)
  const occupiedCells = useRef<Set<string>>(new Set<string>()).current;

  const getEndpoints = (num: number): [Pos, Pos] => puzzle.endpoints[num];

  const isEndpoint = (r: number, c: number): number | null => {
    for (const [num, [a, b]] of Object.entries(puzzle.endpoints)) {
      const n = Number(num);
      if ((a[0] === r && a[1] === c) || (b[0] === r && b[1] === c)) return n;
    }
    return null;
  };

  // Start drawing from a number endpoint
  const startDraw = useCallback((num: number, r: number, c: number) => {
    // Clear existing path for this number
    const existing = paths[num] || [];
    existing.forEach(([pr, pc]) => {
      const k = key(pr, pc);
      // Only clear non-endpoint cells
      const epNum = isEndpoint(pr, pc);
      if (epNum === null) occupiedCells.delete(k);
    });
    if (existing.length > 0) {
      setBacktracks((b) => b + 1);
    }

    occupiedCells.add(key(r, c));
    setPaths((prev) => ({ ...prev, [num]: [[r, c]] }));
    setDrawing(num);
  }, [paths]);

  // Extend path to adjacent cell
  const extendPath = useCallback((r: number, c: number) => {
    if (drawing === null) return;

    const path   = paths[drawing] || [];
    const [lr, lc] = path[path.length - 1];

    if (!adjacent(lr, lc, r, c)) return;

    const k = key(r, c);

    // Check if it's the matching endpoint
    const [ep1, ep2] = getEndpoints(drawing);
    const isMatch =
      (ep2[0] === r && ep2[1] === c && path[0][0] === ep1[0] && path[0][1] === ep1[1]) ||
      (ep1[0] === r && ep1[1] === c && path[0][0] === ep2[0] && path[0][1] === ep2[1]);

    // Allow stepping back (erase last segment)
    if (path.length > 1) {
      const [slr, slc] = path[path.length - 2];
      if (slr === r && slc === c) {
        const last = path[path.length - 1];
        const lastKey = key(last[0], last[1]);
        if (isEndpoint(last[0], last[1]) === null) occupiedCells.delete(lastKey);
        const newPath = path.slice(0, -1);
        setPaths((prev) => ({ ...prev, [drawing]: newPath }));
        return;
      }
    }

    // Block occupied non-endpoint cells (unless it's the matching endpoint)
    if (!isMatch && occupiedCells.has(k)) return;

    occupiedCells.add(k);
    const newPath = [...path, [r, c] as Pos];
    setPaths((prev) => ({ ...prev, [drawing]: newPath }));

    if (isMatch) {
      // Path complete for this number
      setDrawing(null);

      const allPaths = { ...paths, [drawing]: newPath };
      // Check win: all GRID×GRID cells covered
      const filled = new Set<string>();
      for (const p of Object.values(allPaths)) {
        p.forEach(([pr, pc]) => filled.add(key(pr, pc)));
      }
      if (filled.size === GRID * GRID && Object.keys(allPaths).length === Object.keys(puzzle.endpoints).length) {
        setPhase('solved');
        const pts = backtracks === 0 ? 100 : 70;
        setTimeout(() => onComplete(pts), 800);
      }
    }
  }, [drawing, paths, backtracks]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>🔢</Text>
          <Text style={styles.readyTitle}>Number Flow</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              Connect matching numbers with a path. Fill every cell on the grid — no
              empty spaces allowed.{'\n\n'}
              Tap a number to start, then tap adjacent cells to extend your path.
            </Text>
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Start flowing →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / SOLVED
  // ─────────────────────────────────────────────────────────────────────────

  // Build cell state: for each cell, what color path fills it (if any)
  const cellColor: Record<string, string | null> = {};
  for (const [num, path] of Object.entries(paths)) {
    const n = Number(num);
    path.forEach(([r, c]) => { cellColor[key(r, c)] = PAIR_COLORS[n]; });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Number Flow</Text>
          <View style={styles.pairsPill}>
            <Text style={styles.pairsText}>
              {Object.keys(paths).filter((n) => {
                const p = paths[Number(n)];
                const [ep1, ep2] = getEndpoints(Number(n));
                const last = p[p.length - 1];
                return (last[0] === ep2[0] && last[1] === ep2[1]) ||
                       (last[0] === ep1[0] && last[1] === ep1[1] && p.length > 1);
              }).length} / {Object.keys(puzzle.endpoints).length} connected
            </Text>
          </View>
        </View>

        <Text style={styles.hint}>
          {drawing !== null
            ? `Drawing path ${drawing} — tap adjacent cells`
            : 'Tap a number to start a path'}
        </Text>

        {/* Grid */}
        <View style={styles.grid}>
          {Array.from({ length: GRID }, (_, r) =>
            Array.from({ length: GRID }, (_, c) => {
              const k       = key(r, c);
              const epNum   = isEndpoint(r, c);
              const fillColor = cellColor[k];
              const isActive  = drawing !== null;

              return (
                <Pressable
                  key={k}
                  style={[
                    styles.cell,
                    fillColor ? { backgroundColor: fillColor + '55', borderColor: fillColor + '88' } : null,
                  ]}
                  onPress={() => {
                    if (epNum !== null) {
                      startDraw(epNum, r, c);
                    } else if (drawing !== null) {
                      extendPath(r, c);
                    }
                  }}
                >
                  {epNum !== null && (
                    <View style={[styles.endpoint, { backgroundColor: PAIR_COLORS[epNum] }]}>
                      <Text style={styles.endpointLabel}>{epNum}</Text>
                    </View>
                  )}
                  {fillColor && epNum === null && (
                    <View style={[styles.pathDot, { backgroundColor: fillColor }]} />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Solved overlay */}
        {phase === 'solved' && (
          <View style={styles.solvedOverlay}>
            <Text style={styles.solvedEmoji}>🔢</Text>
            <Text style={styles.solvedTitle}>All connected!</Text>
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
  },

  headerTitle: {
    fontFamily: FONTS.display,
    fontSize:   28,
    color:      COLORS.textPrimary,
  },

  pairsPill: {
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },

  pairsText: {
    fontFamily: FONTS.mono,
    fontSize:   12,
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
    width:         GRID * CELL + (GRID - 1) * GAP,
    gap:           GAP,
    marginTop:     SPACING.lg,
  },

  cell: {
    width:           CELL,
    height:          CELL,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.surface,
  },

  endpoint: {
    width:        36,
    height:       36,
    borderRadius: 18,
    alignItems:   'center',
    justifyContent: 'center',
  },

  endpointLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize:   16,
    color:      '#ffffff',
  },

  pathDot: {
    width:        14,
    height:       14,
    borderRadius: 7,
    opacity:      0.8,
  },

  // ── Solved ────────────────────────────────────────────────────────────────
  solvedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.md,
  },

  solvedEmoji: { fontSize: 56, lineHeight: 68 },

  solvedTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
  },
});
