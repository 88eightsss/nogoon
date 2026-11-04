// ─── "Blocking is off / stalled" banner ──────────────────────────────────────
// Shows on every tab, at the top, only when something was set up to be blocked and Android is
// not running the blocker: the Accessibility switch is off, or it is on but the service was killed
// (a battery manager, or a swipe away from Recents). Tap to open Accessibility settings.
// A brand-new person with nothing blocked yet does not see this; the next-step card handles them.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useUserStore } from '@/stores/useUserStore';
import { FONTS } from '@/constants/Colors';

export function BlockingBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { blockingStatus, openSettings } = useAppBlocker();
  const hasBlocks = useUserStore((s) => s.blockedApps.length + s.blocklist.length > 0);

  const stalled = blockingStatus === 'stalled';
  if (!(stalled || (blockingStatus === 'off' && hasBlocks))) return null;

  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 6 }]}>
      <Pressable
        onPress={() => openSettings()}
        accessibilityRole="button"
        accessibilityLabel={stalled ? 'Blocking stalled. Open Accessibility settings.' : 'Blocking is off. Open Accessibility settings.'}
        style={[s.pill, { backgroundColor: colors.dangerDim, borderColor: colors.danger }]}
      >
        <Feather name="alert-circle" size={16} color={colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]}>
            {stalled ? 'Blocking stalled' : 'Blocking is off'}
          </Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>
            {stalled
              ? 'Android stopped it in the background. Switch NoGoon off and on again in Accessibility.'
              : 'Turn NoGoon back on in Accessibility so your apps stay paused.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 13.5 },
  body: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
});
