// ─── Flappy NoGoon — Pro Secret Game ──────────────────────────────────────────
//
// A Flappy Bird-style mini game using React Native's Animated API.
// The user taps to flap a bird through pairs of pipes. Collision or falling
// off screen ends the game. Points are awarded per pipe pair cleared.
//
// WHY IT WORKS AS A PATTERN INTERRUPT:
// This requires sustained visual attention and fine-timed motor input — the
// polar opposite of passive scrolling. Even 15 seconds of this fully resets
// the mental state that was driving the urge.
//
// PHYSICS:
//   Each game tick (30ms), gravity is added to the bird's vertical velocity.
//   Tapping applies an upward impulse (negative velocity = moving up in
//   React Native where Y increases downward).
//
// SCORING FORMULA:
//   Math.min(120, 30 + score * 15)
//   So: 0 pipes = 30 pts, 6+ pipes = 120 pts (capped)
//
// IMPORTANT — WHY useRef FOR GAME STATE:
//   React's useState re-renders the component on every change. At 30ms ticks
//   that would be ~33 re-renders per second, which is expensive. Instead, we
//   store mutable game state in useRef (zero re-renders on change) and use a
//   single 'renderTick' counter (useState) to manually trigger a re-render
//   once per tick. This is a common React Native game pattern.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Physics & layout constants ──────────────────────────────────────────────
// Tweak these to change game feel. GRAVITY and JUMP_FORCE are the main levers.

const GRAVITY      = 0.6;   // Velocity added downward each tick (px/tick)
const JUMP_FORCE   = -9;    // Upward velocity applied on each tap (negative = up)
const PIPE_SPEED   = 3;     // How many pixels pipes move left per tick
const BIRD_X       = 80;    // Fixed horizontal position of the bird
const CANVAS_HEIGHT = 500;  // Fixed height of the playable area in pixels
const PIPE_WIDTH   = 60;    // Width of each pipe rectangle
const GAP_SIZE     = 160;   // Vertical gap between top and bottom pipe
const BIRD_SIZE    = 40;    // Width and height of the bird's collision box
const PIPE_SPACING = 280;   // Minimum horizontal distance between pipe pairs

// Screen width — we use this so pipes start fully off the right edge
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ───────────────────────────────────────────────────────────────────

interface PipePair {
  id: number;       // Unique ID so React can key the pipe views
  x: number;        // Current left edge position (moves left each tick)
  gapTop: number;   // Y position where the gap starts (top of the opening)
  passed: boolean;  // Whether the bird has already cleared this pair (for scoring)
}

interface Props {
  onComplete: (score: number) => void;
  duration?: number; // Unused but kept for API consistency with other games
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FlappyGame({ onComplete }: Props) {
  // ── Phase state (triggers re-render on phase change) ───────────────────────
  // 'ready'   — start screen shown, game not running
  // 'playing' — game loop active
  // 'dead'    — bird hit something, brief overlay before onComplete fires
  const [phase, setPhase] = useState<'ready' | 'playing' | 'dead'>('ready');

  // This counter is the ONLY thing we increment every tick to force re-renders.
  // We don't use it directly — it just tells React "the frame changed, repaint."
  const [renderTick, setRenderTick] = useState(0);

  // ── Mutable game state stored in refs (no re-render cost) ─────────────────
  // All values that change every 30ms live here. React never "sees" these
  // change — we use renderTick above to repaint once per tick.

  const birdY    = useRef(CANVAS_HEIGHT / 2 - BIRD_SIZE / 2); // Bird's Y position
  const velocity = useRef(0);                                  // Current vertical speed
  const pipes    = useRef<PipePair[]>([]);                     // All active pipe pairs
  const score    = useRef(0);                                  // Pipes successfully passed
  const nextPipeId  = useRef(0);                               // Incrementing ID for pipes
  const ticksSinceLastPipe = useRef(0);                        // Ticks since last pipe spawn
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bird rotation — driven by velocity for visual feedback (nose up/down)
  // We use Animated.Value here because rotation is purely visual and can
  // run on the native thread for smooth interpolation
  const birdRotation = useRef(new Animated.Value(0)).current;

  // ── Reset game state to initial values ─────────────────────────────────────
  const resetGame = useCallback(() => {
    birdY.current    = CANVAS_HEIGHT / 2 - BIRD_SIZE / 2;
    velocity.current = 0;
    pipes.current    = [];
    score.current    = 0;
    nextPipeId.current = 0;
    ticksSinceLastPipe.current = 0;
    birdRotation.setValue(0);
  }, [birdRotation]);

  // ── Spawn a new pipe pair ──────────────────────────────────────────────────
  // The gap can appear anywhere between 100px from top and 100px from bottom,
  // giving a comfortable but varied challenge.
  const spawnPipe = useCallback(() => {
    const minGapTop = 100;
    const maxGapTop = CANVAS_HEIGHT - GAP_SIZE - 100;
    const gapTop    = minGapTop + Math.random() * (maxGapTop - minGapTop);

    pipes.current.push({
      id: nextPipeId.current++,
      x: SCREEN_WIDTH,  // Start just off the right edge
      gapTop,
      passed: false,
    });
  }, []);

  // ── Collision detection ────────────────────────────────────────────────────
  // We use simple AABB (axis-aligned bounding box) collision.
  // The bird is a box at (BIRD_X, birdY) with size BIRD_SIZE × BIRD_SIZE.
  // A pipe occupies the full width PIPE_WIDTH and either the top or bottom zone.

  const checkCollision = useCallback((): boolean => {
    const birdTop    = birdY.current;
    const birdBottom = birdY.current + BIRD_SIZE;
    const birdLeft   = BIRD_X;
    const birdRight  = BIRD_X + BIRD_SIZE;

    // Hit ceiling or floor
    if (birdTop < 0 || birdBottom > CANVAS_HEIGHT) return true;

    // Check each pipe pair
    for (const pipe of pipes.current) {
      const pipeLeft  = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;

      // Only check pipes that are horizontally near the bird
      const horizontalOverlap = birdRight > pipeLeft && birdLeft < pipeRight;
      if (!horizontalOverlap) continue;

      const topPipeBottom    = pipe.gapTop;           // Bottom of top pipe
      const bottomPipeTop    = pipe.gapTop + GAP_SIZE; // Top of bottom pipe

      // Bird hits top pipe (birdTop < where top pipe ends)
      if (birdTop < topPipeBottom) return true;

      // Bird hits bottom pipe (birdBottom > where bottom pipe starts)
      if (birdBottom > bottomPipeTop) return true;
    }

    return false;
  }, []);

  // ── Main game tick ─────────────────────────────────────────────────────────
  // Called every 30ms. Updates physics, moves pipes, checks collisions, scores.

  const tick = useCallback(() => {
    // ── 1. Apply gravity ────────────────────────────────────────────────────
    velocity.current += GRAVITY;
    birdY.current    += velocity.current;

    // ── 2. Animate bird rotation ─────────────────────────────────────────────
    // Velocity maps to rotation: fast up = nose up (negative degrees),
    // fast down = nose down (positive degrees). Clamped to ±35°.
    const targetRotation = Math.max(-35, Math.min(35, velocity.current * 3));
    Animated.timing(birdRotation, {
      toValue: targetRotation,
      duration: 80,
      useNativeDriver: true,
    }).start();

    // ── 3. Move all pipes left ───────────────────────────────────────────────
    pipes.current = pipes.current
      .map(p => ({ ...p, x: p.x - PIPE_SPEED }))
      // Remove pipes that have scrolled fully off the left edge
      .filter(p => p.x > -PIPE_WIDTH - 20);

    // ── 4. Score — mark pipes the bird has passed ────────────────────────────
    for (const pipe of pipes.current) {
      // The bird's right edge has passed the pipe's right edge = cleared
      if (!pipe.passed && BIRD_X + BIRD_SIZE > pipe.x + PIPE_WIDTH) {
        pipe.passed = true;
        score.current += 1;
      }
    }

    // ── 5. Spawn new pipes ────────────────────────────────────────────────────
    // We use a tick counter rather than a fixed interval so pipe spacing is
    // relative to game speed rather than wall-clock time.
    ticksSinceLastPipe.current += 1;
    const ticksPerPipe = Math.round(PIPE_SPACING / PIPE_SPEED); // ~93 ticks ≈ 2.8s
    if (ticksSinceLastPipe.current >= ticksPerPipe) {
      spawnPipe();
      ticksSinceLastPipe.current = 0;
    }

    // ── 6. Collision check ────────────────────────────────────────────────────
    if (checkCollision()) {
      // Stop the loop immediately
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);

      // Calculate final score using the formula
      const finalScore = Math.min(120, 30 + score.current * 15);

      // Show death overlay briefly, then hand off
      setPhase('dead');
      setTimeout(() => onComplete(finalScore), 1200);
      return; // Don't increment renderTick after setting dead phase
    }

    // ── 7. Trigger a repaint ──────────────────────────────────────────────────
    setRenderTick(t => t + 1);
  }, [birdRotation, checkCollision, onComplete, spawnPipe]);

  // ── Start the game ──────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    resetGame();
    setPhase('playing');

    // Spawn the first pipe immediately so there's something to dodge right away
    setTimeout(spawnPipe, 800);

    // Start the 30ms game loop
    gameLoopRef.current = setInterval(tick, 30);
  }, [resetGame, spawnPipe, tick]);

  // ── Handle tap — apply upward velocity (flap) ──────────────────────────────

  const flap = useCallback(() => {
    if (phase !== 'playing') return;
    velocity.current = JUMP_FORCE;
  }, [phase]);

  // ── Clean up loop on unmount ────────────────────────────────────────────────
  // If the user navigates away mid-game, we must clear the interval to avoid
  // calling setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  // ── Convert rotation value to CSS-style string for the transform ────────────
  const rotateInterpolated = birdRotation.interpolate({
    inputRange: [-35, 35],
    outputRange: ['-35deg', '35deg'],
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: READY — start screen
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'ready') {
    return (
      <View style={styles.outerContainer}>
        <View style={styles.canvas}>
          {/* Decorative bird in the center of the canvas */}
          <View style={styles.readyBirdContainer}>
            <Text style={styles.birdEmoji}>🐦</Text>
          </View>
        </View>

        <View style={styles.readyOverlay}>
          <Text style={styles.gameTitle}>🐦 Flappy NoGoon</Text>
          <Text style={styles.gameSub}>Tap anywhere to flap!</Text>
          <Pressable style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>Start</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: PLAYING + DEAD — the game canvas
  // Both phases share the same rendering of pipes and bird.
  // The 'dead' phase adds a semi-transparent overlay on top.
  // ══════════════════════════════════════════════════════════════════════════

  return (
    // Pressable wraps the entire canvas so tapping anywhere triggers flap
    <Pressable style={styles.outerContainer} onPress={flap}>
      {/* ── Game canvas ──────────────────────────────────────────────────── */}
      <View style={styles.canvas}>

        {/* Score counter — top of the canvas */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>Score: {score.current}</Text>
        </View>

        {/* ── Pipes ──────────────────────────────────────────────────────── */}
        {pipes.current.map(pipe => (
          <View key={pipe.id}>
            {/* Top pipe — fills from canvas top down to gap */}
            <View
              style={[
                styles.pipe,
                {
                  left: pipe.x,
                  top: 0,
                  height: pipe.gapTop,
                  width: PIPE_WIDTH,
                },
              ]}
            />

            {/* Bottom pipe — fills from end of gap to canvas bottom */}
            <View
              style={[
                styles.pipe,
                {
                  left: pipe.x,
                  top: pipe.gapTop + GAP_SIZE,
                  height: CANVAS_HEIGHT - pipe.gapTop - GAP_SIZE,
                  width: PIPE_WIDTH,
                },
              ]}
            />

            {/* Pipe caps — slightly wider nubs at the gap edges for classic look */}
            <View
              style={[
                styles.pipeCap,
                {
                  left: pipe.x - 4,
                  top: pipe.gapTop - 16,
                  width: PIPE_WIDTH + 8,
                },
              ]}
            />
            <View
              style={[
                styles.pipeCap,
                {
                  left: pipe.x - 4,
                  top: pipe.gapTop + GAP_SIZE,
                  width: PIPE_WIDTH + 8,
                },
              ]}
            />
          </View>
        ))}

        {/* ── Bird ──────────────────────────────────────────────────────── */}
        {/* Animated.View handles the rotation transform on the native thread */}
        <Animated.View
          style={[
            styles.bird,
            {
              top: birdY.current,
              left: BIRD_X,
              transform: [{ rotate: rotateInterpolated }],
            },
          ]}
        >
          <Text style={styles.birdEmoji}>🐦</Text>
        </Animated.View>
      </View>

      {/* ── Death overlay ──────────────────────────────────────────────────── */}
      {phase === 'dead' && (
        <View style={styles.deathOverlay}>
          <Text style={styles.deathEmoji}>💥</Text>
          <Text style={styles.deathTitle}>Game Over</Text>
          <Text style={styles.deathScore}>
            {score.current} pipe{score.current !== 1 ? 's' : ''} cleared
          </Text>
          <Text style={styles.deathPoints}>
            +{Math.min(120, 30 + score.current * 15)} pts
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Outer container holds both the canvas and any overlay content
  outerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Game canvas ───────────────────────────────────────────────────────────
  // Fixed height so physics coordinates are predictable.
  // position: 'relative' is the default for RN but explicit for clarity.
  canvas: {
    width: '100%',
    height: CANVAS_HEIGHT,
    backgroundColor: '#0d0d1f', // Slightly lighter than background for sky feel
    borderRadius: RADIUS.lg,
    overflow: 'hidden',         // Clip pipes and bird to canvas bounds
    position: 'relative',
  },

  // Score display in top-left of canvas
  scoreContainer: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    zIndex: 10,
  },
  scoreText: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: COLORS.textPrimary,
  },

  // ── Pipes ─────────────────────────────────────────────────────────────────
  pipe: {
    position: 'absolute',
    backgroundColor: COLORS.green,
    borderRadius: 4,
  },

  // Caps at the gap entrance — the classic Flappy Bird nub detail
  pipeCap: {
    position: 'absolute',
    height: 18,
    backgroundColor: COLORS.green,
    borderRadius: 4,
    // Slightly brighter tint to make caps visually distinct
    opacity: 0.85,
  },

  // ── Bird ──────────────────────────────────────────────────────────────────
  bird: {
    position: 'absolute',
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birdEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },

  // ── Ready screen ─────────────────────────────────────────────────────────
  readyBirdContainer: {
    position: 'absolute',
    top: CANVAS_HEIGHT / 2 - 24,
    left: BIRD_X,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyOverlay: {
    position: 'absolute',    // Overlaid on top of the canvas
    alignItems: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  gameTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  gameSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    minWidth: 160,
  },
  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  // ── Death overlay ─────────────────────────────────────────────────────────
  // Semi-transparent dark overlay that appears in-place over the canvas
  deathOverlay: {
    position: 'absolute',
    width: '100%',
    height: CANVAS_HEIGHT,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  deathEmoji: {
    fontSize: 56,
    lineHeight: 64,
  },
  deathTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
  },
  deathScore: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  deathPoints: {
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    color: COLORS.green,
  },
});
