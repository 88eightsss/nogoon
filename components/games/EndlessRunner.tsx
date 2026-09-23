// ─── Goon Run — classic endless runner ───────────────────────────────────────
//
// Tap to jump (double-jump allowed). Dodge obstacles — genuinely endless,
// like the real thing: there's no finish line, the pace keeps ramping up
// the longer you survive, and one hit ends the run.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  LayoutChangeEvent,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { GoonSprite } from '@/components/home/GoonMascot';

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS      = 32;    // ~30fps
const CHAR_X       = 60;    // fixed horizontal position
const CHAR_W       = 30;    // Rex sprite bounding box (10 * CELL(8) * 0.375)
const CHAR_H       = 36;    // (12 * CELL(8) * 0.375)
// Ground sits at a fraction of the board's height rather than a fixed pixel
// margin from the bottom — a fixed 48px margin left the whole running lane
// hugging the bottom edge on a tall board, with most of the screen empty
// sky above. This centers it: room to jump above, a visible floor below.
const GROUND_FRACTION = 0.6;
const JUMP_VEL     = -20;   // snappier jump
const GRAVITY      = 1.5;   // snappier gravity
const BASE_SPEED   = 5;
const SPEED_RAMP   = 0.004;
// Capped well under the shortest obstacle width (14px) so a long run can
// never move obstacles fast enough to tunnel past the character's hitbox
// between ticks — genuinely endless without ever becoming uncollidable.
const MAX_SPEED    = 13;

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

// No finish line — score is just how long you survived, on the same 0-100
// scale every other arcade game reports (roughly full marks by ~19s, same
// as the old fixed-length round, but the run itself keeps going past that).
function scoreForTicks(ticks: number): number {
  return Math.min(100, Math.round(ticks / 6));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EndlessRunner({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
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

  const groundY = () => boardH.current * GROUND_FRACTION;

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
    speed.current = Math.min(MAX_SPEED, speed.current + SPEED_RAMP);
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
        setTimeout(() => onComplete(scoreForTicks(final)), 900);
        return;
      }
    }

    // Score — no finish line, you just run until you hit something
    tickCount.current += 1;
    if (tickCount.current % 10 === 0) setDisplayTick(tickCount.current);

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
    charY.current  = groundY() - CHAR_H;
  };

  // ── Ready screen ──────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <GoonSprite char={2} stage={4} size={1.125} />
          <Text style={styles.title}>Goon Run</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#4ade80' }}>Tap</Text> to jump.{' '}
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#86efac' }}>Tap again</Text> to double-jump.{'\n\n'}
              Dodge the obstacles.{'\n'}
              No finish line — run as far as you can. It picks up speed the longer you last.
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

  const gY = groundY();
  const elapsedSec = (tickCount.current * TICK_MS / 1000).toFixed(1);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Score bar — no finish line, just a running clock */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>TIME</Text>
          <Text style={styles.scoreValue}>{elapsedSec}s</Text>
        </View>

        {/* Board */}
        <TouchableWithoutFeedback onPress={jump}>
          <View style={styles.board} onLayout={onBoardLayout}>

            {/* Ground line */}
            <View style={[styles.groundLine, { top: gY }]} />

            {/* Goon character */}
            <View
              style={[
                styles.character,
                { left: CHAR_X, top: charY.current + (spriteFrame === 0 ? 0 : -2) },
              ]}
            >
              <GoonSprite char={2} stage={4} size={0.375} />
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
                  {elapsedSec}s
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

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
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
