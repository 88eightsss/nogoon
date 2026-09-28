// ─── Modes ────────────────────────────────────────────────────────────────────
//
// Saved presets that bundle a blocklist + gate settings, optionally tied to
// a schedule so the right one applies itself automatically (e.g. a stricter
// "Work" mode on weekday mornings). See stores/useModesStore.ts for the
// resolution rules and hooks/useAppBlocker.ts for how a resolved mode gets
// applied to the existing blocklist/settings fields.

import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useModesStore, resolveActiveMode, type ModePreset } from '@/stores/useModesStore';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleSummary(mode: ModePreset): string | null {
  const s = mode.schedule;
  if (!s?.enabled) return null;
  const days = s.days.length === 0 || s.days.length === 7
    ? 'Every day'
    : s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d))
    ? 'Weekdays'
    : s.days.length === 2 && [0, 6].every((d) => s.days.includes(d))
    ? 'Weekends'
    : s.days.map((d) => DAY_LABELS[d]).join(', ');
  return `${days} · ${s.start}–${s.end}`;
}

export default function ModesScreen() {
  const { colors, cardStyle } = useTheme();
  const { modes, activeModeId, setActiveModeId, deleteMode } = useModesStore();

  const resolvedNow = resolveActiveMode(modes, activeModeId);

  const confirmDelete = (mode: ModePreset) => {
    Alert.alert(
      'Delete this mode?',
      `"${mode.name}" and its saved settings will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMode(mode.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Modes</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Saved blocklists that switch themselves on a schedule
            </Text>
          </View>
        </View>

        {modes.length === 0 && (
          <View style={[styles.emptyCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Feather name="layers" size={22} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No modes yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Build a couple of presets — say "Work" and "Weekend" — each with its own
              blocklist. Give one a schedule and it'll switch on automatically.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {modes.map((mode) => {
            const isManualActive = activeModeId === mode.id;
            const isResolvedNow  = resolvedNow?.id === mode.id;
            const summary = scheduleSummary(mode);
            return (
              <Pressable
                key={mode.id}
                style={[
                  styles.card,
                  cardStyle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isResolvedNow ? colors.accent : colors.cardBorder,
                    borderWidth: isResolvedNow ? 1.5 : 0.5,
                  },
                ]}
                onPress={() => router.push({ pathname: '/mode-editor', params: { id: mode.id } })}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.emojiChip, { backgroundColor: mode.color + '22' }]}>
                    <Text style={{ fontSize: 18 }}>{mode.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.text }]}>{mode.name}</Text>
                    <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                      {mode.blockedApps.length} apps · {mode.blockedDomains.length} sites
                    </Text>
                  </View>
                  <Pressable hitSlop={10} onPress={() => confirmDelete(mode)}>
                    <Feather name="trash-2" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>

                {isResolvedNow && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.accentDim }]}>
                    <Feather name="check" size={10} color={colors.accent} />
                    <Text style={[styles.activeTxt, { color: colors.accent }]}>Active now</Text>
                  </View>
                )}

                {summary && (
                  <View style={styles.scheduleRow}>
                    <Feather name="clock" size={12} color={colors.textSecondary} />
                    <Text style={[styles.scheduleTxt, { color: colors.textSecondary }]}>{summary}</Text>
                  </View>
                )}

                <Pressable
                  style={[
                    styles.applyBtn,
                    { backgroundColor: isManualActive ? colors.accentDim : colors.surfaceHigh },
                  ]}
                  onPress={() => setActiveModeId(isManualActive ? null : mode.id)}
                >
                  <Text style={[styles.applyTxt, { color: isManualActive ? colors.accent : colors.textSecondary }]}>
                    {isManualActive ? 'Current default' : 'Set as default'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.newBtn, { borderColor: colors.cardBorder }]}
          onPress={() => router.push('/mode-editor')}
        >
          <Feather name="plus" size={16} color={colors.accent} />
          <Text style={[styles.newTxt, { color: colors.accent }]}>New mode</Text>
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          A mode with a schedule takes over automatically during its window. Otherwise,
          whichever one you set as "current default" applies. Hard Mode, Cold Turkey and
          Digital Curfew stay separate — modes never touch them.
        </Text>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FONTS.bodyBold, fontSize: 18, letterSpacing: -0.3 },
  sub:   { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },

  emptyCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  emptyTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, marginTop: 4 },
  emptyDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },

  grid: { gap: SPACING.md },

  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emojiChip: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  cardDesc: { fontFamily: FONTS.body, fontSize: 12, marginTop: 1 },

  activeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activeTxt: { fontFamily: FONTS.bodyMedium, fontSize: 10 },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleTxt: { fontFamily: FONTS.body, fontSize: 12 },

  applyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  applyTxt: { fontFamily: FONTS.bodyMedium, fontSize: 12 },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  newTxt: { fontFamily: FONTS.bodyMedium, fontSize: 14 },

  footer: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: SPACING.md,
  },
});
