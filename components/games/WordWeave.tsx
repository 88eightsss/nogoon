// ─── WordWeave — Standard Game ───────────────────────────────────────────────
//
// Find hidden words in a 4×4 letter grid by SLIDING your finger across
// connected letters (or tapping them one by one).
// Letters connect in any direction including diagonals.
// No timer — discovery at your own pace.
//
// WIN: Find 5 words from the grid.
//
// SCORING:
//   5 words found in ≤ 10 attempts: 100 pts
//   5 words found:                    75 pts
//
// INPUT:
//   Slide — drag finger across letters to trace a word, lift to submit.
//   Tap   — tap letters individually; tap Submit or lift-release to submit.

import { useState, useRef, useCallback, useMemo } from 'react';
import { WORD_DICT } from '@/constants/wordList';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import * as Haptics from 'expo-haptics';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';
import { Feather } from '@expo/vector-icons';

// ─── Grid constants ───────────────────────────────────────────────────────────

const GRID     = 4;
const CELL_SIZE = 70;
const CELL_GAP  = 8;
const GRID_SIZE = GRID * CELL_SIZE + (GRID - 1) * CELL_GAP;

// ─── Procedural grid generation ───────────────────────────────────────────────
// Builds a random 4×4 letter grid biased toward common English letters,
// then validates it contains at least 5 valid words (3–5 letters, 8-dir paths).
// Typical generation: 1-2 attempts, each ~10ms — well under a single frame.

// Letter pool weighted by English frequency (E, T, A, O, I, N, S, R most common)
const LETTER_POOL =
  'EEEEEEEEETTTTTTTTAAAAAAAIIIIIIIOOOOOOONNNNNNSSSSSSRRRRRRHHHHLLLLDDDDCCCUUUMMMFFFGGPPPBBWWYYVVKK';

function randomLetter(): string {
  return LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
}

function generateRawGrid(): string[][] {
  return Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, randomLetter)
  );
}

// DFS that finds words in the grid — bails out as soon as MIN_WORDS are found.
// Limited to depth 5 to keep it fast (max 16 × 8^4 ≈ 65k paths, early exits cut it ~90%).
const MIN_WORDS = 5;
const MAX_DEPTH  = 5;

function hasEnoughWords(grid: string[][]): boolean {
  const found = new Set<string>();

  function dfs(path: Array<[number, number]>): boolean {
    const word = pathToWord(path, grid);
    if (word.length >= 3 && WORD_DICT.has(word)) found.add(word);
    if (found.size >= MIN_WORDS) return true;
    if (path.length >= MAX_DEPTH) return false;

    const [r, c] = path[path.length - 1];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (path.some(([pr, pc]) => pr === nr && pc === nc)) continue;
        if (dfs([...path, [nr, nc]])) return true;
      }
    }
    return false;
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (dfs([[r, c]])) return true;
    }
  }
  return false;
}

function makeGrid(): string[][] {
  let grid: string[][];
  do { grid = generateRawGrid(); } while (!hasEnoughWords(grid));
  return grid;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);
}

function pathToWord(path: Array<[number, number]>, grid: string[][]): string {
  return path.map(([r, c]) => grid[r][c]).join('');
}

// Cell center position relative to grid top-left
function cellCenter(r: number, c: number) {
  return {
    x: c * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
    y: r * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
  };
}

// ─── Connection line between two cells ───────────────────────────────────────

function ConnectionLine({
  from, to, color,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
}) {
  const a = cellCenter(from[0], from[1]);
  const b = cellCenter(to[0], to[1]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX   = (a.x + b.x) / 2;
  const midY   = (a.y + b.y) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position:  'absolute',
        width:     length,
        height:    4,
        borderRadius: 2,
        backgroundColor: color + 'aa',
        top:       midY - 2,
        left:      midX - length / 2,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WordWeave({ onComplete }: Props) {
  const schedule = useSafeTimeout();
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');

  // Generate a fresh random grid on each game — guaranteed ≥5 valid words.
  const grid = useRef(makeGrid()).current;

  const [currentPath, setCurrentPath] = useState<Array<[number, number]>>([]);
  const [foundWords,  setFoundWords]  = useState<string[]>([]);
  const [attempts,    setAttempts]    = useState(0);
  const [lastResult,  setLastResult]  = useState<'found' | 'invalid' | null>(null);
  const [isSliding,   setIsSliding]   = useState(false); // true while finger is dragging

  const TARGET_WORDS = 5;

  // Current path in a ref too — PanResponder callbacks capture the closure
  const pathRef = useRef<Array<[number, number]>>([]);

  // Grid absolute screen position — measured when grid lays out
  const gridOrigin = useRef({ x: 0, y: 0 });
  const gridRef    = useRef<View>(null);

  // Cell scale animation per letter
  const cellScales = useRef<Animated.Value[][]>(
    Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => new Animated.Value(1))
    )
  ).current;

  const bounceLetter = useCallback((r: number, c: number) => {
    Animated.sequence([
      Animated.timing(cellScales[r][c], { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(cellScales[r][c], { toValue: 1, damping: 10, useNativeDriver: true }),
    ]).start();
  }, [cellScales]);

  // Submit whatever is in pathRef
  const submitPath = useCallback((path: Array<[number, number]>) => {
    if (path.length < 3) {
      setCurrentPath([]);
      pathRef.current = [];
      return;
    }

    const word = pathToWord(path, grid);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setCurrentPath([]);
    pathRef.current = [];

    if (WORD_DICT.has(word)) {
      setFoundWords((prev) => {
        if (prev.includes(word)) {
          // Already found — treat as invalid
          setLastResult('invalid');
          schedule(() => setLastResult(null), 1200);
          return prev;
        }
        const next = [...prev, word];
        setLastResult('found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (next.length >= TARGET_WORDS) {
          setPhase('done');
          const pts = newAttempts <= 10 ? 100 : 75;
          schedule(() => onComplete(pts), 900);
        } else {
          schedule(() => setLastResult(null), 1200);
        }
        return next;
      });
    } else {
      setLastResult('invalid');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      schedule(() => setLastResult(null), 1200);
    }
  }, [grid, attempts, onComplete]);

  // Keep submitPath in a ref so PanResponder can call the latest version
  const submitPathRef = useRef(submitPath);
  submitPathRef.current = submitPath;

  // ── Cell hit-test from absolute page coords ───────────────────────────────
  const getCellAt = useCallback((pageX: number, pageY: number): [number, number] | null => {
    const localX = pageX - gridOrigin.current.x;
    const localY = pageY - gridOrigin.current.y;
    if (localX < 0 || localY < 0 || localX > GRID_SIZE || localY > GRID_SIZE) return null;

    const col = Math.floor(localX / (CELL_SIZE + CELL_GAP));
    const row = Math.floor(localY / (CELL_SIZE + CELL_GAP));
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;

    // Ensure finger is inside the cell (not in the gap between cells)
    const cellX = localX - col * (CELL_SIZE + CELL_GAP);
    const cellY = localY - row * (CELL_SIZE + CELL_GAP);
    if (cellX > CELL_SIZE || cellY > CELL_SIZE) return null;

    return [row, col];
  }, []);

  // ── PanResponder ──────────────────────────────────────────────────────────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderTerminationRequest: () => false, // don't yield to ScrollView

    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const cell = getCellAt(pageX, pageY);
      if (!cell) return;
      setIsSliding(true);
      setLastResult(null);
      pathRef.current = [cell];
      setCurrentPath([cell]);
      bounceLetter(cell[0], cell[1]);
      Haptics.selectionAsync();
    },

    onPanResponderMove: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const cell = getCellAt(pageX, pageY);
      if (!cell) return;

      const path = pathRef.current;
      const last = path[path.length - 1];
      if (!last) return;

      // Same cell — ignore
      if (last[0] === cell[0] && last[1] === cell[1]) return;
      // Must be adjacent
      if (!adjacent(last[0], last[1], cell[0], cell[1])) return;
      // No cell reuse
      if (path.some(([r, c]) => r === cell[0] && c === cell[1])) return;

      const next = [...path, cell];
      pathRef.current = next;
      setCurrentPath(next);
      bounceLetter(cell[0], cell[1]);
      Haptics.selectionAsync();
    },

    onPanResponderRelease: (evt, gestureState) => {
      setIsSliding(false);
      const isTap = Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8;

      if (isTap) {
        // Pure tap — toggle cell into/out of path
        const { pageX, pageY } = evt.nativeEvent;
        const cell = getCellAt(pageX, pageY);
        if (cell) {
          const path = pathRef.current;
          const last = path[path.length - 1];

          // Tap last cell — backtrack
          if (last && last[0] === cell[0] && last[1] === cell[1]) {
            const next = path.slice(0, -1);
            pathRef.current = next;
            setCurrentPath(next);
            bounceLetter(cell[0], cell[1]);
            return;
          }

          // Can't reach — ignore
          if (last && !adjacent(last[0], last[1], cell[0], cell[1])) return;
          if (path.some(([r, c]) => r === cell[0] && c === cell[1])) return;

          const next = [...path, cell] as Array<[number, number]>;
          pathRef.current = next;
          setCurrentPath(next);
          bounceLetter(cell[0], cell[1]);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return;
      }

      // Slide — auto-submit
      submitPathRef.current(pathRef.current);
    },

    onPanResponderTerminate: () => {
      setIsSliding(false);
      setCurrentPath([]);
      pathRef.current = [];
    },
  }), [getCellAt, bounceLetter]);

  // No standalone tap handler — taps are handled in onPanResponderRelease
  // by detecting low dx/dy displacement (< 8px = tap, ≥ 8px = slide).

  const clearPath = useCallback(() => {
    pathRef.current = [];
    setCurrentPath([]);
  }, []);

  // ── Derived rendering helpers ─────────────────────────────────────────────
  const isInPath  = (r: number, c: number) => currentPath.some(([pr, pc]) => pr === r && pc === c);
  const pathOrder = (r: number, c: number) => {
    const i = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    return i >= 0 ? i + 1 : null;
  };

  const currentWord = pathToWord(currentPath, grid);
  const pathColor   = lastResult === 'found'
    ? COLORS.green
    : lastResult === 'invalid'
      ? COLORS.danger
      : COLORS.purple;

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Feather name="feather" size={56} color={COLORS.cyan} />
          <Text style={styles.readyTitle}>Word Weave</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              <Text style={{ color: COLORS.purple, fontFamily: FONTS.bodyBold }}>Slide your finger</Text>
              {' '}across letters to trace a word. Lift to submit.{'\n\n'}
              Letters must connect in any direction including diagonals.{'\n\n'}
              Find {TARGET_WORDS} words to win.
            </Text>
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Start weaving</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / DONE
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Word Weave</Text>
          <View style={styles.foundPill}>
            <Text style={styles.foundText}>{foundWords.length} / {TARGET_WORDS}</Text>
          </View>
        </View>

        {/* ── Found word chips ── */}
        <View style={styles.foundRow}>
          {foundWords.map((w) => (
            <View key={w} style={styles.foundChip}>
              <Text style={styles.foundChipText}>{w}</Text>
            </View>
          ))}
        </View>

        {/* ── Grid with PanResponder ── */}
        <View
          ref={gridRef}
          onLayout={() => {
            // Re-measure on every layout event (orientation change, keyboard, etc.)
            // measure() gives absolute page coords needed by getCellAt's hit-test.
            gridRef.current?.measure((_x, _y, _w, _h, pX, pY) => {
              gridOrigin.current = { x: pX, y: pY };
            });
          }}
          {...panResponder.panHandlers}
          style={styles.gridWrapper}
        >
          {/* Connection lines drawn below cells */}
          {currentPath.length > 1 && currentPath.slice(0, -1).map((from, idx) => (
            <ConnectionLine
              key={`line-${idx}`}
              from={from}
              to={currentPath[idx + 1]}
              color={pathColor}
            />
          ))}

          {/* Letter cells */}
          <View style={styles.grid}>
            {grid.map((row, r) =>
              row.map((letter, c) => {
                const inPath = isInPath(r, c);
                const order  = pathOrder(r, c);
                const isFirst = order === 1;
                const color  = pathColor;

                return (
                  <Animated.View
                    key={`${r}-${c}`}
                    style={[
                      styles.cellWrap,
                      { transform: [{ scale: cellScales[r][c] }] },
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.cell,
                        inPath && {
                          backgroundColor: color + '28',
                          borderColor:     color,
                          borderWidth:     2,
                        },
                        isFirst && {
                          backgroundColor: color + '40',
                        },
                      ]}
                    >
                      <Text style={[
                        styles.letter,
                        inPath && { color },
                      ]}>
                        {letter}
                      </Text>
                      {order !== null && (
                        <View style={[styles.orderBadge, { backgroundColor: color }]}>
                          <Text style={styles.orderText}>{order}</Text>
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </View>
        </View>

        {/* ── Word display + controls ── */}
        <View style={styles.inputRow}>
          <View style={[
            styles.wordDisplay,
            lastResult === 'found'   && styles.wordDisplayFound,
            lastResult === 'invalid' && styles.wordDisplayInvalid,
          ]}>
            <Text style={[
              styles.currentWord,
              lastResult === 'found'   && { color: COLORS.green },
              lastResult === 'invalid' && { color: COLORS.danger },
            ]}>
              {lastResult === 'found'
                ? foundWords[foundWords.length - 1]
                : lastResult === 'invalid'
                  ? 'not a word'
                  : currentWord || '—'}
            </Text>
          </View>

          <Pressable
            style={[styles.submitBtn, currentPath.length < 3 && styles.submitBtnDim]}
            onPress={() => submitPathRef.current(pathRef.current)}
            disabled={currentPath.length < 3}
          >
            <Text style={[styles.submitBtnText, currentPath.length < 3 && { color: COLORS.textMuted }]}>
              Submit
            </Text>
          </Pressable>

          <Pressable style={styles.clearBtn} onPress={clearPath}>
            <Feather name="x" size={20} color={COLORS.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {isSliding ? 'Lift to submit' : currentPath.length >= 3 ? 'Tap Submit or slide to a new word' : 'Slide across letters to trace a word'}
        </Text>

        {/* ── Done overlay ── */}
        {phase === 'done' && (
          <View pointerEvents="none" style={styles.doneOverlay}>
            <Feather name="award" size={56} color={COLORS.green} />
            <Text style={styles.doneTitle}>{foundWords.length} words!</Text>
            <Text style={styles.doneSub}>{attempts} attempt{attempts === 1 ? '' : 's'}</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Ready ──
  readyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },
  readyEmoji: { fontSize: 56, lineHeight: 68 },
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
    lineHeight: 24,
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
    color: '#FFFFFF',
  },

  // ── Playing ──
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.textPrimary,
  },
  foundPill: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  foundText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  foundRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    width: '100%',
    minHeight: 30,
  },
  foundChip: {
    backgroundColor: COLORS.green + '20',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.green + '50',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  foundChipText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.green,
    letterSpacing: 0.5,
  },

  // ── Grid ──
  gridWrapper: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: GRID_SIZE,
    gap: CELL_GAP,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cellWrap: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  orderBadge: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontFamily: FONTS.monoBold,
    fontSize: 9,
    color: '#FFFFFF',
  },

  // ── Input row ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  wordDisplay: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  wordDisplayFound: {
    borderColor: COLORS.green + '60',
    backgroundColor: COLORS.green + '12',
  },
  wordDisplayInvalid: {
    borderColor: COLORS.danger + '60',
    backgroundColor: COLORS.danger + '12',
  },
  currentWord: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: 3,
  },
  submitBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  submitBtnDim: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  submitBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  clearBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  clearBtnText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  hint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Done overlay ──
  doneOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  doneEmoji: { fontSize: 56 },
  doneTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
  },
  doneSub: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
