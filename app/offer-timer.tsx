// ─── Offer timer ──────────────────────────────────────────────────────────────
//
// A short do-it-now timer for the body offers (pushups, stretch, walk, water). Counts
// down from a wall-clock end time so it stays right if the phone sleeps. Finishing
// counts as a walk-away. Params: label, seconds, note.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function OfferTimerScreen() {
  const { colors } = useTheme();
  const { label, seconds, note } = useLocalSearchParams<{ label?: string; seconds?: string; note?: string }>();
  const total = Math.max(10, Math.min(1800, Number(seconds) || 60));
  const recordWalkAway = useUserStore((s) => s.recordWalkAway);

  const endAt = useRef(Date.now() + total * 1000).current;
  const [left, setLeft] = useState(total);
  const done = left <= 0;
  const counted = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [endAt]);

  useEffect(() => {
    if (!done || counted.current) return;
    counted.current = true;
    recordWalkAway();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [done, recordWalkAway]);

  const leave = () => router.replace('/(tabs)');
  const pct = Math.min(1, (total - left) / total);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.label, { color: colors.text }]}>{done ? 'Nice. That was a real one.' : (label ?? 'Do it now')}</Text>
        {!done && !!note && <Text style={[styles.note, { color: colors.textSecondary }]}>{note}</Text>}

        <Text style={[styles.clock, { color: done ? colors.accent : colors.text }]} accessibilityLabel={`${left} seconds left`}>
          {done ? 'Done' : mmss(left)}
        </Text>

        <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
        </View>

        {done ? (
          <>
            <Text style={[styles.note, { color: colors.textSecondary }]}>It counts as a walk-away. Your companion noticed.</Text>
            <Pressable onPress={leave} style={[styles.btn, { backgroundColor: colors.accent }]} accessibilityRole="button">
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.btnText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={leave} hitSlop={10} style={styles.skip} accessibilityRole="button">
            <Text style={[styles.note, { color: colors.textMuted }]}>Stop</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.lg },
  label:  { fontFamily: FONTS.display, fontSize: 26, textAlign: 'center' },
  note:   { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  clock:  { fontFamily: FONTS.display, fontSize: 72, letterSpacing: -1 },
  track:  { alignSelf: 'stretch', height: 10, borderRadius: 5, overflow: 'hidden' },
  fill:   { height: 10, borderRadius: 5 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 999 },
  btnText:{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' },
  skip:   { padding: SPACING.sm },
});
