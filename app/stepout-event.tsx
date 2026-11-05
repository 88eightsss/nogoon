// ─── One thing, in full ──────────────────────────────────────────────────────────────────────
// Details, then three quiet replies. Only "I'll come along" would ever tell anyone; "Look at it later" and
// "Not this time" send nothing. After "I'll come along" you can open the door for a friend or add it to a crew.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStepOutStore } from '@/stores/useStepOutStore';
import { STEP_SAMPLE } from '@/constants/stepOutSample';
import { VerifiedMark } from '@/components/stepout/StepCard';
import { Shell } from '@/components/stepout/Shell';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function StepOutEvent() {
  const { colors, cardStyle } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = STEP_SAMPLE.find((i) => i.id === id);
  const reply = useStepOutStore((s) => s.reply);
  const clearReply = useStepOutStore((s) => s.clearReply);
  const mine = useStepOutStore((s) => (id ? s.replies[id] : undefined));
  const crew = useStepOutStore((s) => s.crew);
  const setCrewNext = useStepOutStore((s) => s.setCrewNext);

  if (!item) {
    return (
      <Shell title="Not found">
        <Text style={[styles.body, { color: colors.textSecondary }]}>That one is no longer on the list.</Text>
      </Shell>
    );
  }
  const neighbor = item.section === 'neighbor';
  const pick = (r: 'coming' | 'later' | 'no') => {
    Haptics.selectionAsync().catch(() => {});
    reply(item.id, r);
    if (r !== 'coming') router.back();
  };

  return (
    <Shell title={item.title}>
      <Text style={[styles.host, { color: colors.textMuted }]}>{item.host}</Text>
      {neighbor ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>Posted by a neighbor. Not checked by us, so look twice.</Text>
      ) : (
        <VerifiedMark item={item} />
      )}

      <View style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Row icon="clock" text={item.when} />
        <Row icon="map-pin" text={`${item.area} (the host shares the exact spot once you say you're coming)`} />
        <Row icon="tag" text={item.cost} />
        {item.ask ? <Row icon="users" text={item.ask} bold /> : null}
        <Row icon="log-in" text={`Smallest way in: ${item.smallest}`} />
      </View>

      <Text style={[styles.body, { color: colors.text }]}>{item.details}</Text>

      {mine === 'coming' ? (
        <View style={{ gap: SPACING.sm }}>
          <View style={[styles.done, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
            <Feather name="check" size={16} color={colors.accent} />
            <Text style={[styles.doneText, { color: colors.text }]}>You said you're coming. (Sample: nothing was sent.)</Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/door', params: { id: item.id } } as any)}
            accessibilityRole="button"
            style={[styles.btn, { backgroundColor: colors.accent }]}
          >
            <Feather name="unlock" size={18} color={colors.background} />
            <Text style={[styles.btnText, { color: colors.background }]}>Open the door for a friend</Text>
          </Pressable>
          {crew ? (
            <Pressable
              onPress={() => { setCrewNext(item.id); router.push('/crew' as any); }}
              accessibilityRole="button"
              style={[styles.btn2, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
            >
              <Feather name="users" size={18} color={colors.text} />
              <Text style={[styles.btn2Text, { color: colors.text }]}>Make it my crew's next thing</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { clearReply(item.id); }} hitSlop={8} style={styles.textRow} accessibilityRole="button">
            <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>Change my mind</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: SPACING.sm }}>
          <Pressable onPress={() => pick('coming')} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.accent }]}>
            <Text style={[styles.btnText, { color: colors.background }]}>I'll come along</Text>
          </Pressable>
          <Pressable onPress={() => pick('later')} accessibilityRole="button" style={[styles.btn2, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
            <Text style={[styles.btn2Text, { color: colors.text }]}>Look at it later</Text>
          </Pressable>
          <Pressable onPress={() => pick('no')} accessibilityRole="button" style={styles.textRow}>
            <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>Not this time</Text>
          </Pressable>
          <Text style={[styles.small, { color: colors.textMuted }]}>Only "I'll come along" ever tells the host. The other two send nothing.</Text>
        </View>
      )}
    </Shell>
  );
}

function Row({ icon, text, bold }: { icon: React.ComponentProps<typeof Feather>['name']; text: string; bold?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color={colors.accent} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontFamily: bold ? FONTS.bodyBold : FONTS.body, fontSize: 14, lineHeight: 20, color: colors.text }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONTS.body, fontSize: 12, textAlign: 'center' },
  box: { padding: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  btn2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  btn2Text: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  textRow: { paddingVertical: SPACING.sm },
  done: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  doneText: { fontFamily: FONTS.body, fontSize: 14, flex: 1 },
});
