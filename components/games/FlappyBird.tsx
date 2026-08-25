// ─── FlappyBird — authentic Flappy Bird clone ────────────────────────────────
//
// Tap to flap. Fly through pipe gaps. One hit = game over.
// Pass 10 pipes to win (100 pts). Die before = 50 pts.

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
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS      = 32;    // ~30fps
const BIRD_X       = 70;    // fixed horizontal position
const BIRD_W       = 32;
const BIRD_H       = 22;
const FLAP_VEL     = -13;
const GRAVITY      = 0.9;
const PIPE_W       = 52;
const PIPE_GAP     = 130;   // vertical gap between top/bottom pipe
const PIPE_SPEED   = 5;
const PIPE_INTERVAL= 78;    // frames between pipe spawns
const WIN_PIPES    = 10;

interface Pipe {
  id: number;
  x: number;
  gapTop: number;    // y of top of the gap (bottom of top pipe)
  scored: boolean;
}

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlappyBird({ onComplete }: Props) {
  const [phase, setPhase]    = useState<'ready' | 'playing' | 'done'>('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  // Board dimensions
  const boardW = useRef(360);
  const boardH = useRef(480);

  // Physics refs
  const birdY      = useRef(200);
  const birdVelY   = useRef(0);
  const pipes      = useRef<Pipe[]>([]);
  const pipeIdRef  = useRef(0);
  const frameRef   = useRef(0);
  const scoreRef   = useRef(0);
  const doneRef    = useRef(false);

  const tickTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const runTickRef   = useRef<() => void>(() => {});
  const clearTick    = () => { if (tickTimer.current) clearInterval(tickTimer.current); };

  // ── Flap ──────────────────────────────────────────────────────────────────

  const flap = useCallback(() => {
    if (doneRef.current) return;
    birdVelY.current = FLAP_VEL;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Physics tick ──────────────────────────────────────────────────────────

  const runTick = useCallback(() => {
    if (doneRef.current) return;

    const bh = boardH.current;
    const bw = boardW.current;
    frameRef.current += 1;

    // ── Bird physics ──
    birdVelY.current += GRAVITY;
    birdY.current    += birdVelY.current;

    // Hit floor or ceiling
    if (birdY.current + BIRD_H >= bh - 50 || birdY.current <= 0) {
      die();
      return;
    }

    // ── Pipe movement + spawning ──
    pipes.current = pipes.current
      .map((p) => ({ ...p, x: p.x - PIPE_SPEED }))
      .filter((p) => p.x + PIPE_W > -10);

    if (frameRef.current % PIPE_INTERVAL === 0) {
      const minGapTop = 60;
      const maxGapTop = bh - 60 - PIPE_GAP;
      const gapTop = minGapTop + Math.floor(Math.random() * (maxGapTop - minGapTop));
      pipes.current.push({
        id: pipeIdRef.current++,
        x: bw + 10,
        gapTop,
        scored: false,
      });
    }

    // ── Collision + scoring ──
    const bLeft   = BIRD_X;
    const bRight  = BIRD_X + BIRD_W - 4; // slight forgiveness
    const bTop    = birdY.current + 2;
    const bBottom = birdY.current + BIRD_H - 2;

    for (const pipe of pipes.current) {
      const pLeft  = pipe.x + 4;
      const pRight = pipe.x + PIPE_W - 4;

      if (bRight > pLeft && bLeft < pRight) {
        // Bird is in the pipe's x-range — check vertical collision
        const inTopPipe    = bTop < pipe.gapTop;
        const inBottomPipe = bBottom > pipe.gapTop + PIPE_GAP;

        if (inTopPipe || inBottomPipe) {
          die();
          return;
        }

        // Score point when bird passes pipe center
        if (!pipe.scored && pipe.x + PIPE_W / 2 < BIRD_X) {
          pipe.scored = true;
          scoreRef.current += 1;
          setDisplayScore(scoreRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          if (scoreRef.current >= WIN_PIPES) {
            doneRef.current = true;
            setPhase('done');
            clearTick();
            setTimeout(() => onComplete(100), 900);
            return;
          }
        }
      }
    }

    setRenderTick((t) => t + 1);
  }, [onComplete]);

  const die = useCallback(() => {
    doneRef.current = true;
    setPhase('done');
    clearTick();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onComplete(50), 900);
  }, [onComplete]);

  useEffect(() => { runTickRef.current = runTick; }, [runTick]);
  useEffect(() => () => clearTick(), []);

  const startGame = useCallback(() => {
    birdY.current    = boardH.current / 2;
    birdVelY.current = 0;
    pipes.current    = [];
    pipeIdRef.current = 0;
    frameRef.current = 0;
    scoreRef.current = 0;
    doneRef.current  = false;
    setDisplayScore(0);
    setPhase('playing');
    tickTimer.current = setInterval(() => runTickRef.current(), TICK_MS);
  }, []);

  const onBoardLayout = (e: LayoutChangeEvent) => {
    boardW.current = e.nativeEvent.layout.width;
    boardH.current = e.nativeEvent.layout.height;
    birdY.current  = boardH.current / 2;
  };

  // ── Wing animation frame ────────────────────────────────────────────────
  const wingDown = renderTick % 6 < 3;

  // ── Ready screen ────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🐦</Text>
          <Text style={styles.title}>Flappy</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              <Text style={{ fontFamily: FONTS.bodyBold, color: '#facc15' }}>Tap</Text> anywhere to flap and rise.{'\n'}
              Let go and you fall.{'\n\n'}
              Fly through the gaps between pipes.{'\n'}
              Pass <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.green }}>{WIN_PIPES}</Text> pipes to win.
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Fly</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Done ────────────────────────────────────────────────────────

  const bh = boardH.current;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Score */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>PIPES</Text>
          <Text style={styles.scoreValue}>{displayScore} / {WIN_PIPES}</Text>
        </View>

        <TouchableWithoutFeedback onPress={flap}>
          <View style={styles.board} onLayout={onBoardLayout}>

            {/* Sky gradient strips */}
            <View style={styles.skyTop} />
            <View style={styles.skyBottom} />

            {/* Ground */}
            <View style={[styles.ground, { top: bh - 50 }]} />
            <View style={[styles.groundStripe, { top: bh - 46 }]} />

            {/* Pipes */}
            {pipes.current.map((pipe) => (
              <View key={pipe.id}>
                {/* Top pipe */}
                <View
                  style={[
                    styles.pipe,
                    {
                      left:   pipe.x,
                      top:    0,
                      width:  PIPE_W,
                      height: pipe.gapTop,
                    },
                  ]}
                >
                  {/* Pipe cap */}
                  <View style={[styles.pipeCap, { bottom: 0, left: -4 }]} />
                </View>

                {/* Bottom pipe */}
                <View
                  style={[
                    styles.pipe,
                    {
                      left:   pipe.x,
                      top:    pipe.gapTop + PIPE_GAP,
                      width:  PIPE_W,
                      height: bh - (pipe.gapTop + PIPE_GAP) - 50,
                    },
                  ]}
                >
                  {/* Pipe cap */}
                  <View style={[styles.pipeCap, { top: 0, left: -4 }]} />
                </View>
              </View>
            ))}

            {/* Bird */}
            <View
              style={[
                styles.bird,
                {
                  left: BIRD_X,
                  top:  birdY.current,
                  transform: [
                    { rotate: `${Math.min(45, Math.max(-25, birdVelY.current * 3))}deg` },
                  ],
                },
              ]}
            >
              {/* Wing */}
              <View
                style={[
                  styles.wing,
                  wingDown ? styles.wingDown : styles.wingUp,
                ]}
              />
              {/* Eye */}
              <View style={styles.birdEye}>
                <View style={styles.birdPupil} />
              </View>
              {/* Beak */}
              <View style={styles.beak} />
            </View>

            {/* Done overlay */}
            {phase === 'done' && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>
                  {displayScore >= WIN_PIPES ? '🎉 You won!' : `${displayScore} pipes`}
                </Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        <Text style={styles.hint}>Tap to flap</Text>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PIPE_COLOR      = '#73BF2E';
const PIPE_DARK       = '#558a22';

const styles = StyleSheet.create({
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
    backgroundColor: '#facc15',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: '#1a1200',
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
    justifyContent: 'center',
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
    color: '#facc15',
  },

  board: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#4ec0ca',  // Flappy sky blue
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  skyTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '40%',
    backgroundColor: '#71d5e0',
  },
  skyBottom: {
    position: 'absolute',
    bottom: 50, left: 0, right: 0,
    height: '20%',
    backgroundColor: '#3cb3be',
  },

  ground: {
    position: 'absolute',
    left: 0, right: 0,
    height: 50,
    backgroundColor: '#ded895',
  },
  groundStripe: {
    position: 'absolute',
    left: 0, right: 0,
    height: 4,
    backgroundColor: '#c8b562',
  },

  pipe: {
    position: 'absolute',
    backgroundColor: PIPE_COLOR,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: PIPE_DARK,
  },
  pipeCap: {
    position: 'absolute',
    width: PIPE_W + 8,
    height: 16,
    backgroundColor: PIPE_COLOR,
    borderWidth: 2,
    borderColor: PIPE_DARK,
    borderRadius: 2,
  },

  bird: {
    position: 'absolute',
    width: BIRD_W,
    height: BIRD_H,
    backgroundColor: '#facc15',
    borderRadius: BIRD_H / 2,
    overflow: 'hidden',
  },
  wing: {
    position: 'absolute',
    left: 4,
    width: 18,
    height: 10,
    backgroundColor: '#f59e0b',
    borderRadius: 5,
  },
  wingUp: { top: 2 },
  wingDown: { top: 9 },
  birdEye: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birdPupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1a1a1a',
  },
  beak: {
    position: 'absolute',
    top: 10,
    right: -4,
    width: 8,
    height: 6,
    backgroundColor: '#f97316',
    borderRadius: 2,
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
    color: '#fff',
  },

  hint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
