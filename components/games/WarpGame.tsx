// ─── WarpGame — Pro Exclusive ────────────────────────────────────────────────
//
// A generative space explorer. Drift through nebulae and collect light fragments.
//
// MODE: 60-second endless timed mode.
//   4 fragments on screen at once. Collect one → new one spawns instantly.
//   When the timer hits 0 → game over, score = fragments collected × 15 pts.
//
// PERFORMANCE:
//   - Fixed star pool capped at 50 (never spawns more)
//   - ALL animations use useNativeDriver: true (opacity + transform only)
//   - Autonomous drift via Animated.loop — no setInterval for animations
//   - Animated.loops stop when AppState goes inactive/background
//
// BUG FIX (previous version): fragments could spawn off-screen because positions
// were calculated using raw Dimensions which includes system UI chrome.
// Now clamped to a conservative safe zone with explicit screen margins.

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const STAR_COUNT    = 50;
const LIVE_FRAGS    = 4;      // fragments on screen at once
const PTS_PER_FRAG  = 15;
const GAME_DURATION = 60;     // seconds
const SPACE_BG      = '#05040f';
const FRAG_COLOR    = '#7dd3fc';

// Safe playfield bounds — fragment center must be at least 80px from each edge
// so the 48px hitbox + 20px hitSlop never conflicts with Android edge gestures.
const FRAG_MIN_X = 80;
const FRAG_MAX_X = W - 80;
const FRAG_MIN_Y = 130;  // below HUD
const FRAG_MAX_Y = H - 160; // above system nav + bottom padding

// ─── Types ────────────────────────────────────────────────────────────────────

interface Star     { id: number; x: number; y: number; size: number; layer: 0|1|2; twinkleMs: number }
interface Nebula   { id: number; x: number; y: number; rx: number; ry: number; color: string; opacity: number; pulseMs: number }
interface Fragment { id: number; x: number; y: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Spawn a new fragment within the safe playfield. */
function spawnFragment(id: number): Fragment {
  return {
    id,
    x: randBetween(FRAG_MIN_X, FRAG_MAX_X),
    y: randBetween(FRAG_MIN_Y, FRAG_MAX_Y),
  };
}

// ─── World generation (called once per mount via useMemo) ─────────────────────

function makeWorld(): { stars: Star[]; nebulae: Nebula[]; introStars: { id: number; x: number; y: number; size: number; opacity: number }[] } {
  const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
    id:        i,
    x:         Math.random() * W,
    y:         Math.random() * H,
    size:      Math.random() * 2 + 0.5,
    layer:     (Math.floor(Math.random() * 3)) as 0|1|2,
    twinkleMs: 1800 + Math.random() * 2200,
  }));

  const nebulae: Nebula[] = [
    { id: 0, x: W * 0.18, y: H * 0.22, rx: 120, ry: 80,  color: '#7c3aed', opacity: 0.13, pulseMs: 5200 },
    { id: 1, x: W * 0.78, y: H * 0.38, rx: 140, ry: 100, color: '#3b82f6', opacity: 0.10, pulseMs: 6100 },
    { id: 2, x: W * 0.42, y: H * 0.62, rx: 100, ry: 72,  color: '#06b6d4', opacity: 0.09, pulseMs: 4700 },
    { id: 3, x: W * 0.88, y: H * 0.78, rx: 90,  ry: 65,  color: '#7c3aed', opacity: 0.11, pulseMs: 5600 },
    { id: 4, x: W * 0.22, y: H * 0.84, rx: 115, ry: 82,  color: '#6d28d9', opacity: 0.08, pulseMs: 4900 },
  ];

  const introStars = Array.from({ length: 30 }, (_, i) => ({
    id:      i,
    x:       Math.random() * W,
    y:       Math.random() * H,
    size:    Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.7 + 0.2,
  }));

  return { stars, nebulae, introStars };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WarpGame({ onComplete }: Props) {
  const { stars, nebulae, introStars } = useMemo(() => makeWorld(), []);

  const [phase, setPhase]         = useState<'intro' | 'playing' | 'complete'>('intro');
  const [fragments, setFragments] = useState<Fragment[]>(() =>
    Array.from({ length: LIVE_FRAGS }, (_, i) => spawnFragment(i))
  );
  const [collected, setCollected] = useState(0);
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION);

  // Running fragment ID counter for stable keys
  const nextFragId = useRef(LIVE_FRAGS);

  const score = collected * PTS_PER_FRAG;

  // ── Countdown timer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setPhase('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // End game when time hits 0
  useEffect(() => {
    if (phase === 'complete') {
      allLoops.current.forEach((l) => l.stop());
      setTimeout(() => onComplete(Math.max(score, 10)), 1200);
    }
  }, [phase]);

  // ── Animated values ───────────────────────────────────────────────────────

  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;

  const starOpacity = useRef<Animated.Value[]>(
    stars.map(() => new Animated.Value(0.4 + Math.random() * 0.5))
  ).current;

  const nebulaScale = useRef<Animated.Value[]>(
    nebulae.map(() => new Animated.Value(1))
  ).current;

  // Fragment animations — indexed by fragment array position, not ID
  const fragScale   = useRef<Animated.Value[]>(Array.from({ length: LIVE_FRAGS }, () => new Animated.Value(1))).current;
  const fragOpacity = useRef<Animated.Value[]>(Array.from({ length: LIVE_FRAGS }, () => new Animated.Value(1))).current;

  const allLoops = useRef<Animated.CompositeAnimation[]>([]);

  // ── Parallax interpolations ───────────────────────────────────────────────

  const layerT = useRef({
    far: {
      x: driftX.interpolate({ inputRange: [-10, 10], outputRange: [-4,   4],  extrapolate: 'clamp' }),
      y: driftY.interpolate({ inputRange: [-8,   8], outputRange: [-3,   3],  extrapolate: 'clamp' }),
    },
    mid: {
      x: driftX.interpolate({ inputRange: [-10, 10], outputRange: [-10, 10],  extrapolate: 'clamp' }),
      y: driftY.interpolate({ inputRange: [-8,   8], outputRange: [-8,   8],  extrapolate: 'clamp' }),
    },
    near: {
      x: driftX.interpolate({ inputRange: [-10, 10], outputRange: [-18, 18],  extrapolate: 'clamp' }),
      y: driftY.interpolate({ inputRange: [-8,   8], outputRange: [-14, 14],  extrapolate: 'clamp' }),
    },
  }).current;

  // ── Start animations ──────────────────────────────────────────────────────

  const startAnimations = () => {
    const loops: Animated.CompositeAnimation[] = [];

    const loopX = Animated.loop(Animated.sequence([
      Animated.timing(driftX, { toValue:  10, duration: 8000, useNativeDriver: true }),
      Animated.timing(driftX, { toValue: -10, duration: 8000, useNativeDriver: true }),
      Animated.timing(driftX, { toValue:   0, duration: 5000, useNativeDriver: true }),
    ]));
    const loopY = Animated.loop(Animated.sequence([
      Animated.timing(driftY, { toValue:  8, duration: 9000, useNativeDriver: true }),
      Animated.timing(driftY, { toValue: -8, duration: 9000, useNativeDriver: true }),
    ]));
    loopX.start();
    loopY.start();
    loops.push(loopX, loopY);

    stars.forEach((star, i) => {
      const lo = 0.15 + Math.random() * 0.25;
      const hi = 0.60 + Math.random() * 0.40;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(starOpacity[i], { toValue: lo, duration: star.twinkleMs * 0.55, useNativeDriver: true }),
        Animated.timing(starOpacity[i], { toValue: hi, duration: star.twinkleMs * 0.45, useNativeDriver: true }),
      ]));
      loop.start();
      loops.push(loop);
    });

    nebulae.forEach((neb, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(nebulaScale[i], { toValue: 1.06, duration: neb.pulseMs / 2, useNativeDriver: true }),
        Animated.timing(nebulaScale[i], { toValue: 1.00, duration: neb.pulseMs / 2, useNativeDriver: true }),
      ]));
      loop.start();
      loops.push(loop);
    });

    // Fragment pulse loops
    for (let i = 0; i < LIVE_FRAGS; i++) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(fragScale[i], { toValue: 1.25, duration: 1100, useNativeDriver: true }),
        Animated.timing(fragScale[i], { toValue: 0.85, duration: 1100, useNativeDriver: true }),
      ]));
      loop.start();
      loops.push(loop);
    }

    allLoops.current = loops;
  };

  // ── AppState: pause loops when backgrounded ───────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        allLoops.current.forEach((l) => l.stop());
      } else if (phase === 'playing') {
        allLoops.current.forEach((l) => l.start());
      }
    });
    return () => sub.remove();
  }, [phase]);

  useEffect(() => {
    return () => { allLoops.current.forEach((l) => l.stop()); };
  }, []);

  // ── Collect a fragment ────────────────────────────────────────────────────

  const collectFragment = (slotIdx: number) => {
    if (phase !== 'playing') return;

    // Burst: scale up + fade out, then reset and respawn
    Animated.parallel([
      Animated.timing(fragScale[slotIdx],   { toValue: 1.9, duration: 220, useNativeDriver: true }),
      Animated.timing(fragOpacity[slotIdx], { toValue: 0,   duration: 260, useNativeDriver: true }),
    ]).start(() => {
      // Reset animation values for the slot
      fragScale[slotIdx].setValue(1);
      fragOpacity[slotIdx].setValue(1);
      // Respawn fragment in this slot
      const newFrag = spawnFragment(nextFragId.current++);
      setFragments((prev) => {
        const next = [...prev];
        next[slotIdx] = newFrag;
        return next;
      });
    });

    setCollected((c) => c + 1);
  };

  // ── Star groups ───────────────────────────────────────────────────────────

  const farStars  = useMemo(() => stars.filter((s) => s.layer === 0), []);
  const midStars  = useMemo(() => stars.filter((s) => s.layer === 1), []);
  const nearStars = useMemo(() => stars.filter((s) => s.layer === 2), []);

  // ─── Timer display helpers ────────────────────────────────────────────────

  const timerColor = timeLeft <= 10 ? '#f87171' : FRAG_COLOR;

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: INTRO
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.introContent}>
          {introStars.map((s) => (
            <View
              key={s.id}
              style={[
                styles.introStar,
                { left: s.x, top: s.y, width: s.size, height: s.size, opacity: s.opacity },
              ]}
            />
          ))}

          <View style={styles.fragWrap} pointerEvents="none">
            <View style={styles.fragOuter} />
            <View style={styles.fragMid}   />
            <View style={styles.fragCore}  />
          </View>

          <Text style={styles.introTitle}>WARP</Text>

          <Text style={styles.introSubtitle}>
            60 seconds. Collect as many{'\n'}light fragments as you can.
          </Text>

          <Text style={styles.introHint}>✦  Tap the glowing orbs  ✦</Text>

          <Pressable
            style={styles.beginButton}
            onPress={() => {
              setPhase('playing');
              startAnimations();
            }}
          >
            <Text style={styles.beginButtonText}>Begin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / COMPLETE
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.canvas}>

        {/* ── Nebulae ── */}
        {nebulae.map((neb, i) => (
          <Animated.View
            key={`neb${neb.id}`}
            pointerEvents="none"
            style={[
              styles.nebula,
              {
                left:            neb.x - neb.rx,
                top:             neb.y - neb.ry,
                width:           neb.rx * 2,
                height:          neb.ry * 2,
                borderRadius:    neb.rx,
                backgroundColor: neb.color,
                opacity:         neb.opacity,
                transform:       [{ scale: nebulaScale[i] }],
              },
            ]}
          />
        ))}

        {/* ── Far star layer ── */}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { transform: [{ translateX: layerT.far.x }, { translateY: layerT.far.y }] }]}
        >
          {farStars.map((s) => (
            <Animated.View key={`f${s.id}`} style={[styles.star, { left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: s.size / 2, opacity: starOpacity[s.id] }]} />
          ))}
        </Animated.View>

        {/* ── Mid star layer ── */}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { transform: [{ translateX: layerT.mid.x }, { translateY: layerT.mid.y }] }]}
        >
          {midStars.map((s) => (
            <Animated.View key={`m${s.id}`} style={[styles.star, { left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: s.size / 2, opacity: starOpacity[s.id] }]} />
          ))}
        </Animated.View>

        {/* ── Near star layer ── */}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { transform: [{ translateX: layerT.near.x }, { translateY: layerT.near.y }] }]}
        >
          {nearStars.map((s) => (
            <Animated.View key={`n${s.id}`} style={[styles.star, { left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: s.size / 2, opacity: starOpacity[s.id] }]} />
          ))}
        </Animated.View>

        {/* ── Fragments ── */}
        {phase === 'playing' && fragments.map((frag, slotIdx) => (
          <Pressable
            key={frag.id}
            style={[styles.fragHitbox, { left: frag.x - 24, top: frag.y - 24 }]}
            onPress={() => collectFragment(slotIdx)}
            hitSlop={20}
          >
            <Animated.View
              style={[
                styles.fragWrap,
                { transform: [{ scale: fragScale[slotIdx] }], opacity: fragOpacity[slotIdx] },
              ]}
            >
              <View style={styles.fragOuter} />
              <View style={styles.fragMid}   />
              <View style={styles.fragCore}  />
            </Animated.View>
          </Pressable>
        ))}

        {/* ── HUD ── */}
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudPill}>
            <Text style={[styles.hudText, { color: timerColor }]}>
              {timeLeft}s
            </Text>
          </View>
          <View style={styles.hudPill}>
            <Text style={styles.hudText}>
              ✦ {collected} × {PTS_PER_FRAG} = {score} pts
            </Text>
          </View>
        </View>

        {/* ── Complete overlay ── */}
        {phase === 'complete' && (
          <View style={styles.completeOverlay} pointerEvents="none">
            <Text style={styles.completeSymbol}>✦</Text>
            <Text style={styles.completeTitle}>Time's Up</Text>
            <Text style={styles.completeCollected}>{collected} fragments</Text>
            <Text style={styles.completeScore}>{score} pts</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SPACE_BG },

  // ── Intro ─────────────────────────────────────────────────────────────────
  introContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },

  introStar: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },

  introTitle: {
    fontFamily: FONTS.display,
    fontSize: 64,
    color: '#ffffff',
    letterSpacing: 14,
    textAlign: 'center',
  },

  introSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 24,
  },

  introHint: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: FRAG_COLOR,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  beginButton: {
    borderWidth: 1,
    borderColor: FRAG_COLOR + '80',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  beginButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: FRAG_COLOR,
    letterSpacing: 0.5,
  },

  // ── Canvas ────────────────────────────────────────────────────────────────
  canvas: { flex: 1, overflow: 'hidden' },

  layer: { position: 'absolute', width: W, height: H },

  nebula: { position: 'absolute' },

  star: { position: 'absolute', backgroundColor: '#ffffff' },

  // ── Fragment ──────────────────────────────────────────────────────────────
  fragHitbox: {
    position: 'absolute',
    width:    48,
    height:   48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fragWrap: {
    width:    48,
    height:   48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fragOuter: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: FRAG_COLOR, opacity: 0.12,
  },

  fragMid: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: FRAG_COLOR, opacity: 0.35,
  },

  fragCore: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ffffff', opacity: 1,
  },

  // ── HUD ───────────────────────────────────────────────────────────────────
  hud: {
    position: 'absolute',
    top:   SPACING.md,
    left:  SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  hudPill: {
    backgroundColor:   'rgba(5,4,15,0.7)',
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       FRAG_COLOR + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },

  hudText: {
    fontFamily:    FONTS.mono,
    fontSize:      13,
    color:         FRAG_COLOR,
    letterSpacing: 0.5,
  },

  // ── Complete overlay ──────────────────────────────────────────────────────
  completeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,4,15,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  completeSymbol: { fontSize: 48, color: FRAG_COLOR },

  completeTitle: {
    fontFamily: FONTS.display,
    fontSize:   32,
    color:      '#ffffff',
    letterSpacing: 1,
  },

  completeCollected: {
    fontFamily: FONTS.mono,
    fontSize:   15,
    color:      'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },

  completeScore: {
    fontFamily:    FONTS.mono,
    fontSize:      22,
    color:         FRAG_COLOR,
    letterSpacing: 1,
  },
});
