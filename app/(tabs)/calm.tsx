// ─── Calm Tab ─────────────────────────────────────────────────────────────────
//
// Recovery tools hub — for when you're struggling.
// Each row taps into its own full screen.
// No stats, no scores — just things that help.
//
// Also houses the nightly pre-commitment ritual:
// "Set tonight's rule" → stored in useUserStore.nightlyCommitment
// and surfaced on the gate calm screen the following day.

import { ScrollView, View, Text, Pressable, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { PageGuide } from '@/components/PageGuide';
import { useUnlockedFeatures, lockHint } from '@/stores/useProgressStore';

type Tool = {
  id: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconColor: string;
  title: string;
  subtitle: string;
  route: Href;
};

const TOOLS: Tool[] = [
  {
    id:        'breathe',
    icon:      'wind',
    iconColor: '#4d8bff',
    title:     'Breathe',
    subtitle:  'Box breathing · calms the nervous system in 2 min',
    route:     '/breathe',
  },
  {
    id:        'waitingroom',
    icon:      'clock',
    iconColor: '#0277BD',
    title:     'Waiting Room',
    subtitle:  'Sit with the urge · watch it pass on its own',
    route:     '/waiting-room',
  },
  {
    id:        'ground',
    icon:      'anchor',
    iconColor: '#2E7D32',
    title:     'Ground Yourself',
    subtitle:  '5-4-3-2-1 · anchor to the present moment',
    route:     { pathname: '/breathe', params: { mode: 'grounding' } },
  },
  {
    id:        'bubbles',
    icon:      'feather',
    iconColor: '#0ea5e9',
    title:     'Brain Bubbles',
    subtitle:  'Write it out · get the noise out of your head',
    route:     '/bubbles',
  },
  {
    id:        'insights',
    icon:      'bar-chart-2',
    iconColor: '#0277BD',
    title:     'Insights',
    subtitle:  'See your patterns over time',
    route:     '/insights',
  },
];

function ToolRow({ tool }: { tool: Tool }) {
  const { colors } = useTheme();
  const { unlocked } = useUnlockedFeatures();
  // Insights is gated behind walk-aways everywhere else (Me tab); keep Calm consistent.
  const locked = tool.id === 'insights' && !unlocked.has('insights');
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceHigh }]}
      onPress={() => {
        if (locked) { Alert.alert('Still locked', lockHint('insights')); return; }
        router.push(tool.route);
      }}
      android_ripple={{ color: colors.border }}
    >
      <View style={[styles.iconWrap, { backgroundColor: tool.iconColor + '18' }]}>
        <Feather name={tool.icon} size={20} color={tool.iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{tool.title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{locked ? lockHint('insights') : tool.subtitle}</Text>
      </View>
      <Feather name={locked ? 'lock' : 'chevron-right'} size={18} color={colors.textMuted} />
    </Pressable>
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
          <Feather name="moon" size={20} color="#7c3aed" />
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
          <Text style={styles.currentText}>"{nightlyCommitment}"</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>For when you're struggling</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            These tools work. Pick one and give it 2 minutes.
          </Text>
        </View>

        {/* Nightly commitment — above tools */}
        <NightlyCommitmentCard />

        {/* Tools */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: SPACING.md }]}>
          {TOOLS.map((tool, i) => (
            <View key={tool.id}>
              <ToolRow tool={tool} />
              {i < TOOLS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>

        {/* Reminder */}
        <View style={styles.reminder}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={[styles.reminderText, { color: colors.textMuted }]}>
            Urges peak at about 90 seconds then fade. You don't have to fight them — just wait.
          </Text>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <PageGuide
      page="calm"
      icon="wind"
      accent={colors.calm}
      title="Calm"
      hint="Tools for tough moments"
      subtitle="For when you're struggling. No scores, just help."
      points={[
        { icon: 'wind',      title: 'Grounding tools',   body: 'Quick exercises that calm the urge in under 2 minutes.' },
        { icon: 'clock',     title: 'Waiting Room',      body: 'Sit with the urge and watch it pass.' },
        { icon: 'moon',      title: "Tonight's rule",    body: 'A nightly commitment that shows up if you hit a block.' },
      ]}
    />
    </>
  );
}

const styles = StyleSheet.create({
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
