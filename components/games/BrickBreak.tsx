// ─── BrickBreak — classic brick breaker ──────────────────────────────────────
//
// Slide finger to move paddle. Ball bounces; break all bricks to win.
// Miss ball 3 times = game over. Clear board = win (100 pts).
// Lives > 0 when done = 50 pts.
//
// Paddle tracking uses pageX (absolute screen coords) instead of locationX.
// locationX is relative to whichever child view the touch is currently over
// (bricks, ball, paddle are all separate sibling Views stacked inside the
// board) — on Android that basis can jump between children mid-drag, which
// is what made the paddle miss/glitch on touch. pageX is always relative to
// the screen, so it stays correct regardless of which sibling is under the
// finger.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Layout constants (actual px computed from measured width) ─────────────────

const BRICK_ROWS  = 5;
const BRICK_COLS  = 7;
const BRICK_H     = 22;
const BRICK_GAP   = 5;
const PADDLE_H    = 12;
const BALL_R      = 8;
const PADDLE_W    = 72;
const MAX_LIVES   = 3;
const TICK_MS     = 32;  // ~30fps — halves React re-render frequency vs 16ms

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrickState { alive: boolean; color: string }
interface Vec2 { x: number; y: number }

const makeBrickColors = (COLORS: ArcadeColors) => [
  COLORS.danger,
  '#f97316',
  COLORS.warning,
  COLORS.green,
  COLORS.cyan,
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { onComplete: (score: number) => void }

// ─── Component ────────────────────────────────────────────────────────────────

export function BrickBreak({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const BRICK_COLORS = useMemo(() => makeBrickColors(COLORS), [COLORS]);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [lives, setLives] = useState(MAX_LIVES);
  const [bricksLeft, setBricksLeft] = useState(BRICK_ROWS * BRICK_COLS);
  const [, setRenderTick] = useState(0); // force re-render

  // Measured board size
  const boardW = useRef(300);
  const boardH = useRef(480);
  const boardRef   = useRef<View>(null);
  const boardPageX = useRef(0);   // board's absolute (screen) left edge

  // Game state (mutable refs — don't cause re-renders in the tight loop)
  const paddleX  = useRef(0);           // left edge of paddle
  const ballPos  = useRef<Vec2>({ x: 0, y: 0 });
  const ballVel  = useRef<Vec2>({ x: 5.6, y: -7.0 }); // scaled for 32ms tick
  const bricks   = useRef<BrickState[][]>([]);
  const livesRef = useRef(MAX_LIVES);
  const doneRef  = useRef(false);
  const bricksLeftRef = useRef(BRICK_ROWS * BRICK_COLS);

  const tickTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const runTickRef   = useRef<() => void>(() => {});
  const clearTick    = () => { if (tickTimer.current) clearInterval(tickTimer.current); };

  // ── Reset game state ────────────────────────────────────────────────────────

  const resetBall = useCallback(() => {
    const bw = boardW.current;
    const bh = boardH.current;
    ballPos.current = { x: bw / 2, y: bh * 0.65 };
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const speed = 7.2; // scaled for 32ms tick
    ballVel.current = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    paddleX.current = (bw - PADDLE_W) / 2;
  }, []);

  const makeBricks = useCallback((): BrickState[][] => {
    return Array.from({ length: BRICK_ROWS }, (_, r) =>
      Array.from({ length: BRICK_COLS }, () => ({
        alive: true,
        color: BRICK_COLORS[r],
      }))
    );
  }, [BRICK_COLORS]);

  // ── Physics tick ────────────────────────────────────────────────────────────

  const runTick = useCallback(() => {
    if (doneRef.current) return;

    const bw = boardW.current;
    const bh = boardH.current;
    let { x, y } = ballPos.current;
    let { x: vx, y: vy } = ballVel.current;

    // Move
    x += vx;
    y += vy;

    // Wall bounces (left/right/top)
    if (x - BALL_R < 0) { x = BALL_R; vx = Math.abs(vx); }
    if (x + BALL_R > bw) { x = bw - BALL_R; vx = -Math.abs(vx); }
    if (y - BALL_R < 0) { y = BALL_R; vy = Math.abs(vy); }

    // Paddle bounce
    const paddleTop = bh - PADDLE_H - 16;
    const paddleLeft = paddleX.current;
    const paddleRight = paddleLeft + PADDLE_W;

    if (
      vy > 0 &&
      y + BALL_R >= paddleTop &&
      y - BALL_R <= paddleTop + PADDLE_H &&
      x >= paddleLeft &&
      x <= paddleRight
    ) {
      // Angle based on where ball hits paddle (center = straight up, edges = sharper)
      const hitPos = (x - paddleLeft) / PADDLE_W; // 0..1
      const angle  = Math.PI * (0.2 + hitPos * 0.6); // 36°..144° from right
      const speed  = Math.sqrt(vx * vx + vy * vy);
      vx = Math.cos(angle) * speed;
      vy = -Math.abs(Math.sin(angle) * speed);
      y  = paddleTop - BALL_R;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Brick layout geometry
    const brickW = (bw - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;
    const topPad = 50;

    outer:
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (!bricks.current[r]?.[c]?.alive) continue;
        const bx = BRICK_GAP + c * (brickW + BRICK_GAP);
        const by = topPad + r * (BRICK_H + BRICK_GAP);

        if (
          x + BALL_R >= bx && x - BALL_R <= bx + brickW &&
          y + BALL_R >= by && y - BALL_R <= by + BRICK_H
        ) {
          bricks.current[r][c].alive = false;
          bricksLeftRef.current -= 1;
          setBricksLeft(bricksLeftRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Bounce direction
          const overlapX = Math.min(x + BALL_R - bx, bx + brickW - (x - BALL_R));
          const overlapY = Math.min(y + BALL_R - by, by + BRICK_H - (y - BALL_R));
          if (overlapX < overlapY) vx = -vx;
          else vy = -vy;

          if (bricksLeftRef.current === 0) {
            doneRef.current = true;
            setPhase('done');
            clearTick();
            setTimeout(() => onComplete(100), 900);
            return;
          }
          break outer;
        }
      }
    }

    // Ball fell below paddle
    if (y - BALL_R > bh) {
      livesRef.current -= 1;
      setLives(livesRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (livesRef.current <= 0) {
        doneRef.current = true;
        setPhase('done');
        clearTick();
        setTimeout(() => onComplete(50), 900);
        return;
      }
      resetBall();
      return;
    }

    ballPos.current = { x, y };
    ballVel.current = { x: vx, y: vy };
    setRenderTick((t) => t + 1);
  }, [onComplete, resetBall]);

  const startGame = useCallback(() => {
    livesRef.current     = MAX_LIVES;
    bricksLeftRef.current = BRICK_ROWS * BRICK_COLS;
    doneRef.current      = false;
    bricks.current       = makeBricks();
    setLives(MAX_LIVES);
    setBricksLeft(BRICK_ROWS * BRICK_COLS);
    setPhase('playing');
    resetBall();
    tickTimer.current = setInterval(() => runTickRef.current(), TICK_MS);
  }, [makeBricks, resetBall, runTick]);

  useEffect(() => () => clearTick(), []);

  // Keep runTickRef pointing at the latest runTick so the interval
  // never holds a stale closure over onComplete / resetBall.
  useEffect(() => { runTickRef.current = runTick; }, [runTick]);

  // ── Paddle control ──────────────────────────────────────────────────────────

  // forceRenderRef is reassigned every render so the frozen PanResponder
  // closure always calls the latest setter (fixes paddle visual lag).
  const forceRenderRef = useRef<() => void>(() => {});
  forceRenderRef.current = () => setRenderTick((t) => t + 1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        const localX = evt.nativeEvent.pageX - boardPageX.current;
        paddleX.current = Math.max(0, Math.min(boardW.current - PADDLE_W, localX - PADDLE_W / 2));
        forceRenderRef.current();
      },
      onPanResponderMove: (evt) => {
        const localX = evt.nativeEvent.pageX - boardPageX.current;
        paddleX.current = Math.max(0, Math.min(boardW.current - PADDLE_W, localX - PADDLE_W / 2));
        forceRenderRef.current();
      },
    })
  ).current;

  const onBoardLayout = (e: LayoutChangeEvent) => {
    boardW.current = e.nativeEvent.layout.width;
    boardH.current = e.nativeEvent.layout.height;
    // Re-measure the board's absolute screen position whenever layout
    // changes (rotation, keyboard, etc.) so pageX math above stays correct.
    boardRef.current?.measure((_x, _y, _width, _height, pageX) => {
      boardPageX.current = pageX;
    });
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const brickW = (boardW.current - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;
  const topPad = 50;

  // ── Ready ──────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🧱</Text>
          <Text style={styles.title}>Brick Break</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#f97316' }}>Slide</Text> to move your paddle.{'\n'}
              Bounce the ball to break bricks.{'\n\n'}
              Miss <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.danger }}>3 times</Text> and it's over.{'\n'}
              Clear the board to <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.green }}>win</Text>.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Launch</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Done ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.livesText}>
            {Array.from({ length: MAX_LIVES }, (_, i) => i < lives ? '●' : '○').join(' ')}
          </Text>
          <Text style={styles.bricksText}>{bricksLeft} left</Text>
        </View>

        {/* Board */}
        <View
          ref={boardRef}
          style={styles.board}
          onLayout={onBoardLayout}
          {...panResponder.panHandlers}
        >
          {/* Bricks */}
          {bricks.current.map((row, r) =>
            row.map((brick, c) => {
              if (!brick.alive) return null;
              return (
                <View
                  key={`${r}-${c}`}
                  style={[
                    styles.brick,
                    {
                      left:            BRICK_GAP + c * (brickW + BRICK_GAP),
                      top:             topPad + r * (BRICK_H + BRICK_GAP),
                      width:           brickW,
                      height:          BRICK_H,
                      backgroundColor: brick.color,
                    },
                  ]}
                />
              );
            })
          )}

          {/* Ball */}
          <View
            style={[
              styles.ball,
              {
                left: ballPos.current.x - BALL_R,
                top:  ballPos.current.y - BALL_R,
              },
            ]}
          />

          {/* Paddle */}
          <View
            style={[
              styles.paddle,
              {
                left:   paddleX.current,
                bottom: 16,
                width:  PADDLE_W,
              },
            ]}
          />

          {/* Done overlay */}
          {phase === 'done' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>
                {bricksLeft === 0 ? '🎉 Cleared!' : `${BRICK_ROWS * BRICK_COLS - bricksLeft} broken`}
              </Text>
            </View>
          )}
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
  emoji: { fontSize: 52 },
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
    backgroundColor: '#f97316',
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
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  livesText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.danger,
    letterSpacing: 4,
  },
  bricksText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  board: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#08081a',   // Arkanoid dark background
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1a1a3a',
    overflow: 'hidden',
  },
  brick: {
    position: 'absolute',
    borderRadius: 3,
  },
  ball: {
    position: 'absolute',
    width:  BALL_R * 2,
    height: BALL_R * 2,
    borderRadius: BALL_R,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  paddle: {
    position: 'absolute',
    height: PADDLE_H,
    borderRadius: PADDLE_H / 2,
    backgroundColor: '#a8a8c0',  // silver/chrome — Arkanoid style
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 26,
    color: COLORS.textPrimary,
  },
});
