// ─── Unwind Tab (the Calm route) ──────────────────────────────────────────────
//
// The "do something better than scroll" hub, laid out like a remote control:
//   One big "I need a minute" button → /breathe (Guide me, or Breathe, Ground, Sit with the urge)
//   Six square buttons, two per row: blue (Journal, Brain Bubbles, Dead Reckoning) first,
//   then orange (Walk, Games, Beyond the screen). "What helps first = Game" puts the orange ones first.
// plus the nightly pre-commitment ritual at the bottom.
// No stats, no scores — just things that help.
//
// Also houses the nightly pre-commitment ritual:
// "Set tonight's rule" → stored in useUserStore.nightlyCommitment
// and surfaced on the gate calm screen the following day.

import { ScrollView, View, Text, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { useTheme } from '@/hooks/useTheme';
import { readableOn, isLightColor } from '@/utils/colorLuminance';
import { useUserStore } from '@/stores/useUserStore';
import { PageGuide } from '@/components/PageGuide';
import { useRoomStore } from '@/stores/useRoomStore';

type Tile = {
  id: string;
  title: string;
  hint: string;
  route: Href;
  /** Feather glyph, or the solid footprints icon. */
  icon: React.ComponentProps<typeof Feather>['name'] | 'footsteps';
};

// Blue = get it out. Orange = do something else.
const BLUE_TILES: Tile[] = [
  { id: 'journal',       title: 'Journal',        hint: 'Write it down',            icon: 'book-open', route: '/journal' as Href },
  { id: 'bubbles',       title: 'Brain Bubbles',  hint: 'Pop a thought',            icon: 'circle',    route: '/bubbles' as Href },
  { id: 'deadreckoning', title: 'Dead Reckoning', hint: 'Where did the time go',    icon: 'trending-up', route: '/dead-reckoning' as Href },
];
const ORANGE_TILES: Tile[] = [
  { id: 'walk',      title: 'Walk',              hint: 'Count your steps with your pal', icon: 'footsteps', route: '/walk' as Href },
  { id: 'games',     title: 'Games',             hint: 'Quick, calm, no pressure',        icon: 'zap',       route: '/(tabs)/arcade' as Href },
  { id: 'elsewhere', title: 'Beyond the screen', hint: 'Calmer apps and things near you', icon: 'map-pin',   route: '/elsewhere' as Href },
];

function TileGrid({ tiles, tint }: { tiles: Tile[]; tint: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const GAP = 10;
  const side = Math.floor((width - SPACING.md * 2 - GAP) / 2);
  const ink = readableOn(tint, colors.background, 4.5);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {tiles.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => router.push(t.route)}
          accessibilityRole="button"
          accessibilityLabel={`${t.title}. ${t.hint}`}
          android_ripple={{ color: tint + '33' }}
          style={({ pressed }) => [
            styles.tile,
            { width: side, height: side, backgroundColor: tint + (pressed ? '2E' : '1F'), borderColor: tint + '4D' },
          ]}
        >
          <View style={[styles.tileChip, { backgroundColor: colors.surface }]}>
            {t.icon === 'footsteps'
              ? <Ionicons name="footsteps" size={30} color={ink} />
              : <Feather name={t.icon} size={28} color={ink} />}
          </View>
          <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={2}>{t.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

function NightlyCommitmentCard() {
  const { colors } = useTheme();
  const nightlyCommitment      = useUserStore(s => s.nightlyCommitment);
  const nightlyCommitmentSetAt = useUserStore(s => s.nightlyCommitmentSetAt);
  const setNightlyCommitment   = useUserStore(s => s.setNightlyCommitment);
  const clearNightlyCommitment = useUserStore(s => s.clearNightlyCommitment);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const hasCurrent = nightlyCommitment.trim().length > 0;

  const setAgoLabel = () => {
    if (!nightlyCommitmentSetAt) return '';
    const mins = Math.round((Date.now() - nightlyCommitmentSetAt) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  };

  function handleSave() {
    const text = draft.trim();
    if (text.length > 0) setNightlyCommitment(text);
    setEditing(false);
    setDraft('');
  }

  function handleEdit() {
    setDraft(nightlyCommitment);
    setEditing(true);
  }

  return (
    <View style={[styles.nightlyCard, { backgroundColor: colors.surface, borderColor: '#7c3aed30' }]}>
      {/* Header row */}
      <View style={styles.nightlyHeader}>
        <View style={[styles.iconWrap, { backgroundColor: '#7c3aed18' }]}>
          <Feather name="moon" size={20} color={readableOn('#7c3aed', colors.surface)} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Tonight's rule</Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            {hasCurrent
              ? `Set ${setAgoLabel()} · shown when you open blocked apps tomorrow`
              : 'Set a limit for yourself tonight · it shows up on the gate tomorrow'}
          </Text>
        </View>
      </View>

      {/* Current commitment display */}
      {hasCurrent && !editing && (
        <View style={styles.currentBox}>
          <Text style={[styles.currentText, { color: readableOn('#a78bfa', colors.surface, 4.5) }]}>"{nightlyCommitment}"</Text>
          <View style={styles.currentActions}>
            <Pressable onPress={handleEdit} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: colors.textSecondary }]}>Edit</Text>
            </Pressable>
            <Text style={[styles.textBtnSep, { color: colors.textMuted }]}>·</Text>
            <Pressable onPress={clearNightlyCommitment} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: colors.danger }]}>Clear</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Input */}
      {(!hasCurrent || editing) && (
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surfaceHigh,
              borderColor: colors.border,
              color: colors.text,
            }]}
            placeholder="e.g. No doomscrolling after 10pm"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoFocus={editing}
            maxLength={120}
            multiline={false}
          />
          <Pressable
            style={[styles.saveBtn, draft.trim().length === 0 && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={draft.trim().length === 0}
          >
            <Text style={styles.saveBtnLabel}>Save</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function CalmScreen() {
  const { colors } = useTheme();
  // "What helps first" (setup questions / Customize): Game puts the orange "do something else" tiles first.
  const helpFirst = useRoomStore((s) => s.helpFirst);
  const orangeFirst = helpFirst === 'game';
  const blue = colors.me;
  const orange = colors.calm;
  const heroInk = isLightColor(colors.protect) ? '#10201F' : '#FFFFFF';

  const blueBlock = (
    <View key="blue" style={{ gap: SPACING.sm }}>
      <SectionLabel title="Get it out" />
      <TileGrid tiles={BLUE_TILES} tint={blue} />
    </View>
  );
  const orangeBlock = (
    <View key="orange" style={{ gap: SPACING.sm }}>
      <SectionLabel title="Do something else" />
      <TileGrid tiles={ORANGE_TILES} tint={orange} />
    </View>
  );

  return (
    <>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Unwind</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Pick a button. No scores, just help.
          </Text>
        </View>

        {/* The one big button */}
        <Pressable
          onPress={() => router.push('/breathe' as Href)}
          accessibilityRole="button"
          accessibilityLabel="I need a minute. Breathe, ground yourself, or sit with the urge."
          android_ripple={{ color: '#FFFFFF33' }}
          style={({ pressed }) => [styles.hero, { backgroundColor: colors.protect, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={[styles.heroChip, { backgroundColor: heroInk === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]}>
            <Feather name="wind" size={30} color={heroInk} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.heroTitle, { color: heroInk }]}>I need a minute</Text>
            <Text style={[styles.heroSub, { color: heroInk }]}>Breathe, ground yourself, or sit with the urge</Text>
          </View>
        </Pressable>

        {orangeFirst ? [orangeBlock, blueBlock] : [blueBlock, orangeBlock]}

        {/* Nightly commitment */}
        <SectionLabel title="Tonight" />
        <NightlyCommitmentCard />

        {/* Reminder */}
        <View style={styles.reminder}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={[styles.reminderText, { color: colors.textMuted }]}>
            You don't have to fight an urge. Most fade on their own if you give them a few minutes.
          </Text>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <PageGuide
      page="calm"
      icon="wind"
      accent={colors.calm}
      title="Unwind"
      hint="Something better to do than scroll"
      subtitle="Urge tools, quick games, and places to put your thoughts. No scores, just help."
      points={[
        { icon: 'wind',      title: 'I need a minute',   body: 'One big button. Be guided through breathing, grounding and the urge timer, or pick one.' },
        { icon: 'zap',       title: 'Square buttons',    body: 'Blue ones help you get it out. Orange ones give you something else to do.' },
        { icon: 'moon',      title: "Tonight's rule",    body: 'A nightly commitment that shows up if you hit a block.' },
      ]}
    />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    minHeight: 104, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 22,
  },
  heroChip: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: FONTS.display, fontSize: 22, lineHeight: 26 },
  heroSub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 19, opacity: 0.92 },
  tile: { borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8 },
  tileChip: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, textAlign: 'center', lineHeight: 18 },
  root: {
    flex: 1,
  },
  scroll: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  headerTitle: {
    ...TYPE.heading,
    marginBottom: 4,
  },
  headerSub: {
    ...TYPE.body,
  },

  sectionHead: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Nightly card ────────────────────────────────────────────────────────────
  nightlyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  nightlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  currentBox: {
    backgroundColor: '#7c3aed10',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    gap: 6,
  },
  currentText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: '#a78bfa',
    lineHeight: 20,
  },
  currentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textBtn: {
    paddingVertical: 2,
  },
  textBtnLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  textBtnSep: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: '#ffffff',
  },

  // ── Tools card ──────────────────────────────────────────────────────────────
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    marginBottom: 2,
  },
  rowSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginLeft: 44 + SPACING.md * 2,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  reminderText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
  },
});
