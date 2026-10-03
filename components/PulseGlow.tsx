// ─── PulseGlow ──────────────────────────────────────────────────────────────
//
// Wraps an element in a soft, slowly pulsing colored outline. Used on the
// "Blocking off — tap to fix" indicators so a switched-off Accessibility
// Service stands out instead of blending in with the rest of the screen.
//
// When `active` is false it renders the children untouched (no overlay, no
// animation running). Respects the OS "reduce motion" setting — in that case
// the outline is shown steady instead of pulsing.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Animated, StyleSheet, AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS } from '@/constants/Spacing';

type Props = {
  active: boolean;
  color: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function PulseGlow({ active, color, radius = RADIUS.sm, style, children }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, pulse]);

  if (!active) return <>{children}</>;

  const opacity = reduceMotion
    ? 0.7
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] });

  return (
    <View style={style}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderWidth: 2, borderColor: color, borderRadius: radius, opacity },
        ]}
      />
    </View>
  );
}
