// ShieldStatus — the centrepiece of the home screen.
// Shows the real state of GATE's blocking — three possible states:
//
//   'active' — accessibility service is ON + at least one site/app is blocked
//              Green glow, pulsing shield, "PROTECTED" badge
//
//   'empty'  — service is ON but no sites/apps have been added to the blocklist
//              Yellow-orange, static shield, "ADD SITES TO BLOCK" prompt
//
//   'off'    — accessibility service is disabled (user hasn't granted permission)
//              Red, broken shield, "FIX THIS" button
//
// This is wired to real data via useAppBlocker (blockingStatus) so it
// never lies to the user. Previously this was hardcoded active={true}.

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '@/constants/Colors';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { Badge } from '@/components/ui/Badge';

interface ShieldStatusProps {
  // The real blocking state — read from useAppBlocker().blockingStatus
  status?: 'active' | 'empty' | 'off';
  // Called when user taps "Fix This" on the 'off' state
  onFix?: () => void;
}

export function ShieldStatus({
  status = 'off',
  onFix,
}: ShieldStatusProps) {
  // pulseAnim goes from 1 → 1.08 → 1 continuously, creating a breathing effect
  // Only runs when status is 'active' (actually protecting something)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (status !== 'active') {
      // Stop any running animation and reset
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      pulseAnim.setValue(1);
      glowAnim.setValue(0.4);
      return;
    }

    // Create a looping pulse that runs forever until the component unmounts
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowAnim,  { toValue: 0.8,  duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1,   duration: 1800, useNativeDriver: true }),
          Animated.timing(glowAnim,  { toValue: 0.4, duration: 1800, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [status, pulseAnim, glowAnim]);

  // ── Color and icon based on current status ────────────────────────────────
  const config = {
    active: {
      color:       COLORS.green,
      icon:        'shield' as const,     // Feather: solid shield
      badge:       'PROTECTED',
      subtext:     'Blocking is active',
      showFix:     false,
    },
    empty: {
      color:       '#ffb800',             // COLORS.warning — orange-yellow
      icon:        'shield' as const,     // same shield, different color
      badge:       'NO SITES ADDED',
      subtext:     'Add a site to start protecting',
      showFix:     false,
    },
    off: {
      color:       COLORS.danger,
      icon:        'shield-off' as const, // Feather: broken/slashed shield
      badge:       'NOT ACTIVE',
      subtext:     'Accessibility permission needed',
      showFix:     true,
    },
  }[status];

  return (
    <View style={styles.container}>
      {/* Outer glow ring — fades in and out with the pulse (active only) */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            borderColor: config.color,
            opacity: glowAnim,
          },
        ]}
      />

      {/* Shield icon with scale pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={[styles.iconContainer, { borderColor: config.color + '44' }]}>
          <Feather
            name={config.icon}
            size={72}
            color={config.color}
          />
        </View>
      </Animated.View>

      {/* Status badge */}
      <View style={styles.statusRow}>
        <Badge
          label={config.badge}
          color={config.color}
          size="md"
        />
      </View>

      {/* Sub-label */}
      <Text style={[styles.subtext, { color: config.color + 'aa' }]}>
        {config.subtext}
      </Text>

      {/* "Fix This" button — only shown when status is 'off' */}
      {config.showFix && onFix && (
        <Pressable style={[styles.fixButton, { borderColor: config.color + '55' }]} onPress={onFix}>
          <Feather name="settings" size={14} color={config.color} />
          <Text style={[styles.fixButtonText, { color: config.color }]}>
            Enable Protection
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
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
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  subtext: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  fixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  fixButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
});
