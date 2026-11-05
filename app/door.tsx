// ─── Open the door ───────────────────────────────────────────────────────────────────────────
// A private invite, nothing more: "I'm helping Saturday at 9, the door's open." Sent to a few people you
// choose, through the phone's own share sheet. No reply needed, nobody sees who looked, and "Not this time"
// or "Look at it later" send nothing. Only "I'll come along" would ever reach the sender (once the backend exists).
//
// Two modes:
//   sender   /door?id=<sample item id>      builds the message and opens the share sheet
//   friend   /door?k=..&t=..&w=..&p=..&h=.. the card a friend sees after opening the link
// The link carries only the thing's title, time, area and host. Nothing about the person.

import { useMemo } from 'react';
import { View, Text, Pressable, Share, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStepOutStore } from '@/stores/useStepOutStore';
import { STEP_SAMPLE } from '@/constants/stepOutSample';
import { Shell } from '@/components/stepout/Shell';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const clip = (s: string | undefined, n: number) => (s ?? '').toString().slice(0, n);

export default function DoorScreen() {
  const { colors, cardStyle } = useTheme();
  const q = useLocalSearchParams<{ id?: string; k?: string; t?: string; w?: string; p?: string; h?: string }>();
  const replyDoor = useStepOutStore((s) => s.replyDoor);
  const mine = useStepOutStore((s) => (q.k ? s.doorReplies[q.k] : undefined));

  const item = useMemo(() => STEP_SAMPLE.find((i) => i.id === q.id), [q.id]);

  // ── Sender ────────────────────────────────────────────────────────────────
  if (item) {
    const link = `nogoon://door?k=${encodeURIComponent(item.id)}&t=${encodeURIComponent(item.title)}&w=${encodeURIComponent(item.when)}&p=${encodeURIComponent(item.area)}&h=${encodeURIComponent(item.host)}`;
    const message = `I'm going to "${item.title}" (${item.when}, ${item.area}). The door's open if you want to come along. No need to reply.\n${link}`;
    const send = async () => {
      Haptics.selectionAsync().catch(() => {});
      try { await Share.share({ message }); } catch { /* closed the sheet */ }
    };
    return (
      <Shell title="Open the door">
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Send a friend a quiet invite. They can come, look later, or ignore it. You will only ever hear about a yes.
        </Text>
        <View style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>What they will see</Text>
          <Text style={[styles.msg, { color: colors.text }]}>{message.split('\n')[0]}</Text>
        </View>
        <Pressable onPress={send} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.accent }]}>
          <Feather name="send" size={18} color={colors.background} />
          <Text style={[styles.btnText, { color: colors.background }]}>Choose who to send it to</Text>
        </Pressable>
        <Text style={[styles.small, { color: colors.textMuted }]}>
          It opens your phone's share sheet. Pick one to a few people. Sample: the link only opens in this app, on a phone that has it.
        </Text>
      </Shell>
    );
  }

  // ── Friend ────────────────────────────────────────────────────────────────
  if (q.k && q.t) {
    const key = clip(q.k, 60);
    const choose = (r: 'coming' | 'later' | 'no') => {
      Haptics.selectionAsync().catch(() => {});
      replyDoor(key, r);
      if (r !== 'coming') router.back();
    };
    return (
      <Shell title="A door is open">
        <View style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{clip(q.h, 60) || 'A friend'}</Text>
          <Text style={[styles.msg, { color: colors.text }]}>{clip(q.t, 120)}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{clip(q.w, 60)}{q.p ? ` · ${clip(q.p, 40)}` : ''}</Text>
        </View>
        {mine === 'coming' ? (
          <View style={[styles.done, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
            <Feather name="check" size={16} color={colors.accent} />
            <Text style={[styles.doneText, { color: colors.text }]}>You're coming. (Sample: nothing was sent.)</Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            <Pressable onPress={() => choose('coming')} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.accent }]}>
              <Text style={[styles.btnText, { color: colors.background }]}>I'll come along</Text>
            </Pressable>
            <Pressable onPress={() => choose('later')} accessibilityRole="button" style={[styles.btn2, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
              <Text style={[styles.btn2Text, { color: colors.text }]}>Look at it later</Text>
            </Pressable>
            <Pressable onPress={() => choose('no')} accessibilityRole="button" style={styles.textRow}>
              <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>Not this time</Text>
            </Pressable>
            <Text style={[styles.small, { color: colors.textMuted }]}>Only "I'll come along" tells your friend. The other two send nothing.</Text>
          </View>
        )}
      </Shell>
    );
  }

  return (
    <Shell title="Open the door">
      <Text style={[styles.body, { color: colors.textSecondary }]}>This door is no longer open.</Text>
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONTS.body, fontSize: 12, textAlign: 'center' },
  box: { padding: SPACING.md, gap: SPACING.sm },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
  msg: { fontFamily: FONTS.bodyBold, fontSize: 17, lineHeight: 24 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  btn2: { alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  btn2Text: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  textRow: { paddingVertical: SPACING.sm },
  done: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  doneText: { fontFamily: FONTS.body, fontSize: 14, flex: 1 },
});
