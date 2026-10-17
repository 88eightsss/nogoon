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
  idle:  { title: 'Press and hold',        sub: 'Hold the orb and breathe in through your nose' },
  in:    { title: 'Breathe in…',           sub: 'Keep holding, nice and slow' },
  full:  { title: 'Full. Let go slowly.',  sub: 'Lift your finger and breathe out' },
  out:   { title: 'Breathe out…',          sub: 'Longer than the way in. Let it all go' },
  short: { title: 'A little longer',       sub: 'Hold until you feel the buzz' },
  rest:  { title: 'Lovely.',               sub: 'Hold again when you are ready' },
};

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
          <Animated.View style={[styles.halo2, { opacity: glow, transform: [{ scale }] }]} />
          <Animated.View style={[styles.halo1, { opacity: Animated.multiply(glow, 1.6), transform: [{ scale }] }]} />
          <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
            <View style={styles.orbInner} />
          </Animated.View>
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
  halo2: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: BLUE },
  halo1: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: BLUE },
  orb: { width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  orbInner: { width: ORB * 0.55, height: ORB * 0.55, borderRadius: (ORB * 0.55) / 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  labelWrap: { alignItems: 'center', gap: SPACING.sm, minHeight: 70 },
  title: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  switchText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },
});
