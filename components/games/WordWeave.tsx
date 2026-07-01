// ─── WordWeave — Standard Game ───────────────────────────────────────────────
//
// Find hidden words in a 4×4 letter grid by tapping connected letters.
// Letters connect in any direction (including diagonals).
// No timer — discovery at your own pace.
//
// WIN: Find 5 words from the grid.
//
// SCORING:
//   5 words found in ≤ 10 attempts: 100 pts
//   5 words found:                    75 pts
//   3–4 words found:                  50 pts

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Grid size ────────────────────────────────────────────────────────────────

const GRID = 4;

// ─── Puzzle data ──────────────────────────────────────────────────────────────
// Each puzzle has a 4×4 grid and a set of valid words with their letter paths.
// Paths are arrays of [row, col] in order.

interface WordEntry {
  word:  string;
  path:  Array<[number, number]>;
}

interface PuzzleData {
  grid:   string[][];      // 4×4 letter grid
  words:  WordEntry[];     // All findable words (more than 5 so user has choices)
}

const PUZZLES: PuzzleData[] = [
  {
    grid: [
      ['C','A','L','M'],
      ['O','R','E','S'],
      ['D','A','T','H'],
      ['E','W','I','N'],
    ],
    words: [
      { word: 'CALM',  path: [[0,0],[0,1],[0,2],[0,3]] },
      { word: 'CORE',  path: [[1,0],[1,1],[1,2],[1,3]] },
      { word: 'CODE',  path: [[1,0],[0,1],[2,1],[2,0]] },
      { word: 'RATE',  path: [[1,1],[0,1],[2,3],[1,2]] },
      { word: 'CALM',  path: [[0,0],[0,1],[0,2],[0,3]] },
      { word: 'ATE',   path: [[0,1],[2,3],[1,2]] },
      { word: 'WIN',   path: [[3,1],[3,2],[3,3]] },
      { word: 'ARE',   path: [[1,1],[1,2],[1,3]] },
      { word: 'REAL',  path: [[1,1],[1,2],[0,1],[0,2]] },
      { word: 'HEST',  path: [[2,3],[1,3],[1,2],[2,3]] },
    ],
  },
  {
    grid: [
      ['F','L','O','W'],
      ['R','E','A','S'],
      ['E','T','H','E'],
      ['S','T','I','L'],
    ],
    words: [
      { word: 'FLOW',  path: [[0,0],[0,1],[0,2],[0,3]] },
      { word: 'REAL',  path: [[1,0],[1,1],[1,2],[0,1]] },
      { word: 'FREE',  path: [[0,0],[1,0],[2,0],[2,1]] },
      { word: 'STILL', path: [[3,0],[3,1],[3,2],[3,3],[2,3]] },
      { word: 'HEAT',  path: [[2,2],[1,2],[1,1],[1,0]] },
      { word: 'REST',  path: [[1,0],[1,1],[3,0],[3,1]] },
      { word: 'SET',   path: [[1,3],[2,3],[3,1]] },
      { word: 'EAR',   path: [[1,1],[1,2],[1,0]] },
      { word: 'THE',   path: [[3,1],[2,2],[1,1]] },
    ],
  },
  {
    grid: [
      ['M','I','N','D'],
      ['E','A','S','E'],
      ['T','H','I','N'],
      ['K','I','N','G'],
    ],
    words: [
      { word: 'MIND',  path: [[0,0],[0,1],[0,2],[0,3]] },
      { word: 'EASE',  path: [[1,0],[1,1],[1,2],[1,3]] },
      { word: 'THIN',  path: [[2,0],[2,1],[2,2],[2,3]] },
      { word: 'KING',  path: [[3,0],[3,1],[3,2],[3,3]] },
      { word: 'MEAN',  path: [[0,0],[1,0],[1,1],[2,3]] },
      { word: 'SHINE', path: [[1,2],[2,1],[3,1],[2,3],[1,3]] },
      { word: 'THINK', path: [[2,0],[2,1],[2,2],[2,3],[3,0]] },
      { word: 'AIM',   path: [[1,1],[0,1],[0,0]] },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adjacent4x4(r1: number, c1: number, r2: number, c2: number): boolean {
  // 8-directional adjacency
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);
}

function pathToWord(path: Array<[number, number]>, grid: string[][]): string {
  return path.map(([r, c]) => grid[r][c]).join('');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WordWeave({ onComplete }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');

  const puzzle   = useRef(PUZZLES[Math.floor(Math.random() * PUZZLES.length)]).current;
  const validSet = useRef(new Set(puzzle.words.map((w) => w.word))).current;

  const [currentPath, setCurrentPath] = useState<Array<[number, number]>>([]);
  const [foundWords,  setFoundWords]  = useState<string[]>([]);
  const [attempts,    setAttempts]    = useState(0);
  const [lastResult,  setLastResult]  = useState<'found' | 'invalid' | null>(null);

  const TARGET_WORDS = 5;

  // Letter tap animations
  const letterScale = useRef<Animated.Value[][]>(
    Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => new Animated.Value(1))
    )
  ).current;

  const pulseLetter = (r: number, c: number) => {
    Animated.sequence([
      Animated.timing(letterScale[r][c], { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.spring(letterScale[r][c],  { toValue: 1,    damping: 12,  useNativeDriver: true }),
    ]).start();
  };

  const handleLetterTap = useCallback((r: number, c: number) => {
    pulseLetter(r, c);

    const lastCell = currentPath[currentPath.length - 1];

    // If tapping last cell again — deselect (backtrack)
    if (lastCell && lastCell[0] === r && lastCell[1] === c) {
      setCurrentPath((p) => p.slice(0, -1));
      return;
    }

    // Must be adjacent to last cell (if path not empty)
    if (lastCell && !adjacent4x4(lastCell[0], lastCell[1], r, c)) return;

    // Can't reuse a cell in the same path
    if (currentPath.some(([pr, pc]) => pr === r && pc === c)) return;

    const newPath = [...currentPath, [r, c] as [number, number]];
    setCurrentPath(newPath);
  }, [currentPath]);

  const submitWord = useCallback(() => {
    if (currentPath.length < 2) return;
    const word = pathToWord(currentPath, puzzle.grid);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setCurrentPath([]);

    if (validSet.has(word) && !foundWords.includes(word)) {
      const newFound = [...foundWords, word];
      setFoundWords(newFound);
      setLastResult('found');

      if (newFound.length >= TARGET_WORDS) {
        setPhase('done');
        const pts = newAttempts <= 10 ? 100 : 75;
        setTimeout(() => onComplete(pts), 800);
        return;
      }
    } else {
      setLastResult('invalid');
    }

    setTimeout(() => setLastResult(null), 1200);
  }, [currentPath, foundWords, attempts]);

  const clearPath = () => setCurrentPath([]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>📝</Text>
          <Text style={styles.readyTitle}>Word Weave</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              Tap letters to build a word — they must connect in any direction, including
              diagonals.{'\n\n'}
              Tap Submit when done. Find {TARGET_WORDS} words to win.
            </Text>
          </View>
          <Pressable style={styles.startButton} onPress={() => setPhase('playing')}>
            <Text style={styles.startButtonText}>Start weaving →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / DONE
  // ─────────────────────────────────────────────────────────────────────────

  const currentWord = pathToWord(currentPath, puzzle.grid);
  const isInPath    = (r: number, c: number) => currentPath.some(([pr, pc]) => pr === r && pc === c);
  const pathOrder   = (r: number, c: number) => {
    const i = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    return i >= 0 ? i + 1 : null;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Word Weave</Text>
          <View style={styles.foundPill}>
            <Text style={styles.foundText}>{foundWords.length} / {TARGET_WORDS} words</Text>
          </View>
        </View>

        {/* ── Found words ── */}
        <View style={styles.foundRow}>
          {foundWords.map((w) => (
            <View key={w} style={styles.foundChip}>
              <Text style={styles.foundChipText}>{w}</Text>
            </View>
          ))}
        </View>

        {/* ── Grid ── */}
        <View style={styles.grid}>
          {puzzle.grid.map((row, r) =>
            row.map((letter, c) => {
              const inPath = isInPath(r, c);
              const order  = pathOrder(r, c);
              return (
                <Animated.View
                  key={`${r}-${c}`}
                  style={[
                    styles.cellWrap,
                    { transform: [{ scale: letterScale[r][c] }] },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.cell,
                      inPath && styles.cellSelected,
                    ]}
                    onPress={() => handleLetterTap(r, c)}
                  >
                    <Text style={[styles.letter, inPath && styles.letterSelected]}>
                      {letter}
                    </Text>
                    {order !== null && (
                      <Text style={styles.orderDot}>{order}</Text>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </View>

        {/* ── Current word + controls ── */}
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
                ? `✓ ${foundWords[foundWords.length - 1]}`
                : lastResult === 'invalid'
                  ? '✗ not a word'
                  : currentWord || '...'}
            </Text>
          </View>
          <Pressable
            style={[styles.submitBtn, currentPath.length < 2 && styles.submitBtnDisabled]}
            onPress={submitWord}
            disabled={currentPath.length < 2}
          >
            <Text style={styles.submitBtnText}>Submit</Text>
          </Pressable>
          <Pressable style={styles.clearBtn} onPress={clearPath}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* ── Done overlay ── */}
        {phase === 'done' && (
          <View style={styles.doneOverlay}>
            <Text style={styles.doneEmoji}>📝</Text>
            <Text style={styles.doneTitle}>{foundWords.length} words found!</Text>
            <Text style={styles.doneSub}>{attempts} attempts</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CELL_SIZE = 72;
const CELL_GAP  = 6;

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

  foundPill: {
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },

  foundText: {
    fontFamily: FONTS.mono,
    fontSize:   12,
    color:      COLORS.textMuted,
  },

  foundRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    width:         '100%',
    minHeight:     32,
  },

  foundChip: {
    backgroundColor:   COLORS.green + '20',
    borderRadius:      RADIUS.sm,
    borderWidth:       1,
    borderColor:       COLORS.green + '50',
    paddingHorizontal: SPACING.sm,
    paddingVertical:   4,
  },

  foundChipText: {
    fontFamily: FONTS.mono,
    fontSize:   13,
    color:      COLORS.green,
    letterSpacing: 0.5,
  },

  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    width:         GRID * CELL_SIZE + (GRID - 1) * CELL_GAP,
    gap:           CELL_GAP,
    marginTop:     SPACING.sm,
  },

  cellWrap: {
    width:  CELL_SIZE,
    height: CELL_SIZE,
  },

  cell: {
    width:           CELL_SIZE,
    height:          CELL_SIZE,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    backgroundColor: COLORS.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },

  cellSelected: {
    backgroundColor: COLORS.purple + '33',
    borderColor:     COLORS.purple,
  },

  letter: {
    fontFamily: FONTS.bodyBold,
    fontSize:   24,
    color:      COLORS.textPrimary,
  },

  letterSelected: {
    color: COLORS.purple,
  },

  orderDot: {
    position:   'absolute',
    top:        4,
    right:      6,
    fontFamily: FONTS.mono,
    fontSize:   9,
    color:      COLORS.purple,
  },

  // ── Input row ─────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    width:         '100%',
    marginTop:     SPACING.sm,
  },

  wordDisplay: {
    flex:            1,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.md,
    alignItems:      'center',
  },

  wordDisplayFound: {
    borderColor: COLORS.green + '60',
    backgroundColor: COLORS.green + '15',
  },

  wordDisplayInvalid: {
    borderColor: COLORS.danger + '60',
    backgroundColor: COLORS.danger + '15',
  },

  currentWord: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      18,
    color:         COLORS.textPrimary,
    letterSpacing: 2,
  },

  submitBtn: {
    backgroundColor:   COLORS.purple,
    borderRadius:      RADIUS.md,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.lg,
  },

  submitBtnDisabled: {
    backgroundColor: COLORS.surface,
  },

  submitBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   15,
    color:      COLORS.background,
  },

  clearBtn: {
    backgroundColor:   COLORS.surface,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.cardBorder,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.md,
  },

  clearBtnText: {
    fontFamily: FONTS.body,
    fontSize:   15,
    color:      COLORS.textMuted,
  },

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
    fontSize:   30,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },

  doneSub: {
    fontFamily: FONTS.mono,
    fontSize:   16,
    color:      COLORS.textMuted,
  },
});
