// ─── SnakeGame — classic Snake ────────────────────────────────────────────────
//
// Analog joystick pad to steer — drag the knob, it follows your finger.
// Eat pellets to grow. Eat 10 pellets = win (100 pts). Die before = 50 pts.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS     = 16;
const ROWS     = 18;
const CELL     = 19;
const GAP      = 2;
const BOARD_W  = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H  = ROWS * CELL + (ROWS - 1) * GAP;
const TICK_MS  = 150;
const WIN_FOOD = 10;

type Pt  = { r: number; c: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function ptEq(a: Pt, b: Pt) { return a.r === b.r && a.c === b.c; }

function randomFood(snake: Pt[]): Pt {
  let food: Pt;
  do {
    food = { r: Math.floor(Math.random() * ROWS), c: Math.floor(Math.random() * COLS) };
  } while (snake.some((s) => ptEq(s, food)));
  return food;
}

interface Props { onComplete: (score: number) => void }

// ─── Joystick pad ─────────────────────────────────────────────────────────────
// An actual analog-style pad, not buttons laid out in a circle: drag inside
// the base and the knob follows your finger (clamped to the base's radius),
// steering whichever cardinal direction the drag leans toward most.
// Releasing snaps the knob back to center.
//
// Tracks pageX/pageY (absolute screen coords) with a measured center,
// not locationX/Y — the same fix as Brick Break's paddle, since locationX/Y
// is relative to whatever view the touch happens to be over and jumps
// around once the knob itself is under the finger.

const PAD_SIZE   = 168;
const KNOB_SIZE  = 64;
const PAD_RADIUS = (PAD_SIZE - KNOB_SIZE) / 2;   // how far the knob can travel from center
const DEAD_ZONE  = 14;                            // px of slack near center before a direction registers

function JoystickPad({ onSteer }: { onSteer: (d: Dir) => void }) {
  const padRef    = useRef<View>(null);
  const padCenter = useRef({ x: 0, y: 0 });
  const dragDir   = useRef<Dir | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const onPadLayout = () => {
    padRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      padCenter.current = { x: pageX + width / 2, y: pageY + height / 2 };
    });
  };

  const updateFromTouch = (pageX: number, pageY: number) => {
    const dx = pageX - padCenter.current.x;
    const dy = pageY - padCenter.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > DEAD_ZONE) {
      const dir: Dir = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      if (dir !== dragDir.current) {
        dragDir.current = dir;
        onSteer(dir);
      }
    }

    const clamped = Math.min(dist, PAD_RADIUS);
    const angle = Math.atan2(dy, dx);
    setKnob({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });
  };

  const release = () => {
    dragDir.current = null;
    setKnob({ x: 0, y: 0 });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:     (evt) => updateFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
      onPanResponderMove:      (evt) => updateFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
      onPanResponderRelease:   release,
      onPanResponderTerminate: release,
    })
  ).current;

  return (
    <View
      ref={padRef}
      style={dpadStyles.base}
      onLayout={onPadLayout}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          dpadStyles.knob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }] },
        ]}
      />
    </View>
  );
}

const dpadStyles = StyleSheet.create({
  base: {
    width: PAD_SIZE,
    height: PAD_SIZE,
    borderRadius: PAD_SIZE / 2,
    backgroundColor: '#0a140a',
    borderWidth: 1,
    borderColor: '#1a3a1a',
    marginTop: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#1a3a1a',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function SnakeGame({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');

  const initSnake: Pt[] = [
    { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) },
    { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) - 1 },
    { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) - 2 },
  ];

  const [snake, setSnake] = useState<Pt[]>(initSnake);
  const [food, setFood]   = useState<Pt>(randomFood(initSnake));
  const [score, setScore] = useState(0);

  const snakeRef  = useRef<Pt[]>(initSnake);
  const foodRef   = useRef<Pt>(randomFood(initSnake));
  const dirRef    = useRef<Dir>('right');
  const nextDir   = useRef<Dir>('right');
  const scoreRef  = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef   = useRef(false);

  const clearTick = () => { if (tickTimer.current) clearInterval(tickTimer.current); };

  const tick = useCallback(() => {
    if (doneRef.current) return;

    dirRef.current = nextDir.current;
    const head = snakeRef.current[0];
    const delta: Record<Dir, Pt> = {
      up:    { r: -1, c:  0 },
      down:  { r:  1, c:  0 },
      left:  { r:  0, c: -1 },
      right: { r:  0, c:  1 },
    };
    const d = delta[dirRef.current];
    const newHead: Pt = { r: head.r + d.r, c: head.c + d.c };

    if (newHead.r < 0 || newHead.r >= ROWS || newHead.c < 0 || newHead.c >= COLS) {
      die(); return;
    }
    if (snakeRef.current.some((s) => ptEq(s, newHead))) {
      die(); return;
    }

    const ate = ptEq(newHead, foodRef.current);
    const newSnake = ate
      ? [newHead, ...snakeRef.current]
      : [newHead, ...snakeRef.current.slice(0, -1)];

    snakeRef.current = newSnake;
    setSnake([...newSnake]);

    if (ate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scoreRef.current += 1;
      setScore(scoreRef.current);

      if (scoreRef.current >= WIN_FOOD) {
        doneRef.current = true;
        setPhase('done');
        clearTick();
        setTimeout(() => onComplete(100), 900);
        return;
      }

      const newFood = randomFood(newSnake);
      foodRef.current = newFood;
      setFood(newFood);
    }
  }, [onComplete]);

  const die = useCallback(() => {
    doneRef.current = true;
    setPhase('done');
    clearTick();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onComplete(50), 900);
  }, [onComplete]);

  const startGame = useCallback(() => {
    const s = initSnake;
    const f = randomFood(s);
    snakeRef.current = s;
    foodRef.current  = f;
    dirRef.current   = 'right';
    nextDir.current  = 'right';
    scoreRef.current = 0;
    doneRef.current  = false;
    setSnake(s);
    setFood(f);
    setScore(0);
    setPhase('playing');
    tickTimer.current = setInterval(tick, TICK_MS);
  }, [tick]);

  useEffect(() => () => clearTick(), []);

  // Joystick handler — ignore reversals (can't go back into yourself)
  const steer = useCallback((d: Dir) => {
    if (d !== OPPOSITE[dirRef.current]) {
      nextDir.current = d;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Render helpers
  const snakeSet = new Set(snake.map((s) => `${s.r},${s.c}`));
  const headKey  = snake[0] ? `${snake[0].r},${snake[0].c}` : '';
  const foodKey  = `${food.r},${food.c}`;

  // ── Ready ──────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🐍</Text>
          <Text style={styles.title}>Snake</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              Drag the <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.green }}>joystick</Text> to steer.{'\n'}
              Eat <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.warning }}>pellets</Text> to grow.{'\n\n'}
              Don't hit the walls or your own tail.{'\n'}
              Eat <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.green }}>{WIN_FOOD}</Text> to win.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Play</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Done ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Score */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>PELLETS</Text>
          <Text style={styles.scoreValue}>{score} / {WIN_FOOD}</Text>
        </View>

        {/* Board */}
        <View style={styles.board}>
          {Array.from({ length: ROWS }, (_, r) => (
            <View key={r} style={styles.row}>
              {Array.from({ length: COLS }, (_, c) => {
                const key    = `${r},${c}`;
                const isHead  = key === headKey;
                const isSnake = snakeSet.has(key);
                const isFood  = key === foodKey;
                return (
                  <View
                    key={c}
                    style={[
                      styles.cell,
                      isSnake && styles.snakeCell,
                      isHead  && styles.headCell,
                      isFood  && styles.foodCell,
                    ]}
                  />
                );
              })}
            </View>
          ))}

          {phase === 'done' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>
                {score >= WIN_FOOD ? '🎉 ' : ''}{score} pellet{score !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Joystick pad */}
        <JoystickPad onSteer={steer} />

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
    backgroundColor: '#4ade80',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: '#0a1a0a',
  },

  playContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  scoreValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: '#4ade80',
  },

  board: {
    width: BOARD_W,
    height: BOARD_H,
    position: 'relative',
    backgroundColor: '#0d1a0d',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  snakeCell: {
    backgroundColor: '#4ade80',
    borderRadius: 2,
  },
  headCell: {
    backgroundColor: '#86efac',
    borderRadius: 3,
  },
  foodCell: {
    backgroundColor: '#ef4444',
    borderRadius: CELL / 2,
  },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  overlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 26,
    color: COLORS.textPrimary,
  },
});
