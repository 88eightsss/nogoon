// ─── WarpGame — Pro Exclusive ────────────────────────────────────────────────
//
// A generative space explorer. Drift through nebulae and collect light fragments.
//
// NO TIMER. NO FAILURE. PURE FLOW STATE.
//
// MECHANICS:
//   8 glowing light fragments are scattered across the screen. Tap each to collect
//   it (+15 pts). The starfield drifts autonomously in three parallax layers.
//   Nebulae pulse slowly behind everything. Collect all 8 → onComplete(120 pts).
//
// PERFORMANCE:
//   - Fixed star pool capped at 50 (never spawns more)
//   - ALL animations use useNativeDriver: true (opacity + transform only)
//   - Autonomous drift via Animated.loop — no setInterval, no JS timers
//   - Animated.loops stop when AppState goes inactive/background
//   - Fragment glow simulated with 3 layered circles — no GPU blur needed

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
  Dimensions,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const STAR_COUNT   = 50;
const FRAG_COUNT   = 8;
const PTS_PER_FRAG = 15;   // 8 × 15 = 120 pts
const SPACE_BG     = '#05040f';
const FRAG_COLOR   = '#7dd3fc'; // sky-300

// ─── World types ─────────────────────────────────────────────────────────────

interface Star     { id: number; x: number; y: number; size: number; layer: 0|1|2; twinkleMs: number }
interface Nebula   { id: number; x: number; y: number; rx: number; ry: number; color: string; opacity: number; pulseMs: number }
interface Fragment { id: number; x: number; y: number }

// ─── World generation (called once per mount via useMemo) ─────────────────────

function makeWorld(): { stars: Star[]; nebulae: Nebula[]; fragments: Fragment[]; introStars: { id: number; x: number; y: number; size: number; opacity: number }[] } {
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

  // Spread fragments in a 4×2 grid with random jitter — ensures even coverage
  const cols = 4;
  const rows = 2;
  const cellW = (W - 80) / cols;
  const cellH = (H - 220) / rows;
  const fragments: Fragment[] = Array.from({ length: FRAG_COUNT }, (_, i) => ({
    id: i,
    x: 40 + (i % cols) * cellW + 30 + Math.random() * Math.max(cellW - 60, 10),
    y: 120 + Math.floor(i / cols) * cellH + 40 + Math.random() * Math.max(cellH - 80, 10),
  }));

  const introStars = Array.from({ length: 30 }, (_, i) => ({
    id:      i,
    x:       Math.random() * W,
    y:       Math.random() * H,
    size:    Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.7 + 0.2,
  }));

  return { stars, nebulae, fragments, introStars };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WarpGame({ onComplete }: Props) {
  const { stars, nebulae, fragments, introStars } = useMemo(() => makeWorld(), []);

  const [phase, setPhase]         = useState<'intro' | 'playing' | 'complete'>('intro');
  const [collected, setCollected] = useState<boolean[]>(Array(FRAG_COUNT).fill(false));

  const collectedCount = collected.filter(Boolean).length;
  const score          = collectedCount * PTS_PER_FRAG;

  // ── Animated values ───────────────────────────────────────────────────────

  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;

  const starOpacity = useRef<Animated.Value[]>(
    stars.map(() => new Animated.Value(0.4 + Math.random() * 0.5))
  ).current;

  const nebulaScale = useRef<Animated.Value[]>(
    nebulae.map(() => new Animated.Value(1))
  ).current;

  const fragScale   = useRef<Animated.Value[]>(fragments.map(() => new Animated.Value(1))).current;
  const fragOpacity = useRef<Animated.Value[]>(fragments.map(() => new Animated.Value(1))).current;

  const allLoops = useRef<Animated.CompositeAnimation[]>([]);

  // ── Stable parallax interpolations per layer ──────────────────────────────
  // Created once via useRef — no re-computation on re-renders

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

  // ── Start all ambient animations ──────────────────────────────────────────

  const startAnimations = () => {
    const loops: Animated.CompositeAnimation[] = [];

    // Gentle autonomous drift — gives the "floating in space" feel without user input
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(driftX, { toValue:  10, duration: 8000, useNativeDriver: true }),
        Animated.timing(driftX, { toValue: -10, duration: 8000, useNativeDriver: true }),
        Animated.timing(driftX, { toValue:   0, duration: 5000, useNativeDriver: true }),
      ])
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(driftY, { toValue:  8, duration: 9000, useNativeDriver: true }),
        Animated.timing(driftY, { toValue: -8, duration: 9000, useNativeDriver: true }),
      ])
    );
    loopX.start();
    loopY.start();
    loops.push(loopX, loopY);

    // Star twinkle
    stars.forEach((star, i) => {
      const lo = 0.15 + Math.random() * 0.25;
      const hi = 0.60 + Math.random() * 0.40;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(starOpacity[i], { toValue: lo, duration: star.twinkleMs * 0.55, useNativeDriver: true }),
          Animated.timing(starOpacity[i], { toValue: hi, duration: star.twinkleMs * 0.45, useNativeDriver: true }),
        ])
      );
      loop.start();
      loops.push(loop);
    });

    // Nebula pulse
    nebulae.forEach((neb, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(nebulaScale[i], { toValue: 1.06, duration: neb.pulseMs / 2, useNativeDriver: true }),
          Animated.timing(nebulaScale[i], { toValue: 1.00, duration: neb.pulseMs / 2, useNativeDriver: true }),
        ])
      );
      loop.start();
      loops.push(loop);
    });

    // Fragment pulse (all start, we stop individually on collect)
    fragments.forEach((_, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(fragScale[i], { toValue: 1.25, duration: 1100, useNativeDriver: true }),
          Animated.timing(fragScale[i], { toValue: 0.85, duration: 1100, useNativeDriver: true }),
        ])
      );
      loop.start();
      loops.push(loop);
    });

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

  // ── Stop all loops on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => { allLoops.current.forEach((l) => l.stop()); };
  }, []);

  // ── Collect a fragment ────────────────────────────────────────────────────

  const collectFragment = (id: number) => {
    if (collected[id]) return;

    // Burst animation: scale up + fade out
    Animated.parallel([
      Animated.timing(fragScale[id],   { toValue: 1.9, duration: 280, useNativeDriver: true }),
      Animated.timing(fragOpacity[id], { toValue: 0,   duration: 320, useNativeDriver: true }),
    ]).start();

    const next = [...collected];
    next[id]   = true;
    setCollected(next);

    if (next.filter(Boolean).length === FRAG_COUNT) {
      setPhase('complete');
      allLoops.current.forEach((l) => l.stop());
      setTimeout(() => onComplete(FRAG_COUNT * PTS_PER_FRAG), 1200);
    }
  };

  // ── Group stars by parallax layer ─────────────────────────────────────────

  const farStars  = useMemo(() => stars.filter((s) => s.layer === 0), []);
  const midStars  = useMemo(() => stars.filter((s) => s.layer === 1), []);
  const nearStars = useMemo(() => stars.filter((s) => s.layer === 2), []);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: INTRO
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.introContent}>

          {/* Static background stars */}
          {introStars.map((s) => (
            <View
              key={s.id}
              style={[
                styles.introStar,
                { left: s.x, top: s.y, width: s.size, height: s.size, opacity: s.opacity },
              ]}
            />
          ))}

          {/* Fragment preview — shows what to look for */}
          <View style={styles.fragWrap} pointerEvents="none">
            <View style={styles.fragOuter} />
            <View style={styles.fragMid}   />
            <View style={styles.fragCore}  />
          </View>

          <Text style={styles.introTitle}>WARP</Text>

          <Text style={styles.introSubtitle}>
            Collect all 8 light fragments{'\n'}as you drift through the cosmos
          </Text>

          <Text style={styles.introHint}>✦  Tap the glowing orbs  ✦</Text>

          <Pressable
            style={styles.beginButton}
            onPress={() => {
              setPhase('playing');
              startAnimations();
            }}
          >
            <Text style={styles.beginButtonText}>Begin Journey</Text>
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
          style={[
            styles.layer,
            { transform: [{ translateX: layerT.far.x }, { translateY: layerT.far.y }] },
          ]}
        >
          {farStars.map((s) => (
            <Animated.View
              key={`f${s.id}`}
              style={[
                styles.star,
                { left: s.x, top: s.y, width: s.size, height: s.size,
                  borderRadius: s.size / 2, opacity: starOpacity[s.id] },
              ]}
            />
          ))}
        </Animated.View>

        {/* ── Mid star layer ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            { transform: [{ translateX: layerT.mid.x }, { translateY: layerT.mid.y }] },
          ]}
        >
          {midStars.map((s) => (
            <Animated.View
              key={`m${s.id}`}
              style={[
                styles.star,
                { left: s.x, top: s.y, width: s.size, height: s.size,
                  borderRadius: s.size / 2, opacity: starOpacity[s.id] },
              ]}
            />
          ))}
        </Animated.View>

        {/* ── Near star layer ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            { transform: [{ translateX: layerT.near.x }, { translateY: layerT.near.y }] },
          ]}
        >
          {nearStars.map((s) => (
            <Animated.View
              key={`n${s.id}`}
              style={[
                styles.star,
                { left: s.x, top: s.y, width: s.size, height: s.size,
                  borderRadius: s.size / 2, opacity: starOpacity[s.id] },
              ]}
            />
          ))}
        </Animated.View>

        {/* ── Light Fragments ── */}
        {fragments.map((frag, i) => {
          if (collected[i]) return null;
          return (
            <Pressable
              key={`frag${frag.id}`}
              style={[styles.fragHitbox, { left: frag.x - 24, top: frag.y - 24 }]}
              onPress={() => collectFragment(frag.id)}
              hitSlop={10}
            >
              <Animated.View
                style={[
                  styles.fragWrap,
                  { transform: [{ scale: fragScale[i] }], opacity: fragOpacity[i] },
                ]}
              >
                <View style={styles.fragOuter} />
                <View style={styles.fragMid}   />
                <View style={styles.fragCore}  />
              </Animated.View>
            </Pressable>
          );
        })}

        {/* ── HUD ── */}
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudPill}>
            <Text style={styles.hudText}>
              {collectedCount === FRAG_COUNT ? '✦ Complete' : `✦ ${collectedCount} / ${FRAG_COUNT}`}
            </Text>
          </View>
          <View style={styles.hudPill}>
            <Text style={styles.hudText}>{score} pts</Text>
          </View>
        </View>

        {/* ── Hint (only before first collect) ── */}
        {collectedCount === 0 && phase === 'playing' && (
          <View style={styles.hintBanner} pointerEvents="none">
            <Text style={styles.hintText}>Tap the glowing orbs to collect them</Text>
          </View>
        )}

        {/* ── Complete overlay ── */}
        {phase === 'complete' && (
          <View style={styles.completeOverlay} pointerEvents="none">
            <Text style={styles.completeSymbol}>✦</Text>
            <Text style={styles.completeTitle}>Journey Complete</Text>
            <Text style={styles.completeScore}>{score} pts</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SPACE_BG,
  },

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

  // ── Playing canvas ────────────────────────────────────────────────────────
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },

  layer: {
    position: 'absolute',
    width:    W,
    height:   H,
  },

  nebula: {
    position: 'absolute',
  },

  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },

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
    width:        36,
    height:       36,
    borderRadius: 18,
    backgroundColor: FRAG_COLOR,
    opacity: 0.12,
  },

  fragMid: {
    position: 'absolute',
    width:        18,
    height:       18,
    borderRadius: 9,
    backgroundColor: FRAG_COLOR,
    opacity: 0.35,
  },

  fragCore: {
    position: 'absolute',
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    opacity: 1,
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
    backgroundColor:  'rgba(5,4,15,0.7)',
    borderRadius:     RADIUS.full,
    borderWidth:      1,
    borderColor:      FRAG_COLOR + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },

  hudText: {
    fontFamily: FONTS.mono,
    fontSize:   13,
    color:      FRAG_COLOR,
    letterSpacing: 0.5,
  },

  // ── Hint ──────────────────────────────────────────────────────────────────
  hintBanner: {
    position: 'absolute',
    bottom:   SPACING.xxxl,
    left:     SPACING.lg,
    right:    SPACING.lg,
    alignItems: 'center',
  },

  hintText: {
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },

  // ── Complete overlay ──────────────────────────────────────────────────────
  completeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,4,15,0.78)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  completeSymbol: {
    fontSize: 48,
    color:    FRAG_COLOR,
  },

  completeTitle: {
    fontFamily: FONTS.display,
    fontSize:   32,
    color:      '#ffffff',
    letterSpacing: 1,
  },

  completeScore: {
    fontFamily: FONTS.mono,
    fontSize:   18,
    color:      FRAG_COLOR,
    letterSpacing: 1,
  },
});
