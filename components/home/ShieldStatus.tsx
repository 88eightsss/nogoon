// ShieldStatus — the centrepiece of the home screen.
// Shows a glowing shield to signal that GATE is actively protecting the user.
// The shield pulses gently using React Native's built-in Animated API,
// which runs on the JS thread (good enough for a slow ambient pulse).

import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/Colors';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { Badge } from '@/components/ui/Badge';

interface ShieldStatusProps {
  // Whether GATE is currently protecting the user
  active?: boolean;
  // The sensitivity level set in Settings
  sensitivity?: 'Gentle' | 'Standard' | 'Strict';
}

export function ShieldStatus({
  active = true,
  sensitivity = 'Standard',
}: ShieldStatusProps) {
  // pulseAnim goes from 1 → 1.08 → 1 continuously, creating a breathing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // glowAnim fades the outer glow ring in and out in sync with the pulse
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!active) return; // No animation when shield is inactive

    // Create a looping pulse that runs forever until the component unmounts
    const pulse = Animated.loop(
      Animated.sequence([
        // Breathe out
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        // Breathe in
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulse.start();

    // Clean up the animation when the component unmounts
    return () => pulse.stop();
  }, [active, pulseAnim, glowAnim]);

  const accentColor = active ? COLORS.green : COLORS.textMuted;

  return (
    <View style={styles.container}>
      {/* Outer glow ring — fades in and out with the pulse */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            borderColor: accentColor,
            opacity: glowAnim,
          },
        ]}
      />

      {/* Shield icon with scale pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={[styles.iconContainer, { borderColor: accentColor + '44' }]}>
          <Ionicons
            name={active ? 'shield-checkmark' : 'shield-outline'}
            size={72}
            color={accentColor}
          />
        </View>
      </Animated.View>

      {/* Status label row */}
      <View style={styles.statusRow}>
        <Badge
          label={active ? 'ACTIVE' : 'INACTIVE'}
          color={accentColor}
          size="md"
        />
      </View>

      {/* Sensitivity label */}
      <Text style={styles.sensitivityLabel}>
        {sensitivity} protection
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  // Outer ring that glows around the shield
  glowRing: {
    position: 'absolute',
    top: SPACING.xl - 20,
    width: 140,
    height: 140,
    borderRadius: RADIUS.full,
    borderWidth: 2,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  sensitivityLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
