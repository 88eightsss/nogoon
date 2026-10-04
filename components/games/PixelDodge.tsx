// ─── PixelDodge — 2-bit retro dodge game ─────────────────────────────────────
//
// Tap LEFT half to move left, RIGHT half to move right.
// Avoid blocks raining from above.
// Survive 30 seconds = win (100 pts). Die before = 50 pts.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Game constants ────────────────────────────────────────────────────────────

const COLS        = 7;
const PLAYER_ROW  = 9;           // 0-indexed row from top (player is near bottom)
const TOTAL_ROWS  = 10;
const CELL        = 36;
const GAP         = 4;
const BOARD_W     = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H     = TOTAL_ROWS * CELL + (TOTAL_ROWS - 1) * GAP;
const WIN_SECONDS = 30;
const TICK_START  = 600;         // ms between block drops initially

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block { col: number; row: number; id: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomCol(): number {
  return Math.floor(Math.random() * COLS);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PixelDodge({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'dead' | 'win'>('ready');
  const [playerCol, setPlayerCol] = useState(Math.floor(COLS / 2));
  const [blocks, setBlocks]       = useState<Block[]>([]);
  const [elapsed, setElapsed]     = useState(0);   // seconds

  const playerColRef = useRef(Math.floor(COLS / 2));
  const nextId       = useRef(0);
  const dropTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const countTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef   = useRef(0);
  const dead         = useRef(false);

  const clearTimers = () => {
    if (dropTimer.current)  clearInterval(dropTimer.current);
    if (fallTimer.current)  clearInterval(fallTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
  };

  const checkCollision = useCallback((blockList: Block[]) => {
    if (dead.current) return;
    const hit = blockList.some((b) => b.row >= PLAYER_ROW && b.col === playerColRef.current);
    if (hit) {
      dead.current = true;
      setPhase('dead');
      clearTimers();
      setTimeout(() => onComplete(50), 900);
    }
  }, [onComplete]);

  const startGame = useCallback(() => {
    dead.current     = false;
    elapsedRef.current = 0;
    playerColRef.current = Math.floor(COLS / 2);
    setPlayerCol(Math.floor(COLS / 2));
    setBlocks([]);
    setElapsed(0);
    setPhase('playing');

    // Drop a new block every tick (speed increases over time)
    dropTimer.current = setInterval(() => {
      if (dead.current) return;
      const col = randomCol();
      const id  = nextId.current++;
      setBlocks((prev) => [...prev, { col, row: 0, id }]);
    }, TICK_START);

    // Move all blocks down every 220ms
    fallTimer.current = setInterval(() => {
      if (dead.current) return;
      setBlocks((prev) => {
        const next = prev
          .map((b) => ({ ...b, row: b.row + 1 }))
          .filter((b) => b.row <= PLAYER_ROW);       // remove blocks that pass player
        checkCollision(next);
        return next;
      });
    }, 220);

    // Count elapsed seconds
    countTimer.current = setInterval(() => {
      if (dead.current) return;
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= WIN_SECONDS) {
        dead.current = true;
        setPhase('win');
        clearTimers();
        setTimeout(() => onComplete(100), 900);
      }
    }, 1000);
  }, [checkCollision, onComplete]);

  useEffect(() => () => clearTimers(), []);

  const movePlayer = useCallback((dir: 'left' | 'right') => {
    if (phase !== 'playing') return;
    setPlayerCol((prev) => {
      const next = dir === 'left' ? Math.max(0, prev - 1) : Math.min(COLS - 1, prev + 1);
      playerColRef.current = next;
      return next;
    });
  }, [phase]);

  // Render grid cells
  const cellAt = (row: number, col: number) => {
    if (row === PLAYER_ROW && col === playerCol) return 'player';
    if (blocks.some((b) => b.row === row && b.col === col)) return 'block';
    return 'empty';
  };

  // ── Ready screen ────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.titleEmoji}>👾</Text>
          <Text style={styles.title}>Pixel Dodge</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              Tap <Text style={{ color: COLORS.green, fontFamily: FONTS.bodyBold }}>LEFT</Text> to move left.{'\n'}
              Tap <Text style={{ color: COLORS.cyan, fontFamily: FONTS.bodyBold }}>RIGHT</Text> to move right.{'\n\n'}
              Survive <Text style={{ color: COLORS.green, fontFamily: FONTS.bodyBold }}>{WIN_SECONDS} seconds</Text> without getting hit.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Dead / Win ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Timer */}
        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>SURVIVE</Text>
          <Text style={styles.timerValue}>{WIN_SECONDS - elapsed}s</Text>
        </View>

        {/* Board */}
        <View style={styles.board}>
          {Array.from({ length: TOTAL_ROWS }, (_, row) => (
            <View key={row} style={styles.boardRow}>
              {Array.from({ length: COLS }, (_, col) => {
                const type = cellAt(row, col);
                return (
                  <View
                    key={col}
                    style={[
                      styles.cell,
                      type === 'player' && styles.playerCell,
                      type === 'block'  && styles.blockCell,
                    ]}
                  />
                );
              })}
            </View>
          ))}

          {/* Dead/Win overlay */}
          {(phase === 'dead' || phase === 'win') && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>
                {phase === 'win' ? '🎉 SURVIVED' : '💥 HIT'}
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: COLORS.green + '22', borderColor: COLORS.green + '55' }]}
            onPressIn={() => movePlayer('left')}
          >
            <Text style={[styles.ctrlText, { color: COLORS.green }]}>◀</Text>
          </Pressable>
          <Pressable
            style={[styles.ctrlBtn, { backgroundColor: COLORS.cyan + '22', borderColor: COLORS.cyan + '55' }]}
            onPressIn={() => movePlayer('right')}
          >
            <Text style={[styles.ctrlText, { color: COLORS.cyan }]}>▶</Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  titleEmoji: { fontSize: 52 },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
  },
  ruleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    width: '100%',
  },
  rule: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 26,
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: '#fff',
  },

  playContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.lg,
    gap: SPACING.lg,
  },

  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.green,
    minWidth: 48,
    textAlign: 'right',
  },

  board: {
    width: BOARD_W,
    height: BOARD_H,
    position: 'relative',
    gap: GAP,
  },
  boardRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  playerCell: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
    borderRadius: 3,
  },
  blockCell: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger + 'aa',
    borderRadius: 2,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  overlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 26,
    color: COLORS.textPrimary,
  },

  controls: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  ctrlBtn: {
    width: 120,
    height: 64,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlText: {
    fontSize: 28,
  },
});
