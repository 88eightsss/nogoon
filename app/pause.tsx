// ─── Pause blocking (opened from the Quick Settings tile) ────────────────────
// The tile used to switch blocking off for 30 minutes with one tap. Now it opens this screen:
// a 10 second wait, a "keep blocking" button that is always the easy one, and then a 10 minute
// pause if the person still wants it. Hard Mode and Cold Turkey do not allow a pause at all.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, NativeModules, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { exitGate } from '@/utils/exitGate';
import { FONTS } from '@/constants/Colors';

const { AppBlocker } = NativeModules;
const WAIT_SECONDS = 10;
const PAUSE_MINUTES = 10;

export default function PauseScreen() {
  const { colors } = useTheme();
  const locked = useUserStore((s) => s.isBricked || s.isColdTurkey);
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (locked || left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, locked]);

  const keepBlocking = () => exitGate();

  const pause = async () => {
    try {
      if (Platform.OS === 'android' && typeof AppBlocker?.setBlockingPaused === 'function') {
        await AppBlocker.setBlockingPaused(true);
      }
      exitGate();
    } catch {
      setFailed(true);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.body}>
        <View style={[s.iconWrap, { backgroundColor: colors.accentDim }]}>
          <Feather name={locked ? 'lock' : 'pause-circle'} size={28} color={colors.accent} />
        </View>
        <Text style={[s.title, { color: colors.text }]}>
          {locked ? 'Pausing is off right now' : 'Pause blocking?'}
        </Text>
        <Text style={[s.text, { color: colors.textSecondary }]}>
          {locked
            ? 'Hard Mode is on, so blocking cannot be paused. That is the point of it. You can always breathe first.'
            : `Blocking stops for ${PAUSE_MINUTES} minutes, then comes back by itself. Take a breath. Is there something else you could do for a few minutes instead?`}
        </Text>
        {failed && (
          <Text style={[s.text, { color: colors.danger }]}>Could not pause. Blocking stays on.</Text>
        )}
      </View>

      <View style={s.actions}>
        <Pressable
          onPress={keepBlocking}
          accessibilityRole="button"
          style={[s.primary, { backgroundColor: colors.accent }]}
        >
          <Text style={s.primaryText}>{locked ? 'Close' : 'Keep blocking'}</Text>
        </Pressable>
        {!locked && (
          <Pressable
            onPress={pause}
            disabled={left > 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: left > 0 }}
            style={[s.secondary, { opacity: left > 0 ? 0.5 : 1 }]}
          >
            <Text style={[s.secondaryText, { color: colors.textMuted }]}>
              {left > 0 ? `Pause for ${PAUSE_MINUTES} minutes (${left})` : `Pause for ${PAUSE_MINUTES} minutes`}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.display, fontSize: 26, textAlign: 'center' },
  text: { fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  actions: { gap: 6 },
  primary: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' },
  secondary: { height: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: FONTS.bodyMedium, fontSize: 14.5 },
});
