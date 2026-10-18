// ─── Grid Trap — Goon mascot mine sweeper ─────────────────────────────────────
//
// Same mechanics as Minesweeper: tap to reveal, long-press to flag a Goon.
// First tap always safe. Clear all safe cells to win. Hit a Goon = game over.
//
// Theme: Goon mascots are hiding in your brain grid. Dodge them all.

import { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';
import { Feather } from '@expo/vector-icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROWS      = 10;
const COLS      = 10;
const MINES     = 12;
const CELL_SIZE = 32;

type CellState = {
  isMine:   boolean;
  revealed: boolean;
  flagged:  boolean;
  adjCount: number;
};

type Phase = 'ready' | 'playing' | 'won' | 'lost';

// ─── Game logic helpers ───────────────────────────────────────────────────────

function neighbors(r: number, c: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) result.push([nr, nc]);
    }
  }
  return result;
}

function buildBoard(safeR: number, safeC: number): CellState[][] {
  const safe = new Set<string>();
  safe.add(`${safeR},${safeC}`);
  for (const [nr, nc] of neighbors(safeR, safeC)) safe.add(`${nr},${nc}`);

  const mineCells = new Set<string>();
  while (mineCells.size < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    const key = `${r},${c}`;
    if (!safe.has(key)) mineCells.add(key);
  }

  const grid: CellState[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      isMine:   mineCells.has(`${r},${c}`),
      revealed: false,
      flagged:  false,
      adjCount: 0,
    }))
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) continue;
      grid[r][c].adjCount = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].isMine).length;
    }
  }

  return grid;
}

function deepClone(grid: CellState[][]): CellState[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function floodReveal(grid: CellState[][], startR: number, startC: number): void {
  const queue: [number, number][] = [[startR, startC]];
  const visited = new Set<string>();
  visited.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    grid[r][c].revealed = true;

    if (grid[r][c].adjCount === 0) {
      for (const [nr, nc] of neighbors(r, c)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key) && !grid[nr][nc].isMine && !grid[nr][nc].revealed) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
  }
}

// ─── NoGoon digit colors ──────────────────────────────────────────────────────

const DIGIT_COLORS: Record<number, string> = {
  1: '#4ade80',   // green
  2: '#60a5fa',   // blue
  3: '#f87171',   // red
  4: '#a78bfa',   // purple
  5: '#fb923c',   // orange
  6: '#22d3ee',   // cyan
  7: '#e5e7eb',   // near-white
  8: '#6b7280',   // muted
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Minesweeper({ onComplete }: Props) {
  const schedule = useSafeTimeout();
  // The win/lose checks run inside a state updater, which React may invoke twice —
  // so finishing is guarded to happen exactly once.
  const finishedRef = useRef(false);
  const finish = (pts: number, ms: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    schedule(() => onComplete(pts), ms);
  };
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [phase, setPhase]           = useState<Phase>('ready');
  const [grid, setGrid]             = useState<CellState[][]>([]);
  const [flagCount, setFlagCount]   = useState(0);
  const [trapsLeft, setTrapsLeft]   = useState(MINES);

  const firstTap = useRef(true);

  const startGame = useCallback(() => {
    firstTap.current = true;
    setFlagCount(0);
    setTrapsLeft(MINES);
    setPhase('playing');
    const empty: CellState[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({
        isMine: false, revealed: false, flagged: false, adjCount: 0,
      }))
    );
    setGrid(empty);
  }, []);

  const checkWin = useCallback((g: CellState[][]): boolean => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!g[r][c].isMine && !g[r][c].revealed) return false;
      }
    }
    return true;
  }, []);

  const onTapCell = useCallback((r: number, c: number) => {
    if (phase !== 'playing') return;

    setGrid((prev) => {
      const g = deepClone(prev);
      const cell = g[r][c];

      if (cell.flagged || cell.revealed) return prev;

      if (firstTap.current) {
        firstTap.current = false;
        const real = buildBoard(r, c);
        floodReveal(real, r, c);
        setGrid(real);
        return real;
      }

      if (cell.isMine) {
        for (let rr = 0; rr < ROWS; rr++) {
          for (let cc = 0; cc < COLS; cc++) {
            if (g[rr][cc].isMine) g[rr][cc].revealed = true;
          }
        }
        setPhase('lost');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        finish(50, 1200);
        return g;
      }

      floodReveal(g, r, c);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (checkWin(g)) {
        setPhase('won');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        finish(100, 900);
      }

      return g;
    });
  }, [phase, checkWin, onComplete]);

  const onLongPressCell = useCallback((r: number, c: number) => {
    if (phase !== 'playing') return;

    setGrid((prev) => {
      const g = deepClone(prev);
      const cell = g[r][c];
      if (cell.revealed) return prev;

      if (cell.flagged) {
        cell.flagged = false;
        setFlagCount((n) => n - 1);
        setTrapsLeft((n) => n + 1);
      } else {
        cell.flagged = true;
        setFlagCount((n) => n + 1);
        setTrapsLeft((n) => n - 1);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return g;
    });
  }, [phase]);

  // ── Ready screen ──────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          {/* Mini preview grid */}
          <View style={styles.previewGrid}>
            {Array.from({ length: 4 }, (_, r) => (
              <View key={r} style={styles.previewRow}>
                {Array.from({ length: 4 }, (_, c) => (
                  <View
                    key={c}
                    style={[
                      styles.previewCell,
                      (r === 1 && c === 1) || (r === 2 && c === 3) ? styles.previewTrap :
                      (r === 0 && c === 2) ? styles.previewShield : null,
                    ]}
                  >
                    {(r === 1 && c === 1) && <Feather name="alert-octagon" size={14} color={COLORS.danger} />}
                    {(r === 2 && c === 3) && <Feather name="alert-octagon" size={14} color={COLORS.danger} />}
                    {(r === 0 && c === 2) && <Feather name="shield" size={14} color={COLORS.green} />}
                    {(r === 1 && c === 2) && <Text style={[styles.previewNum, { color: '#4ade80' }]}>1</Text>}
                    {(r === 0 && c === 1) && <Text style={[styles.previewNum, { color: '#4ade80' }]}>1</Text>}
                    {(r === 2 && c === 2) && <Text style={[styles.previewNum, { color: '#f87171' }]}>3</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>

          <Text style={styles.title}>Grid Trap</Text>

          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              <Text style={ruleAccent}>Tap</Text> to reveal a cell.{'\n'}
              Numbers show how many Goons are nearby.{'\n\n'}
              <Text style={ruleAccent}>Long-press</Text> to mark a suspected Goon with your brain shield.{'\n\n'}
              Clear every safe cell to{' '}
              <Text style={ruleAccent}>escape</Text>.{'\n'}
              Step on a Goon and it's over.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Feather name="alert-octagon" size={14} color={COLORS.danger} />
              <Text style={styles.statText}>{MINES} traps</Text>
            </View>
            <View style={styles.statPill}>
              <Feather name="shield" size={14} color={COLORS.green} />
              <Text style={styles.statText}>{ROWS}×{COLS} brain</Text>
            </View>
          </View>

          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Enter the Grid</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Won / Lost ──────────────────────────────────────────────────

  const done = phase === 'won' || phase === 'lost';
  const faceIcon = phase === 'won' ? 'check-circle' : phase === 'lost' ? 'alert-octagon' : 'shield';
  const faceColor = phase === 'won' ? COLORS.green : phase === 'lost' ? COLORS.danger : COLORS.cyan;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.playContainer} scrollEnabled={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.counterPill}>
            <Feather name="alert-octagon" size={14} color={COLORS.danger} />
            <Text style={styles.counterNum}>{String(Math.max(0, trapsLeft)).padStart(2, '0')}</Text>
          </View>

          <Pressable style={styles.faceBtn} onPress={startGame}>
            <Feather name={faceIcon} size={22} color={faceColor} />
          </Pressable>

          <View style={styles.counterPill}>
            <Feather name="shield" size={14} color={COLORS.green} />
            <Text style={styles.counterNum}>{String(flagCount).padStart(2, '0')}</Text>
          </View>
        </View>

        {/* Board */}
        <View style={styles.board}>
          {grid.map((row, r) => (
            <View key={r} style={styles.boardRow}>
              {row.map((cell, c) => {
                const isTriggeredMine = cell.isMine && cell.revealed && phase === 'lost';
                return (
                  <Pressable
                    key={c}
                    style={[
                      styles.cell,
                      cell.revealed ? styles.cellRevealed : styles.cellHidden,
                      isTriggeredMine && styles.cellTrap,
                    ]}
                    onPress={() => onTapCell(r, c)}
                    onLongPress={() => onLongPressCell(r, c)}
                    delayLongPress={280}
                    disabled={done || cell.revealed}
                  >
                    {cell.revealed && cell.isMine && (
                      <Feather name="alert-octagon" size={16} color={COLORS.danger} />
                    )}
                    {cell.revealed && !cell.isMine && cell.adjCount > 0 && (
                      <Text style={[styles.adjNum, { color: DIGIT_COLORS[cell.adjCount] ?? '#e5e7eb' }]}>
                        {cell.adjCount}
                      </Text>
                    )}
                    {!cell.revealed && cell.flagged && (
                      <Feather name="shield" size={16} color={COLORS.green} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Status */}
        {done && (
          <View style={[styles.resultBanner, phase === 'won' ? styles.resultWin : styles.resultLoss]}>
            <Text style={[styles.resultText, { color: phase === 'won' ? '#4ade80' : '#f87171' }]}>
              {phase === 'won' ? 'Brain cleared!' : 'Goon got you. Game over.'}
            </Text>
          </View>
        )}

        {!done && (
          <Text style={styles.hint}>Long-press to mark a suspected Goon</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_HIDDEN_BG = '#1a2a1a';
const CELL_HIDDEN_BORDER = '#2d4a2d';
const CELL_HIDDEN_ACCENT = '#166534';
const CELL_REVEAL_BG = '#0d1a0d';
const BOARD_BG = '#0a130a';

const ruleAccent = { fontFamily: FONTS.bodyBold, color: '#4ade80' } as const;

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // Preview grid on ready screen
  previewGrid: {
    gap: 3,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 3,
  },
  previewCell: {
    width: 36,
    height: 36,
    backgroundColor: CELL_HIDDEN_BG,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTrap: {
    backgroundColor: '#2d0a0a',
    borderColor: '#7f1d1d',
  },
  previewShield: {
    backgroundColor: '#0d2a1a',
    borderColor: CELL_HIDDEN_ACCENT,
  },
  previewEmoji: { fontSize: 14 },
  previewNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: '#4ade80',
    letterSpacing: 1,
  },
  ruleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_ACCENT,
    padding: SPACING.xl,
    width: '100%',
  },
  rule: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_BORDER,
  },
  statEmoji: { fontSize: 14 },
  statText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  startBtn: {
    backgroundColor: '#166534',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#4ade80',
  },

  // Playing layout
  playContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: COLS * (CELL_SIZE + 2) + 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_ACCENT,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterEmoji: { fontSize: 14 },
  counterNum: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: '#4ade80',
    letterSpacing: 2,
    minWidth: 28,
  },
  faceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CELL_HIDDEN_BG,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIcon: { fontSize: 20 },

  board: {
    backgroundColor: BOARD_BG,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_ACCENT,
    gap: 2,
    padding: 4,
  },
  boardRow: {
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHidden: {
    backgroundColor: CELL_HIDDEN_BG,
    borderWidth: 1,
    borderColor: CELL_HIDDEN_BORDER,
  },
  cellRevealed: {
    backgroundColor: CELL_REVEAL_BG,
    borderWidth: 0,
  },
  cellTrap: {
    backgroundColor: '#3b0a0a',
  },

  adjNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
  trapEmoji: { fontSize: 13 },
  shieldEmoji: { fontSize: 13 },

  resultBanner: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  resultWin: {
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  resultLoss: {
    backgroundColor: '#2d0a0a',
    borderColor: '#7f1d1d',
  },
  resultText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
  },

  hint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
});
