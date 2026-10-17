// ─── Reach-out treat ──────────────────────────────────────────────────────────
//
// A little gift from the companion on the Today tab. When the person has spent a long time in
// apps they unlocked today (the Accessibility Service totals that up), the companion slides a
// card in: "that was a long scroll — send someone a hello instead?". It is NOT a notification.
// It only shows while the app is open, once a day, and "Not today" tucks it away.
//
// The hello goes through the system share sheet with a ready-made message, so it works with
// Messages, WhatsApp, anything. Nothing is sent by NoGoon and no contact is ever stored.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, NativeModules, AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { getLocalDateKey } from '@/utils/date';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';
import { PackSprite } from './PackSprite';

const { AppBlocker } = NativeModules;

/** Minutes in unlocked apps today before the treat appears. */
export const REACH_OUT_AFTER_MIN = 45;

const HELLOS = [
  'Hey, thinking of you. Free for a catch-up this week?',
  'Random hello! How are you actually doing?',
  'I just realised I have not heard your voice in a while. Want to call later?',
  'Want to grab a coffee or a walk sometime this week?',
  'Hey you. Tell me one good thing from your week.',
  'Missing you a little. What are you up to this weekend?',
];

const seenKey = (d: string) => `nogoon_reachout_${d}`;

/** Total minutes spent in apps unlocked today (0 when unknown or not on Android). */
async function minutesToday(): Promise<number> {
  if (Platform.OS !== 'android' || !AppBlocker?.getUnlockTimeLog) return 0;
  try {
    const log = JSON.parse(await AppBlocker.getUnlockTimeLog());
    return Math.round((Number(log?.[getLocalDateKey()]) || 0) / 60000);
  } catch {
    return 0;
  }
}

export function ReachOutTreat({ char, stage, petName }: { char: CharacterId; stage: GoonStage; petName: string }) {
  const { colors, cardStyle } = useTheme();
  const [minutes, setMinutes] = useState(0);
  const [hidden, setHidden] = useState(false);

  const check = useCallback(async () => {
    const day = getLocalDateKey();
    try {
      if ((await AsyncStorage.getItem(seenKey(day))) === '1') { setHidden(true); return; }
    } catch {}
    setHidden(false);
    setMinutes(await minutesToday());
  }, []);

  useFocusEffect(useCallback(() => { check(); }, [check]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  if (hidden || minutes < REACH_OUT_AFTER_MIN) return null;

  const dismiss = () => {
    setHidden(true);
    AsyncStorage.setItem(seenKey(getLocalDateKey()), '1').catch(() => {});
  };
  const hello = HELLOS[new Date().getDate() % HELLOS.length];
  const send = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const r = await Share.share({ message: hello });
      if (r.action === Share.sharedAction) dismiss();
    } catch {}
  };
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

  return (
    <View
      style={[styles.card, cardStyle, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}
      accessibilityLabel={`${petName} has a suggestion. You have spent ${time} in unlocked apps today. Send someone a hello?`}
    >
      <View style={styles.row}>
        <PackSprite char={char} stage={stage} cell={5} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, { color: colors.text }]}>{petName} brought you a thought</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {time} of scrolling today. Someone out there would love a hello more than a feed would.
          </Text>
        </View>
      </View>
      <View style={[styles.quote, { borderColor: colors.border }]}>
        <Text style={[styles.quoteText, { color: colors.text }]}>“{hello}”</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={send}
          style={[styles.primary, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Send this hello to someone"
        >
          <Text style={styles.primaryText}>Send a hello</Text>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={8} style={styles.ghost} accessibilityRole="button" accessibilityLabel="Not today">
          <Text style={[styles.ghostText, { color: colors.textMuted }]}>Not today</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  body: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  quoteText: { fontFamily: FONTS.body, fontSize: 13.5, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  primary: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999 },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' },
  ghost: { paddingVertical: 8, paddingHorizontal: 6 },
  ghostText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
});
