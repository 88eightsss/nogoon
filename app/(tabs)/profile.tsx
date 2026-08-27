// ─── Me Screen ────────────────────────────────────────────────────────────────
//
// Layout:
//   Zone 1: Name + Day count
//   Zone 2: Control board (blocking, wind-down, hard mode, focus session)
//   Zone 3: Stats — walk-aways + time saved
//   Zone 4: Theme picker (5 presets)
//   Zone 5: Border picker (5 styles)
//   Zone 6: Account (sign out, help, privacy)

import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  Alert, Switch, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/useThemeStore';
import { THEMES, BORDERS, THEME_ORDER, BORDER_ORDER } from '@/constants/Themes';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { GoonSprite, getGoonStage } from '@/components/home/GoonMascot';
import { type CharacterId } from '@/stores/usePetStore';

// ─── Companion defaults ───────────────────────────────────────────────────────
const DEFAULT_COMPANION_NAMES: Record<CharacterId, string> = { 0: 'Buddy', 1: 'Nova', 2: 'Rex' };

// ─── Time saved calculation ───────────────────────────────────────────────────
// Assumes each walk-away saves ~8 minutes of scrolling

function getTimeSaved(walkAways: number): string {
  const minutes = walkAways * 8;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hrs  = hours % 24;
  return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
}

// ─── Compact theme dot ────────────────────────────────────────────────────────

function ThemeDot({ themeId, selected, onSelect }: {
  themeId: (typeof THEME_ORDER)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const palette = THEMES[themeId];
  const { colors } = useTheme();
  return (
    <Pressable onPress={onSelect} style={dotStyles.wrap} hitSlop={6}>
      <View
        style={[
          dotStyles.dot,
          { backgroundColor: palette.accent },
          selected && {
            borderWidth: 2.5,
            borderColor: colors.text,
            transform: [{ scale: 1.25 }],
          },
        ]}
      />
    </Pressable>
  );
}

// ─── Compact border dot ───────────────────────────────────────────────────────

function BorderDot({ borderId, selected, onSelect }: {
  borderId: (typeof BORDER_ORDER)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const config = BORDERS[borderId];
  const { colors } = useTheme();
  const radius = config.radius === -1 ? 6 : 0;

  return (
    <Pressable onPress={onSelect} style={dotStyles.wrap} hitSlop={6}>
      <View
        style={[
          dotStyles.dot,
          {
            backgroundColor: selected ? colors.accent : 'transparent',
            borderRadius: radius,
            borderWidth: Math.max(config.width, 1.5),
            borderColor: selected ? colors.accent : colors.textMuted,
          },
          config.glow && selected && {
            shadowColor: colors.accent,
            shadowOpacity: 0.7,
            shadowRadius: 6,
            elevation: 6,
          },
        ]}
      />
    </Pressable>
  );
}

const dotStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xs,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});

// ─── Wind-down time picker ────────────────────────────────────────────────────

function WindDownPicker({ hour, onChange, onClose, colors }: {
  hour: number;
  onChange: (h: number) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const fmt = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const disp   = h % 12 === 0 ? 12 : h % 12;
    return `${disp}:00 ${suffix}`;
  };

  return (
    <View style={[wdStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={wdStyles.header}>
        <Text style={[wdStyles.title, { color: colors.text }]}>Wind-down starts at</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 240 }}>
        {HOURS.map((h) => (
          <Pressable
            key={h}
            style={[wdStyles.hourRow, h === hour && { backgroundColor: colors.accentDim }]}
            onPress={() => { onChange(h); onClose(); }}
          >
            <Text style={[wdStyles.hourText, { color: h === hour ? colors.accent : colors.text }]}>
              {fmt(h)}
            </Text>
            {h === hour && <Feather name="check" size={16} color={colors.accent} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const wdStyles = StyleSheet.create({
  sheet: {
    margin: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  hourText: {
    fontFamily: FONTS.body,
    fontSize: 15,
  },
});

// ─── Me screen ────────────────────────────────────────────────────────────────

export default function MeScreen() {
  const { colors, cardStyle } = useTheme();
  const {
    themeId, borderId, setTheme, setBorder,
    showIntentionCard, showStruggleToggle, showTimeReclaimed, toggleHomeSection,
  } = useThemeStore();

  const {
    name, setName, walkAwayCount,
    windDownEnabled, windDownHour,
    setWindDownEnabled, setWindDownHour,
    isBricked, enableBricked, requestDisableBricked,
    startFocusSession, focusSessionEnd,
    preferWaitingRoom, setPreferWaitingRoom,
    resetStore,
  } = useUserStore();

  const { signOut } = useAuthStore();
  const { blockingStatus, openSettings } = useAppBlocker();

  const [editingName, setEditingName]   = useState(false);
  const [nameDraft,   setNameDraft]     = useState(name);
  const [showWdPicker, setShowWdPicker] = useState(false);
  const [dayCount,    setDayCount]      = useState(1);

  // ── Companion rename state ───────────────────────────────────────────────
  const [companionNames,    setCompanionNames]    = useState<Record<CharacterId, string>>(DEFAULT_COMPANION_NAMES);
  const [editingCompanion,  setEditingCompanion]  = useState<CharacterId | null>(null);
  const [companionDraft,    setCompanionDraft]    = useState('');

  const companionStage = getGoonStage(walkAwayCount);

  useEffect(() => {
    async function computeDay() {
      const startDate = await AsyncStorage.getItem('nogoon_start_date');
      if (startDate) {
        const start = new Date(startDate).getTime();
        const days  = Math.floor((Date.now() - start) / 86_400_000) + 1;
        setDayCount(days);
      }
    }
    computeDay();
  }, []);

  // Load stored companion names on mount
  useEffect(() => {
    (async () => {
      const names = { ...DEFAULT_COMPANION_NAMES };
      for (const id of [0, 1, 2] as const) {
        const stored = await AsyncStorage.getItem(`@nogoon_pet_name_${id}`);
        if (stored) names[id] = stored;
      }
      setCompanionNames(names);
    })();
  }, []);

  const saveCompanionName = async (id: CharacterId) => {
    const name = companionDraft.trim() || DEFAULT_COMPANION_NAMES[id];
    await AsyncStorage.setItem(`@nogoon_pet_name_${id}`, name);
    setCompanionNames((prev) => ({ ...prev, [id]: name }));
    setEditingCompanion(null);
  };

  const saveName = () => {
    setName(nameDraft.trim());
    setEditingName(false);
  };

  const signOutConfirm = () => {
    Alert.alert('Sign out?', 'Your data is saved to the cloud and will be here when you return.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { resetStore(); signOut(); } },
    ]);
  };

  const hardModeConfirm = () => {
    if (isBricked) {
      Alert.alert(
        'Disable Hard Mode?',
        'You\'ll need to wait 24 hours before it fully turns off.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Request disable', style: 'destructive', onPress: requestDisableBricked },
        ]
      );
    } else {
      Alert.alert(
        'Enable Hard Mode?',
        'NoGoon will play the game but remove the unlock button entirely. You can request to disable it after 24 hours.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', style: 'destructive', onPress: enableBricked },
        ]
      );
    }
  };

  const fmt = (h: number) => {
    const s = h >= 12 ? 'PM' : 'AM';
    const d = h % 12 === 0 ? 12 : h % 12;
    return `${d}:00 ${s}`;
  };

  const timeSaved = getTimeSaved(walkAwayCount);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Zone 1: Identity ── */}
        <View style={styles.zone1}>
          {editingName ? (
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.cardBorder }]}
              value={nameDraft}
              onChangeText={setNameDraft}
              onBlur={saveName}
              onSubmitEditing={saveName}
              autoFocus
              returnKeyType="done"
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Pressable style={styles.nameRow} onPress={() => { setNameDraft(name); setEditingName(true); }}>
              <Text style={[styles.nameText, { color: colors.text }]}>{name || 'Add your name'}</Text>
              <Feather name="edit-2" size={14} color={colors.textMuted} />
            </Pressable>
          )}
          <Text style={[styles.dayLabel, { color: colors.textMuted }]}>Day {dayCount} with NoGoon</Text>
        </View>

        {/* ── Zone 2: Stats ── */}
        <View style={[statsStyles.row]}>
          <View style={[statsStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, flex: 1 }]}>
            <Text style={[statsStyles.num, { color: colors.accent }]}>{walkAwayCount.toLocaleString()}</Text>
            <Text style={[statsStyles.label, { color: colors.textMuted }]}>walk-aways</Text>
          </View>
          <View style={[statsStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, flex: 1 }]}>
            <Text style={[statsStyles.num, { color: colors.accent }]}>{timeSaved}</Text>
            <Text style={[statsStyles.label, { color: colors.textMuted }]}>time saved</Text>
          </View>
        </View>

        {/* ── Companions ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Companions</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {([0, 1, 2] as const).map((id, idx) => (
            <View
              key={id}
              style={[
                ctrlStyles.row,
                idx < 2 ? { borderBottomColor: colors.border } : { borderBottomWidth: 0 },
              ]}
            >
              <GoonSprite char={id} stage={companionStage} size={0.4} />
              {editingCompanion === id ? (
                <TextInput
                  style={[companionStyles.input, { color: colors.text, borderBottomColor: colors.cardBorder }]}
                  value={companionDraft}
                  onChangeText={setCompanionDraft}
                  onBlur={() => saveCompanionName(id)}
                  onSubmitEditing={() => saveCompanionName(id)}
                  autoFocus
                  returnKeyType="done"
                  maxLength={20}
                />
              ) : (
                <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>
                  {companionNames[id]}
                </Text>
              )}
              <Pressable
                hitSlop={12}
                onPress={() => {
                  if (editingCompanion === id) {
                    saveCompanionName(id);
                  } else {
                    setCompanionDraft(companionNames[id]);
                    setEditingCompanion(id);
                  }
                }}
              >
                <Feather
                  name={editingCompanion === id ? 'check' : 'edit-2'}
                  size={14}
                  color={editingCompanion === id ? colors.accent : colors.textMuted}
                />
              </Pressable>
            </View>
          ))}
        </View>

        {/* ── Zone 3: Control board ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Controls</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>

          {/* Blocking */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="shield" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Blocking</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {blockingStatus === 'active' ? 'Active' : 'Off — tap to fix'}
              </Text>
            </View>
            {blockingStatus !== 'active' && (
              <Pressable
                style={[ctrlStyles.fixBtn, { backgroundColor: colors.dangerDim }]}
                onPress={openSettings}
              >
                <Text style={[ctrlStyles.fixTxt, { color: colors.danger }]}>Fix</Text>
              </Pressable>
            )}
            {blockingStatus === 'active' && (
              <View style={[ctrlStyles.activeTag, { backgroundColor: colors.successDim }]}>
                <Text style={[ctrlStyles.activeTxt, { color: colors.success }]}>On</Text>
              </View>
            )}
          </View>

          {/* Wind-down */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="moon" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Wind-down</Text>
              {windDownEnabled && (
                <Pressable onPress={() => setShowWdPicker(true)}>
                  <Text style={[ctrlStyles.sub, { color: colors.accent }]}>Starts at {fmt(windDownHour)} — tap to change</Text>
                </Pressable>
              )}
            </View>
            <Switch
              value={windDownEnabled}
              onValueChange={(val) => {
                setWindDownEnabled(val);
                if (val) setShowWdPicker(true);
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* Hard Mode */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="lock" size={16} color={isBricked ? colors.danger : colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: isBricked ? colors.danger : colors.text }]}>Hard Mode</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Removes unlock button entirely</Text>
            </View>
            <Switch
              value={isBricked}
              onValueChange={hardModeConfirm}
              trackColor={{ false: colors.border, true: colors.danger }}
              thumbColor="#fff"
            />
          </View>

          {/* Waiting Room mode */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="clock" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Waiting Room</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>5s pause instead of a game</Text>
            </View>
            <Switch
              value={preferWaitingRoom}
              onValueChange={setPreferWaitingRoom}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* Protection layers */}
          <Pressable
            style={[ctrlStyles.row, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/protection')}
          >
            <Feather name="layers" size={16} color={colors.accent} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Protection layers</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Home Screen layout ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Home Screen</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="book-open" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Daily intention</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Intention card on home</Text>
            </View>
            <Switch
              value={showIntentionCard}
              onValueChange={() => toggleHomeSection('showIntentionCard')}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="heart" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Struggle mode</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>"Having a hard day?" button</Text>
            </View>
            <Switch
              value={showStruggleToggle}
              onValueChange={() => toggleHomeSection('showStruggleToggle')}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={[ctrlStyles.row, { borderBottomWidth: 0 }]}>
            <Feather name="clock" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Time reclaimed</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Hours of attention saved</Text>
            </View>
            <Switch
              value={showTimeReclaimed}
              onValueChange={() => toggleHomeSection('showTimeReclaimed')}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Zone 4+5: Appearance (compact) ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Appearance</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="droplet" size={16} color={colors.accent} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Theme</Text>
            <View style={appearStyles.dots}>
              {THEME_ORDER.map((id) => (
                <ThemeDot key={id} themeId={id} selected={id === themeId} onSelect={() => setTheme(id)} />
              ))}
            </View>
          </View>
          <View style={[ctrlStyles.row, { borderBottomWidth: 0 }]}>
            <Feather name="square" size={16} color={colors.accent} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Borders</Text>
            <View style={appearStyles.dots}>
              {BORDER_ORDER.map((id) => (
                <BorderDot key={id} borderId={id} selected={id === borderId} onSelect={() => setBorder(id)} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Zone 6: Account ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Account</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/help')}
          >
            <Feather name="help-circle" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Help & guide</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/privacy')}
          >
            <Feather name="file-text" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Privacy policy</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomWidth: 0 }]}
            onPress={signOutConfirm}
          >
            <Feather name="log-out" size={16} color={colors.danger} />
            <Text style={[ctrlStyles.label, { color: colors.danger, flex: 1 }]}>Sign out</Text>
          </Pressable>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Wind-down time picker modal */}
      <Modal
        visible={showWdPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWdPicker(false)}
      >
        <View style={[modalStyles.overlay, { backgroundColor: colors.overlay }]}>
          <WindDownPicker
            hour={windDownHour}
            onChange={setWindDownHour}
            onClose={() => setShowWdPicker(false)}
            colors={colors}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },
  zone1: {
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
  },
  nameText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  nameInput: {
    fontFamily: FONTS.bodyBold,
    fontSize: 24,
    letterSpacing: -0.4,
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  dayLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: SPACING.xs,
    marginBottom: -SPACING.xs,
  },
});

const companionStyles = StyleSheet.create({
  input: {
    flex: 1,
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
});

const statsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  card: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
  },
  num: {
    fontFamily: FONTS.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

const ctrlStyles = StyleSheet.create({
  board: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    gap: SPACING.md,
    borderBottomWidth: 1,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    marginTop: 1,
  },
  fixBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  fixTxt: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
  activeTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activeTxt: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
});

const appearStyles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: SPACING.xl,
  },
});
