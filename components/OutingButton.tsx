// ─── "I went" ─────────────────────────────────────────────────────────────────
// Logs an outing for an event. Two ways: let the phone check you are at the place (2 treats), or just
// say so (1 treat). Both feed the companion; see stores/useOutingStore.ts for the caps.

import { useState } from 'react';
import { Pressable, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useOutingStore, outingKey, TREATS_FOR, type OutingProof } from '@/stores/useOutingStore';
import { checkAtPlace, placeCheckAvailable } from '@/lib/outings';
import { getLocalDateKey } from '@/utils/date';
import type { CommunityEvent } from '@/lib/events';
import { FONTS } from '@/constants/Colors';

export function OutingButton({ event }: { event: CommunityEvent }) {
  const { colors } = useTheme();
  const key = outingKey(event.id, event.title);
  const entry = useOutingStore((s) => s.log.find((o) => o.key === key && o.day === getLocalDateKey()));
  const checkIn = useOutingStore((s) => s.checkIn);
  const [busy, setBusy] = useState(false);

  const record = (proof: OutingProof) => {
    const r = checkIn({ key, title: event.title, proof });
    if (!r.ok) {
      Alert.alert(
        r.reason === 'cap' ? 'That is plenty for one day' : 'Already counted',
        r.reason === 'cap' ? 'Two outings a day earn treats. Enjoy the rest of it.' : 'This one is already in your passport for today.',
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const treatText = r.treats === 1 ? '1 treat' : `${r.treats} treats`;
    Alert.alert('Nice one', r.souvenir ? `${treatText} for your pal, and a souvenir for your passport: ${r.souvenir.name}.` : `${treatText} for your pal.`);
  };

  const verify = async () => {
    setBusy(true);
    const res = await checkAtPlace(event);
    setBusy(false);
    if (res === 'here') { record('place'); return; }
    const why =
      res === 'far' ? 'The phone says you are not at the venue right now.'
      : res === 'too-early' ? 'This is not on right now, so the phone cannot check you in.'
      : res === 'denied' ? 'Location is off for NoGoon, so the phone cannot check.'
      : 'The phone could not check this one.';
    Alert.alert(why, 'You can still count it on your word.', [
      { text: 'Not now', style: 'cancel' },
      { text: `Count it (${TREATS_FOR.self} treat)`, onPress: () => record('self') },
    ]);
  };

  const press = () => {
    Haptics.selectionAsync().catch(() => {});
    if (entry?.proof === 'place') { record('place'); return; }
    if (!placeCheckAvailable()) { record('self'); return; }
    Alert.alert('Count this outing', 'Let the phone check you are there for 2 treats, or just count it for 1. Your location is checked once, on the phone, and not saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just count it', onPress: () => record('self') },
      { text: 'Check I am here', onPress: () => { void verify(); } },
    ]);
  };

  const done = entry != null;
  return (
    <Pressable
      onPress={press}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={done ? `You went to ${event.title}` : `I went to ${event.title}`}
      style={[styles.btn, { borderColor: done ? colors.accent : colors.cardBorder, backgroundColor: done ? colors.accentDim : 'transparent' }]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name={done ? 'check-circle' : 'flag'} size={14} color={colors.accent} />}
      <Text style={[styles.text, { color: colors.accent }]}>{done ? (entry?.proof === 'place' ? 'You were there' : 'Went') : 'I went'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  text: { fontFamily: FONTS.bodyBold, fontSize: 13 },
});
