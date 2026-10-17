// ─── Mode Editor ──────────────────────────────────────────────────────────────
//
// Create or edit a single Mode: its blocklist (apps + domains), a few gate
// settings, and an optional schedule. Reached from app/modes.tsx either with
// no params (new mode) or ?id=<modeId> (editing an existing one).

import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useModesStore, DEFAULT_SCHEDULE, type ModeSchedule } from '@/stores/useModesStore';
import { BLOCKABLE_APPS } from '@/hooks/useAppBlocker';
import { ScheduleEditor } from '@/components/ScheduleEditor';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const EMOJI_CHOICES = ['🎯', '💼', '🌙', '📚', '🏋️', '🧘', '🎮', '🛌', '☀️', '🔒'];
const COLOR_CHOICES = ['#6c8cff', '#ff6b8a', '#4ecdc4', '#ffb84d', '#a78bfa', '#6ee7b7'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function cleanDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

export default function ModeEditorScreen() {
  const { colors, cardStyle } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { modes, createMode, updateMode } = useModesStore();

  const existing = useMemo(() => modes.find((m) => m.id === id), [modes, id]);
  const isEditing = !!existing;

  const [name, setName]   = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? EMOJI_CHOICES[0]);
  const [color, setColor] = useState(existing?.color ?? COLOR_CHOICES[0]);
  const [apps, setApps]   = useState<string[]>(existing?.blockedApps ?? []);
  const [domains, setDomains] = useState<string[]>(existing?.blockedDomains ?? []);
  const [domainInput, setDomainInput] = useState('');
  const [gameMode, setGameModeVal] = useState<'random' | 'choose'>(existing?.gameMode ?? 'random');
  const [noGames, setNoGamesVal]   = useState(existing?.noGames ?? false);
  const [preferWaitingRoom, setPreferWaitingRoomVal] = useState(existing?.preferWaitingRoom ?? false);
  const [schedule, setSchedule] = useState<ModeSchedule>(existing?.schedule ?? DEFAULT_SCHEDULE);

  const toggleApp = (pkg: string) => {
    setApps((prev) => (prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]));
  };

  const addDomain = () => {
    const cleaned = cleanDomain(domainInput);
    if (!cleaned) return;
    if (!domains.includes(cleaned)) setDomains([...domains, cleaned]);
    setDomainInput('');
  };

  const toggleDay = (day: number) => {
    setSchedule((s) => ({
      ...s,
      days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day].sort(),
    }));
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Give it a name', 'Every mode needs a short name so you can tell them apart.');
      return;
    }
    const payload = {
      name, emoji, color,
      blockedApps: apps,
      blockedDomains: domains,
      gameMode,
      noGames,
      preferWaitingRoom,
      schedule,
    };
    if (isEditing && existing) {
      updateMode(existing.id, payload);
    } else {
      createMode(payload);
    }
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? 'Edit mode' : 'New mode'}</Text>
        </View>

        {/* Name */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Mode name — e.g. Work"
          placeholderTextColor={colors.textMuted}
          style={[styles.nameInput, cardStyle, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.cardBorder }]}
        />

        {/* Emoji + color */}
        <View style={styles.rowWrap}>
          {EMOJI_CHOICES.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[
                styles.emojiOpt,
                { backgroundColor: colors.surface, borderColor: emoji === e ? colors.accent : colors.cardBorder, borderWidth: emoji === e ? 1.5 : 0.5 },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rowWrap}>
          {COLOR_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.colorOpt, { backgroundColor: c, borderColor: color === c ? colors.text : 'transparent', borderWidth: color === c ? 2 : 0 }]}
            />
          ))}
        </View>

        {/* Apps */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Block these apps</Text>
        <View style={[styles.section, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {BLOCKABLE_APPS.map((app) => (
            <View key={app.id} style={styles.appRow}>
              <Text style={{ fontSize: 16 }}>{app.emoji}</Text>
              <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
              <Switch
                value={apps.includes(app.id)}
                onValueChange={() => toggleApp(app.id)}
                trackColor={{ true: colors.accentDim, false: colors.border }}
                thumbColor={apps.includes(app.id) ? colors.accent : colors.textMuted}
              />
            </View>
          ))}
        </View>

        {/* Domains */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Block these sites</Text>
        <View style={[styles.section, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.domainInputRow}>
            <TextInput
              value={domainInput}
              onChangeText={setDomainInput}
              placeholder="e.g. reddit.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={addDomain}
              style={[styles.domainInput, { color: colors.text, borderColor: colors.cardBorder }]}
            />
            <Pressable onPress={addDomain} style={[styles.addDomainBtn, { backgroundColor: colors.accentDim }]}>
              <Feather name="plus" size={16} color={colors.accent} />
            </Pressable>
          </View>
          {domains.length > 0 && (
            <View style={styles.rowWrap}>
              {domains.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDomains(domains.filter((x) => x !== d))}
                  style={[styles.domainChip, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}
                >
                  <Text style={[styles.domainChipText, { color: colors.textSecondary }]}>{d}</Text>
                  <Feather name="x" size={12} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Gate settings */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>When this mode blocks something</Text>
        <View style={[styles.section, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Waiting room instead of games</Text>
            <Switch
              value={preferWaitingRoom}
              onValueChange={setPreferWaitingRoomVal}
              trackColor={{ true: colors.accentDim, false: colors.border }}
              thumbColor={preferWaitingRoom ? colors.accent : colors.textMuted}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>No games at all</Text>
            <Switch
              value={noGames}
              onValueChange={setNoGamesVal}
              trackColor={{ true: colors.accentDim, false: colors.border }}
              thumbColor={noGames ? colors.accent : colors.textMuted}
            />
          </View>
          {!noGames && !preferWaitingRoom && (
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Let me pick the game</Text>
              <Switch
                value={gameMode === 'choose'}
                onValueChange={(val) => setGameModeVal(val ? 'choose' : 'random')}
                trackColor={{ true: colors.accentDim, false: colors.border }}
                thumbColor={gameMode === 'choose' ? colors.accent : colors.textMuted}
              />
            </View>
          )}
        </View>

        {/* Schedule */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Automatic schedule</Text>
        <View style={[styles.section, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Switch to this mode automatically</Text>
            <Switch
              value={schedule.enabled}
              onValueChange={(val) => setSchedule((s) => ({ ...s, enabled: val }))}
              trackColor={{ true: colors.accentDim, false: colors.border }}
              thumbColor={schedule.enabled ? colors.accent : colors.textMuted}
            />
          </View>

          {schedule.enabled && (
            <ScheduleEditor schedule={schedule} onChange={setSchedule} colors={colors} />
          )}
        </View>

        <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={save}>
          <Text style={styles.saveTxt}>{isEditing ? 'Save changes' : 'Create mode'}</Text>
        </Pressable>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingBottom: SPACING.sm },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bodyBold, fontSize: 18, letterSpacing: -0.3 },

  nameInput: {
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  emojiOpt: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  colorOpt: { width: 28, height: 28, borderRadius: 14 },

  sectionLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, marginTop: 4 },
  section: {
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  appRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  appName: { flex: 1, fontFamily: FONTS.body, fontSize: 13 },

  domainInputRow: { flexDirection: 'row', gap: SPACING.sm },
  domainInput: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  addDomainBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  domainChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: RADIUS.full, borderWidth: 0.5,
  },
  domainChipText: { fontFamily: FONTS.body, fontSize: 12 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { flex: 1, fontFamily: FONTS.body, fontSize: 13, marginRight: SPACING.sm },

  dayOpt: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dayTxt: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
  hint: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 16 },
  timeRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: 4 },

  saveBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveTxt: { fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' },
});
