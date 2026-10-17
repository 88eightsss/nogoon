// ─── Modes ──────────────────────────────────────────────────────────────────────
//
// Saved presets that bundle a blocklist + gate settings. The list works like a phone's Clock
// app: each mode is a card with its time window, an on/off switch, and tap-to-expand day chips
// and clock wheels. See stores/useModesStore.ts for the resolution rules and
// hooks/useAppBlocker.ts for how a resolved mode gets applied to the live lists.

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useModesStore, resolveActiveMode, DEFAULT_SCHEDULE, type ModePreset } from '@/stores/useModesStore';
import { ScheduleEditor } from '@/components/ScheduleEditor';
import { daysLabel, format12, nextChangeLine } from '@/utils/schedule';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function ModesScreen() {
  const { colors, cardStyle } = useTheme();
  const { modes, activeModeId, setActiveModeId, deleteMode, updateMode } = useModesStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const resolvedNow = resolveActiveMode(modes, activeModeId);
  const nextLine = nextChangeLine(modes);

  const confirmDelete = (mode: ModePreset) => {
    Alert.alert(
      'Delete this mode?',
      `"${mode.name}" and its saved settings will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { if (openId === mode.id) setOpenId(null); deleteMode(mode.id); } },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Modes</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>Blocklists that switch themselves on a schedule</Text>
          </View>
        </View>

        {nextLine ? (
          <View style={[styles.nextBanner, { backgroundColor: colors.accentDim }]}>
            <Feather name="clock" size={14} color={colors.accent} />
            <Text style={[styles.nextText, { color: colors.accent }]}>{nextLine}</Text>
          </View>
        ) : null}

        {modes.length === 0 && (
          <View style={[styles.emptyCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Feather name="layers" size={22} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No modes yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              Make a couple of presets, say "Work" and "Weekend", each with its own blocklist.
              Switch on a time window and it takes over by itself, just like an alarm.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {modes.map((mode) => {
            const s = mode.schedule ?? DEFAULT_SCHEDULE;
            const isManualActive = activeModeId === mode.id;
            const isResolvedNow = resolvedNow?.id === mode.id;
            const open = openId === mode.id;
            return (
              <View
                key={mode.id}
                style={[
                  styles.card, cardStyle,
                  { backgroundColor: colors.surface, borderColor: isResolvedNow ? colors.accent : colors.cardBorder, borderWidth: isResolvedNow ? 1.5 : 0.5 },
                ]}
              >
                <Pressable
                  onPress={() => setOpenId(open ? null : mode.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${mode.name}. ${format12(s.start)} to ${format12(s.end)}, ${daysLabel(s.days)}. ${s.enabled ? 'On' : 'Off'}. Tap to ${open ? 'close' : 'edit'}.`}
                  style={styles.topRow}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.time, { color: s.enabled ? colors.text : colors.textMuted }]}>
                      {format12(s.start)} – {format12(s.end)}
                    </Text>
                    <Text style={[styles.cardName, { color: colors.text }]}>
                      {mode.emoji}  {mode.name}
                    </Text>
                    <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                      {s.enabled ? daysLabel(s.days) : 'Schedule off'} · {mode.blockedApps.length} apps · {mode.blockedDomains.length} sites
                    </Text>
                  </View>
                  <Switch
                    value={!!s.enabled}
                    onValueChange={(v) => updateMode(mode.id, { schedule: { ...s, enabled: v } })}
                    trackColor={{ true: colors.accentDim, false: colors.border }}
                    thumbColor={s.enabled ? colors.accent : colors.textMuted}
                    accessibilityLabel={`${mode.name} schedule`}
                  />
                </Pressable>

                {isResolvedNow && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.accentDim }]}>
                    <Feather name="check" size={10} color={colors.accent} />
                    <Text style={[styles.activeTxt, { color: colors.accent }]}>Active now</Text>
                  </View>
                )}

                {open && (
                  <View style={[styles.editor, { borderTopColor: colors.cardBorder }]}>
                    <ScheduleEditor
                      schedule={s}
                      onChange={(next) => updateMode(mode.id, { schedule: { ...next, enabled: true } })}
                      colors={colors}
                    />
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.applyBtn, { backgroundColor: isManualActive ? colors.accentDim : colors.surfaceHigh }]}
                        onPress={() => setActiveModeId(isManualActive ? null : mode.id)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.applyTxt, { color: isManualActive ? colors.accent : colors.textSecondary }]}>
                          {isManualActive ? 'Current default' : 'Set as default'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.applyBtn, { backgroundColor: colors.surfaceHigh }]}
                        onPress={() => router.push({ pathname: '/mode-editor', params: { id: mode.id } })}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.applyTxt, { color: colors.textSecondary }]}>Blocklist & settings</Text>
                      </Pressable>
                      <Pressable hitSlop={10} onPress={() => confirmDelete(mode)} accessibilityRole="button" accessibilityLabel={`Delete ${mode.name}`}>
                        <Feather name="trash-2" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          style={[styles.newBtn, { borderColor: colors.cardBorder }]}
          onPress={() => router.push('/mode-editor')}
          accessibilityRole="button"
        >
          <Feather name="plus" size={16} color={colors.accent} />
          <Text style={[styles.newTxt, { color: colors.accent }]}>New mode</Text>
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          A mode with its switch on takes over during its window. Otherwise, whichever one you set as
          the default applies. Hard Mode, Cold Turkey and Digital Curfew stay separate: modes never touch them.
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  time: { fontFamily: FONTS.display, fontSize: 28, letterSpacing: -0.5 },
  nextBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  nextText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  editor: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.md, gap: SPACING.md },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
