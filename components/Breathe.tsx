// ─── Breathe ─────────────────────────────────────────────────────────────────
//
// A gentle "breathing" scale (in and out) used to draw the eye to the one
// button a screen wants you to tap, without flashing or shaking. Slow and small
// on purpose: ~1.5s per breath, a few percent of growth. Respects the OS
// "reduce motion" setting (renders steady) and does nothing when inactive.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

type Props = {
  active?: boolean;
  /** ms to wait before the first breath — lets a group of buttons ripple instead of pulsing in lockstep. */
  delay?: number;
  /** Peak scale at the top of the breath. Keep it small (1.04 - 1.08). */
  to?: number;
  children: ReactNode;
};

export function Breathe({ active = true, to = 1.07, delay = 0, children }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: to, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,  duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(600),   // short rest between breaths so it reads calm, not frantic
      ])
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(timer); loop.stop(); scale.setValue(1); };
  }, [active, reduceMotion, to, delay, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}
