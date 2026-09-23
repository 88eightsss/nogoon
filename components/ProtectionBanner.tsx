// ─── Protection Banner ──────────────────────────────────────────────────────
//
// A small, persistent banner shown OUTSIDE the Protection screen (Today and
// Protect tabs) when the Accessibility Service is on but NoGoon isn't
// battery-exempted — a state neither tab's existing "Blocking Active/Off"
// pill can see, since that pill only reflects the Accessibility Service
// itself. Battery optimization can silently kill that service later without
// ever flipping the pill, so this closes the one gap those pills leave: the
// user finds out here, instead of discovering days later that blocking quietly
// stopped.
//
// Scope is intentionally narrow — it does NOT duplicate the "service off"
// case, since both Today (ShieldStrip) and Protect (header status pill)
// already show that. This only fires for the case neither of them covers.
//
// Deliberately NOT dismissible: it reflects live state, so it disappears on
// its own the moment battery exemption is granted. A "dismiss" button would
// let a user hide a real problem and forget about it. Tapping it navigates
// to /protection, where the actual fix lives.
//
// Renders nothing when there's nothing to warn about — safe to drop into
// any screen.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export function ProtectionBanner() {
  const { colors } = useTheme();
  const { hasNativeModule, serviceEnabled, checkBatteryOptimized } = useAppBlocker();

  const [batteryExempt, setBatteryExempt] = useState(true); // assume fine until checked, so no flash on mount

  const refresh = useCallback(() => {
    checkBatteryOptimized().then((stillOptimized) => setBatteryExempt(!stillOptimized));
  }, [checkBatteryOptimized]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Re-check whenever a tab screen using this banner comes into focus, so a
  // fix made on the Protection screen clears the banner the moment the user
  // navigates back, rather than waiting for the next AppState change.
  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // Expo Go / iOS: there's no native module, so there's nothing to warn about.
  // Service off: already surfaced by each tab's own "Blocking Off" indicator.
  // Battery exempt: nothing to warn about.
  if (!hasNativeModule || !serviceEnabled || batteryExempt) return null;

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: colors.warningDim, borderColor: colors.warning }]}
      onPress={() => router.push('/protection')}
    >
      <Feather name="battery" size={18} color={colors.warning} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.warning }]}>Protection may get killed</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Battery exemption isn't on. Tap to fix it.
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.warning} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    borderWidth:    1,
    borderRadius:   RADIUS.md,
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom:   SPACING.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize:   13,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize:   12,
    marginTop:  1,
  },
});
