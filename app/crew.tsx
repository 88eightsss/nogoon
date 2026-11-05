// ─── Crew and postcards ──────────────────────────────────────────────────────────────────────
// A crew is up to 8 people who go together. It has one shared next thing and a small shelf of postcards:
// a line to your crew only, gone after 7 days. Not a group chat, not a feed, no reactions, no counts.
// Local mock for now (nothing is sent). Tables are in supabase/migrations/20261105_stepout_social.sql.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStepOutStore, CREW_MAX, POSTCARD_DAYS, livePostcards, daysLeft } from '@/stores/useStepOutStore';
import { STEP_SAMPLE } from '@/constants/stepOutSample';
import { StepCard } from '@/components/stepout/StepCard';
import { Shell } from '@/components/stepout/Shell';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function CrewScreen() {
  const { colors, cardStyle } = useTheme();
  const crew = useStepOutStore((s) => s.crew);
  const startCrew = useStepOutStore((s) => s.startCrew);
  const addMember = useStepOutStore((s) => s.addMember);
  const setCrewNext = useStepOutStore((s) => s.setCrewNext);
  const addPostcard = useStepOutStore((s) => s.addPostcard);
  const dropCrew = useStepOutStore((s) => s.dropCrew);
  const [name, setName] = useState('');
  const [person, setPerson] = useState('');
  const [line, setLine] = useState('');

  const banner = UNDER_CONSTRUCTION.stepOutFeed ? (
    <ConstructionSign note="A trial of crews and postcards. Everyone here is made up by you on this phone, and nothing is sent." />
  ) : null;

  if (!crew) {
    return (
      <Shell title="Go together">
        {banner}
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          A crew is up to {CREW_MAX} people who go to things together. You share one next thing and send each other postcards. It is not a group chat.
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={name} onChangeText={setName} placeholder="Name your crew" placeholderTextColor={colors.textMuted}
          maxLength={30} accessibilityLabel="Crew name" returnKeyType="done"
        />
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); startCrew(name); }}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.btnText, { color: colors.background }]}>Start a crew</Text>
        </Pressable>
      </Shell>
    );
  }

  const next = STEP_SAMPLE.find((i) => i.id === crew.nextItemId);
  const cards = livePostcards(crew.postcards);

  return (
    <Shell title={crew.name}>
      {banner}

      <View style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.h, { color: colors.text }]}>The crew</Text>
        <View style={styles.members}>
          {crew.members.map((m) => (
            <View key={m.id} style={[styles.member, { backgroundColor: colors.accentDim }]}>
              <Text style={[styles.memberText, { color: colors.text }]}>{m.name}</Text>
            </View>
          ))}
        </View>
        {crew.members.length < CREW_MAX ? (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={person} onChangeText={setPerson} placeholder="Add someone (a name)" placeholderTextColor={colors.textMuted}
              maxLength={24} accessibilityLabel="Add someone to the crew" returnKeyType="done"
            />
            <Pressable
              onPress={() => { if (addMember(person)) setPerson(''); }}
              accessibilityRole="button" accessibilityLabel="Add"
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={20} color={colors.background} />
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.small, { color: colors.textMuted }]}>The crew is full.</Text>
        )}
        <Text style={[styles.small, { color: colors.textMuted }]}>Sample: names only. The real version invites friends by a private link.</Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text style={[styles.h, { color: colors.text }]}>Next thing together</Text>
        {next ? (
          <>
            <StepCard item={next} onPress={() => router.push({ pathname: '/stepout-event', params: { id: next.id } } as any)} />
            <Pressable onPress={() => setCrewNext(null)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>Clear it</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => router.push('/stepout' as any)}
            accessibilityRole="button"
            style={[styles.btn2, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.btn2Text, { color: colors.text }]}>Pick something from this week</Text>
          </Pressable>
        )}
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text style={[styles.h, { color: colors.text }]}>Postcards</Text>
        <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>One line, to your crew only. Gone after {POSTCARD_DAYS} days.</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={line} onChangeText={setLine} placeholder="Say it in a line" placeholderTextColor={colors.textMuted}
            maxLength={140} accessibilityLabel="Postcard line" returnKeyType="done"
          />
          <Pressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); addPostcard(line); setLine(''); }}
            accessibilityRole="button" accessibilityLabel="Send postcard"
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
          >
            <Feather name="send" size={18} color={colors.background} />
          </Pressable>
        </View>
        {cards.map((c) => (
          <View key={c.id} style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.msg, { color: colors.text }]}>{c.line}</Text>
            <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>Gone in {daysLeft(c)} day{daysLeft(c) === 1 ? '' : 's'}</Text>
          </View>
        ))}
        {cards.length === 0 ? <Text style={[styles.small, { color: colors.textMuted }]}>No postcards right now.</Text> : null}
      </View>

      <Pressable onPress={dropCrew} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: SPACING.md }}>
        <Text style={[styles.small, { color: colors.textMuted }]}>Leave this crew</Text>
      </Pressable>
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  h: { fontFamily: FONTS.display, fontSize: 18 },
  small: { fontFamily: FONTS.body, fontSize: 12, textAlign: 'center' },
  box: { padding: SPACING.md, gap: SPACING.sm },
  msg: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontFamily: FONTS.body, fontSize: 15 },
  btn: { alignItems: 'center', paddingVertical: SPACING.lg, borderRadius: RADIUS.lg },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  btn2: { alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  btn2Text: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  member: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: 16 },
  memberText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },
  addRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  addBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
