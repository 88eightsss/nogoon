// ─── Goon Run — classic endless runner ───────────────────────────────────────
//
// Tap to jump (double-jump allowed). Dodge obstacles. Survive 20s to win.
// One hit = game over.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  LayoutChangeEvent,
  TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Pixel Goon sprite ────────────────────────────────────────────────────────
// Two stride frames for a running animation.

const G_CELL = 3;

const G_COLORS: Record<number, string> = {
  1: '#166534',  // body — dark green
  2: '#4ade80',  // eyes — bright green
  3: '#86efac',  // accent — light green
};

// Frame A — left leg back, right leg forward
const GRID_A: number[][] = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,2,1,1,2,1,1,0],
  [0,1,1,2,1,1,2,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,3,3,1,1,1,1],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,0,1,0,0,1,1,0,0],
  [0,0,0,1,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0],
];

// Frame B — right leg back, left leg forward
const GRID_B: number[][] = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,2,1,1,2,1,1,0],
  [0,1,1,2,1,1,2,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,3,3,1,1,1,1],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,0,0,1,0,0,0],
  [0,0,1,0,0,0,1,0,0,0],
  [0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
];

function GoonSprite({ frame }: { frame: 0 | 1 }) {
  const grid = frame === 0 ? GRID_A : GRID_B;
  const w = 10 * G_CELL;
  const h = 12 * G_CELL;
  return (
    <Svg width={w} height={h}>
      {grid.map((row, r) =>
        row.map((val, c) => {
          if (!val) return null;
          return (
            <Rect
              key={`${r}-${c}`}
              x={c * G_CELL}
              y={r * G_CELL}
              width={G_CELL - 0.5}
              height={G_CELL - 0.5}
              fill={G_COLORS[val]}
            />
          );
        })
      )}
    </Svg>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS      = 32;    // ~30fps
const CHAR_X       = 60;    // fixed horizontal position
const CHAR_W       = 30;    // 10 × G_CELL
const CHAR_H       = 36;    // 12 × G_CELL
const GROUND_PAD   = 48;
const JUMP_VEL     = -20;   // snappier jump
const GRAVITY      = 1.5;   // snappier gravity
const BASE_SPEED   = 5;
const SPEED_RAMP   = 0.0015;
const WIN_TICKS    = 600;   // ~20 seconds at 30fps

// Obstacle sizes — cactus-style, two heights
const OBS_TYPES = [
  { w: 18, h: 36 },   // short cactus
  { w: 14, h: 56 },   // tall cactus
  { w: 28, h: 28 },   // wide low shrub
];

interface Obstacle {
  id:   number;
  x:    number;
  w:    number;
  h:    number;
}

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EndlessRunner({ onComplete }: Props) {
  const [phase, setPhase]         = useState<'ready' | 'playing' | 'done'>('ready');
  const [displayTick, setDisplayTick] = useState(0);
  const [renderTick, setRenderTick]   = useState(0);
  const [spriteFrame, setSpriteFrame] = useState<0 | 1>(0);

  const boardW = useRef(360);
  const boardH = useRef(280);

  const charY          = useRef(0);
  const charVelY       = useRef(0);
  const jumpsLeft      = useRef(2);   // double-jump counter
  const onGround       = useRef(true);
  const obstacles      = useRef<Obstacle[]>([]);
  const tickCount      = useRef(0);
  const speed          = useRef(BASE_SPEED);
  const nextObsId      = useRef(0);
  const framesUntilNext = useRef(45);
  const doneRef        = useRef(false);
  const strideTimer    = useRef(0);

  const tickTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const runTickRef   = useRef<() => void>(() => {});
  const clearTick    = () => { if (tickTimer.current) clearInterval(tickTimer.current); };

  const groundY = () => boardH.current - GROUND_PAD;

  const resetState = useCallback(() => {
    charY.current         = groundY() - CHAR_H;
    charVelY.current      = 0;
    jumpsLeft.current     = 2;
    onGround.current      = true;
    obstacles.current     = [];
    tickCount.current     = 0;
    speed.current         = BASE_SPEED;
    nextObsId.current     = 0;
    framesUntilNext.current = 45;
    doneRef.current       = false;
    strideTimer.current   = 0;
  }, []);

  const jump = useCallback(() => {
    if (doneRef.current) return;
    if (jumpsLeft.current <= 0) return;
    charVelY.current = JUMP_VEL;
    onGround.current = false;
    jumpsLeft.current -= 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const runTick = useCallback(() => {
    if (doneRef.current) return;

    const gY = groundY();

    // Physics
    charVelY.current += GRAVITY;
    charY.current    += charVelY.current;

    if (charY.current >= gY - CHAR_H) {
      charY.current     = gY - CHAR_H;
      charVelY.current  = 0;
      onGround.current  = true;
      jumpsLeft.current = 2;
    } else {
      onGround.current = false;
    }

    // Stride animation
    if (onGround.current) {
      strideTimer.current += 1;
      if (strideTimer.current >= 8) {
        strideTimer.current = 0;
        setSpriteFrame((f) => (f === 0 ? 1 : 0));
      }
    }

    // Speed ramp
    speed.current += SPEED_RAMP;
    const sp = speed.current;

    // Move + cull obstacles
    obstacles.current = obstacles.current
      .map((o) => ({ ...o, x: o.x - sp }))
      .filter((o) => o.x + o.w > -10);

    // Spawn
    framesUntilNext.current -= 1;
    if (framesUntilNext.current <= 0) {
      const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
      obstacles.current.push({
        id: nextObsId.current++,
        x: boardW.current + 10,
        w: type.w,
        h: type.h,
      });
      framesUntilNext.current = 38 + Math.floor(Math.random() * 40);
    }

    // Collision (with 4px inset)
    const cL = CHAR_X + 4;
    const cR = CHAR_X + CHAR_W - 4;
    const cT = charY.current + 4;
    const cB = charY.current + CHAR_H;

    for (const obs of obstacles.current) {
      const oL = obs.x;
      const oR = obs.x + obs.w;
      const oT = gY - obs.h;
      const oB = gY;

      if (cR > oL + 3 && cL < oR - 3 && cB > oT + 3 && cT < oB) {
        doneRef.current = true;
        setPhase('done');
        clearTick();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const final = tickCount.current;
        setTimeout(() => onComplete(final >= WIN_TICKS ? 100 : Math.round((final / WIN_TICKS) * 60)), 900);
        return;
      }
    }

    // Score
    tickCount.current += 1;
    if (tickCount.current % 10 === 0) setDisplayTick(tickCount.current);

    if (tickCount.current >= WIN_TICKS) {
      doneRef.current = true;
      setPhase('done');
      clearTick();
      setTimeout(() => onComplete(100), 900);
      return;
    }

    setRenderTick((t) => t + 1);
  }, [onComplete]);

  useEffect(() => { runTickRef.current = runTick; }, [runTick]);
  useEffect(() => () => clearTick(), []);

  const startGame = useCallback(() => {
    resetState();
    setDisplayTick(0);
    setSpriteFrame(0);
    setPhase('playing');
    tickTimer.current = setInterval(() => runTickRef.current(), TICK_MS);
  }, [resetState]);

  const onBoardLayout = (e: LayoutChangeEvent) => {
    boardW.current = e.nativeEvent.layout.width;
    boardH.current = e.nativeEvent.layout.height;
    charY.current  = boardH.current - GROUND_PAD - CHAR_H;
  };

  // ── Ready screen ──────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Svg width={10 * G_CELL * 3} height={12 * G_CELL * 3}>
            {GRID_A.map((row, r) =>
              row.map((val, c) => {
                if (!val) return null;
                return (
                  <Rect
                    key={`${r}-${c}`}
                    x={c * G_CELL * 3}
                    y={r * G_CELL * 3}
                    width={G_CELL * 3 - 1}
                    height={G_CELL * 3 - 1}
                    fill={G_COLORS[val]}
                  />
                );
              })
            )}
          </Svg>
          <Text style={styles.title}>Goon Run</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#4ade80' }}>Tap</Text> to jump.{' '}
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#86efac' }}>Tap again</Text> to double-jump.{'\n\n'}
              Dodge the obstacles.{'\n'}
              Survive <Text style={{ fontFamily: FONTS.bodyBold, color: '#4ade80' }}>20s</Text> to win.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Run</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Done ────────────────────────────────────────────────────────

  const gY = boardH.current - GROUND_PAD;
  const pct = Math.min(1, tickCount.current / WIN_TICKS);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Score bar */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>DISTANCE</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={styles.scoreValue}>{Math.round(pct * 100)}%</Text>
        </View>

        {/* Board */}
        <TouchableWithoutFeedback onPress={jump}>
          <View style={styles.board} onLayout={onBoardLayout}>

            {/* Ground line */}
            <View style={[styles.groundLine, { top: gY }]} />

            {/* Goon character */}
            <View style={[styles.character, { left: CHAR_X, top: charY.current }]}>
              <GoonSprite frame={spriteFrame} />
            </View>

            {/* Obstacles */}
            {obstacles.current.map((obs) => (
              <View
                key={obs.id}
                style={[
                  styles.obstacle,
                  {
                    left:   obs.x,
                    top:    gY - obs.h,
                    width:  obs.w,
                    height: obs.h,
                  },
                ]}
              />
            ))}

            {/* Done overlay */}
            {phase === 'done' && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>
                  {tickCount.current >= WIN_TICKS ? '🏁 Made it!' : `${Math.round((tickCount.current / WIN_TICKS) * 100)}%`}
                </Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        <Text style={styles.hint}>
          {jumpsLeft.current > 0 ? 'Tap to jump' : 'Double-jump ready on landing'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: '#4ade80',
    letterSpacing: 1,
  },
  ruleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#166534',
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
    backgroundColor: '#166534',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: '#4ade80',
  },

  playContainer: {
    flex: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#1a3a1a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 2,
  },
  scoreValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: '#4ade80',
    minWidth: 36,
    textAlign: 'right',
  },

  board: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0a110a',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1a3a1a',
    overflow: 'hidden',
  },

  groundLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: '#2d5a2d',
  },

  character: {
    position: 'absolute',
    width: CHAR_W,
    height: CHAR_H,
    backgroundColor: 'transparent',
  },

  obstacle: {
    position: 'absolute',
    backgroundColor: '#4ade80',
    borderRadius: 3,
    opacity: 0.9,
  },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,5,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  overlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 24,
    color: '#4ade80',
  },

  hint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
