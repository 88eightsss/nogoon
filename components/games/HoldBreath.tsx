// ─── HoldBreath — hold the orb to breathe in, let go to breathe out ───────────
//
// The interactive version of BreathRhythm. Instead of watching a timer, you do it:
//   • press and HOLD the orb  → it swells while you breathe in (about 5 seconds to full)
//   • let GO                  → it sinks slowly while you breathe out (about 6 seconds)
// A breath counts when you held at least 3.5 s and let the exhale finish. Let go too
// early and it gently asks for a longer one. A soft buzz marks "full". Five breaths done.
//
// The exhale is deliberately longer than the inhale: that is the part that calms you down.
// Anyone who can't hold a press (or uses a screen reader) can switch to follow-along mode.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING } from '@/constants/Spacing';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';

const BLUE = '#4d8bff';
const TARGET_BREATHS = 5;
const IN_MS = 5000;        // time to swell fully
const FULL_AT_MS = 4000;   // buzz + "full" message
const MIN_IN_MS = 3500;    // shortest hold that counts
const OUT_MS = 6000;       // exhale
const BIG = 1.5;
const SMALL = 0.8;

type Stage = 'idle' | 'in' | 'full' | 'out' | 'short' | 'rest';

const COPY: Record<Stage, { title: string; sub: string }> = {
  idle:  { title: 'Press and hold',        sub: 'Hold the orb and breathe in until it fills the outer ring' },
  in:    { title: 'Breathe in…',           sub: 'Keep holding until the ring is full' },
  full:  { title: 'Full. Let go slowly.',  sub: 'Lift your finger and breathe out' },
  out:   { title: 'Breathe out…',          sub: 'Slowly, until the orb shrinks to the inner ring' },
  short: { title: 'A little longer',       sub: 'Hold until the ring is full and you feel the buzz' },
  rest:  { title: 'Lovely.',               sub: 'Hold again when you are ready' },
};

// Guide rings: the orb's edge should land exactly on these.
const RING_FULL = 140 * BIG;    // outer ring: lungs full
const RING_EMPTY = 140 * SMALL; // inner ring: lungs empty
const ARC = RING_FULL + 28;     // progress arc sits just outside the outer ring
const ARC_STROKE = 6;

export function HoldBreath({ onComplete, onSwitch }: { onComplete: (score: number) => void; onSwitch: () => void }) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const schedule = useSafeTimeout();

  const [stage, setStage] = useState<Stage>('idle');
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.1)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const holdStart = useRef(0);
  const holding = useRef(false);
  const fullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(0);
  const outStart = useRef(0);
  // Live countdown for the ring and the number in the orb.
  const [prog, setProg] = useState({ pct: 0, sec: 0 });

  const clearFull = () => { if (fullTimer.current) { clearTimeout(fullTimer.current); fullTimer.current = null; } };

  const run = (toScale: number, toGlow: number, ms: number, easing: (v: number) => number, cb?: (ok: boolean) => void) => {
    anim.current?.stop();
    anim.current = Animated.parallel([
      Animated.timing(scale, { toValue: toScale, duration: ms, easing, useNativeDriver: true }),
      Animated.timing(glow, { toValue: toGlow, duration: ms, easing, useNativeDriver: true }),
    ]);
    anim.current.start(({ finished: ok }) => cb?.(ok));
  };

  const onPressIn = () => {
    if (finished) return;
    holding.current = true;
    holdStart.current = Date.now();
    setProg({ pct: 0, sec: Math.ceil(FULL_AT_MS / 1000) });
    setStage('in');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Grow from wherever the orb currently is.
    run(BIG, 0.28, IN_MS, Easing.inOut(Easing.quad));
    clearFull();
    fullTimer.current = setTimeout(() => {
      if (!holding.current) return;
      setStage('full');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, FULL_AT_MS);
  };

  const onPressOut = () => {
    if (!holding.current || finished) return;
    holding.current = false;
    clearFull();
    const held = Date.now() - holdStart.current;
    if (held < MIN_IN_MS) {
      setStage('short');
      run(1, 0.1, 1200, Easing.out(Easing.quad));
      return;
    }
    setStage('out');
    outStart.current = Date.now();
    setProg({ pct: 1, sec: Math.ceil(OUT_MS / 1000) });
    run(SMALL, 0.06, OUT_MS, Easing.inOut(Easing.quad), (ok) => {
      if (!ok) return; // interrupted by another hold: that breath does not count
      doneRef.current += 1;
      setDone(doneRef.current);
      if (doneRef.current >= TARGET_BREATHS) {
        setFinished(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        schedule(() => onComplete(80), 1400);
      } else {
        setStage('rest');
        run(1, 0.1, 1500, Easing.inOut(Easing.quad));
      }
    });
  };

  // Tick the countdown while breathing in (toward full) and out (toward empty).
  useEffect(() => {
    if (stage !== 'in' && stage !== 'out') return;
    const id = setInterval(() => {
      if (stage === 'in') {
        const e = Date.now() - holdStart.current;
        setProg({ pct: Math.min(1, e / FULL_AT_MS), sec: Math.max(0, Math.ceil((FULL_AT_MS - e) / 1000)) });
      } else {
        const e = Date.now() - outStart.current;
        setProg({ pct: 1 - Math.min(1, e / OUT_MS), sec: Math.max(0, Math.ceil((OUT_MS - e) / 1000)) });
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage]);

  // Stop everything if the app is backgrounded; cleanup on unmount.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') { holding.current = false; clearFull(); anim.current?.stop(); scale.setValue(1); glow.setValue(0.1); setStage((st) => (st === 'idle' ? st : 'idle')); }
    });
    return () => { sub.remove(); clearFull(); anim.current?.stop(); };
  }, []);

  const copy = finished ? { title: 'Well done', sub: 'Nervous system reset' } : COPY[stage];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.dots}>
          {Array.from({ length: TARGET_BREATHS }).map((_, i) => (
            <View key={i} style={[styles.dot, i < done && styles.dotDone]} />
          ))}
        </View>

        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={finished}
          accessibilityRole="button"
          accessibilityLabel="Breathing orb"
          accessibilityHint="Press and hold to breathe in, release to breathe out"
          style={styles.orbArea}
        >
          {/* Progress arc: fills as you breathe in, drains as you breathe out */}
          <Svg width={ARC} height={ARC} style={styles.arc} pointerEvents="none">
            <Circle cx={ARC / 2} cy={ARC / 2} r={(ARC - ARC_STROKE) / 2} stroke={COLORS.border} strokeWidth={ARC_STROKE} fill="none" />
            <Circle
              cx={ARC / 2} cy={ARC / 2} r={(ARC - ARC_STROKE) / 2}
              stroke={stage === 'out' ? COLORS.green : BLUE} strokeWidth={ARC_STROKE} fill="none" strokeLinecap="round"
              strokeDasharray={`${Math.PI * (ARC - ARC_STROKE)} ${Math.PI * (ARC - ARC_STROKE)}`}
              strokeDashoffset={Math.PI * (ARC - ARC_STROKE) * (1 - ((stage === 'in' || stage === 'out') ? prog.pct : stage === 'full' ? 1 : 0))}
              transform={`rotate(-90 ${ARC / 2} ${ARC / 2})`}
            />
          </Svg>
          <Animated.View style={[styles.halo1, { opacity: glow, transform: [{ scale }] }]} />
          <Animated.View style={[styles.orb, { transform: [{ scale }] }]} />
          {/* Guide rings drawn over the orb so its edge has a clear start and finish line */}
          <View pointerEvents="none" style={[styles.guide, { width: RING_FULL, height: RING_FULL, borderRadius: RING_FULL / 2, borderColor: stage === 'full' ? COLORS.green : COLORS.textMuted }]} />
          <View pointerEvents="none" style={[styles.guide, { width: RING_EMPTY, height: RING_EMPTY, borderRadius: RING_EMPTY / 2, borderColor: '#FFFFFFCC' }]} />
          <Text pointerEvents="none" style={[styles.guideLabel, { top: (320 - RING_FULL) / 2 - 22, color: COLORS.textMuted }]}>FULL</Text>
          <Text pointerEvents="none" style={[styles.guideLabel, { top: (320 + RING_EMPTY) / 2 + 4, color: '#FFFFFFCC' }]}>EMPTY</Text>
          <Text pointerEvents="none" style={styles.count}>
            {stage === 'in' ? (prog.sec > 0 ? String(prog.sec) : 'Full') : stage === 'full' ? 'Full' : stage === 'out' ? (prog.sec > 0 ? String(prog.sec) : '') : ''}
          </Text>
        </Pressable>

        <View style={styles.labelWrap}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>
        </View>

        <Pressable onPress={onSwitch} hitSlop={10} accessibilityRole="button" accessibilityLabel="Switch to follow along mode">
          <Text style={styles.switchText}>Can't hold? Follow along instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const ORB = 140;
const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.xl, paddingHorizontal: SPACING.lg },
  dots: { flexDirection: 'row', gap: SPACING.md },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  dotDone: { backgroundColor: BLUE, borderColor: BLUE },
  orbArea: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center' },
  arc: { position: 'absolute' },
  halo1: { position: 'absolute', width: ORB + 14, height: ORB + 14, borderRadius: (ORB + 14) / 2, backgroundColor: BLUE },
  orb: { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: BLUE, borderWidth: 3, borderColor: '#FFFFFF' },
  guide: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed' },
  guideLabel: { position: 'absolute', fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  count: { position: 'absolute', fontFamily: FONTS.display, fontSize: 40, color: '#FFFFFF' },
  labelWrap: { alignItems: 'center', gap: SPACING.sm, minHeight: 70 },
  title: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  switchText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },
});
