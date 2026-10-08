// ─── Me Screen ────────────────────────────────────────────────────────────────
//
// Layout:
//   Zone 1: Name + Day count
//   Zone 2: Control board (blocking, wind-down, hard mode, focus session)
//   Zone 3: Stats — walk-aways + time saved
//   Zone 4: Theme picker (5 presets)
//   Zone 5: Border picker (5 styles)
//   Zone 6: Account (sign out, help, privacy)

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  Alert, Switch, TextInput, Modal, PanResponder,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey, localDateKeyDiffDays } from '@/utils/date';
import * as Haptics from 'expo-haptics';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { describeBlockingStatus } from '@/utils/blockingStatus';
import { PulseGlow } from '@/components/PulseGlow';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/useThemeStore';
import { THEMES, BORDERS, THEME_ORDER, BORDER_ORDER, ThemePalette, brightnessLabel } from '@/constants/Themes';
import { FONTS } from '@/constants/Colors';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { GoonSprite, getGoonStage } from '@/components/home/GoonMascot';
import { type CharacterId } from '@/stores/usePetStore';
import { useUnlockedFeatures, lockHint, useProgressStore, PROGRESSIVE_UNLOCKS } from '@/stores/useProgressStore';
import { PageGuide } from '@/components/PageGuide';
import Constants from 'expo-constants';
import { TimeStepper } from '@/components/TimeStepper';

// ─── Companion defaults ───────────────────────────────────────────────────────
const DEFAULT_COMPANION_NAMES: Record<CharacterId, string> = { 0: 'Buddy', 1: 'Nova', 2: 'Rex' };

// ─── Time saved calculation ───────────────────────────────────────────────────
// Formats getMinutesSaved(walkAwayCount) — ~20 min per walk-away, see useUserStore.

function getTimeSaved(minutes: number): string {
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
  const triad = THEMES[themeId];
  // Preview swatch uses the theme's native-mode accent — its "home" look —
  // rather than a brightness-resolved color, so the dot always reads as
  // that theme's own identity regardless of the current dial position.
  const previewAccent = triad[triad.nativeMode].accent;
  const { colors } = useTheme();
  return (
    <Pressable onPress={onSelect} style={dotStyles.wrap} hitSlop={6}>
      <View
        style={[
          dotStyles.dot,
          { backgroundColor: previewAccent },
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
  // Real radius values now range 0 (Sharp) to RADIUS.xl (Soft) -- scale that
  // onto the 26px dot (half-size 13) proportionally so the preview still shows
  // relative roundness rather than clamping everything >=13px into one circle.
  const radius = Math.round((config.radius / RADIUS.xl) * 13);

  // 'None' has zero border width by definition — a ring preview would be
  // invisible (or, worse, get clamped up to look identical to 'Soft'). Give it
  // its own solid-fill look instead so it reads as its own option at a glance.
  if (borderId === 'none') {
    return (
      <Pressable onPress={onSelect} style={dotStyles.wrap} hitSlop={6}>
        <View
          style={[
            dotStyles.dot,
            {
              backgroundColor: selected ? colors.accent : colors.textSecondary,
              borderRadius: 6,
            },
          ]}
        />
      </Pressable>
    );
  }

  // Widths (1.5 / 2 / 4) are amplified for the preview — at real size the gap
  // between them reads as noise at 22px; scaled up it's an actual difference
  // you can see without tapping through each one.
  const previewWidth = Math.max(config.width * 1.7, 2.5);

  return (
    <Pressable onPress={onSelect} style={dotStyles.wrap} hitSlop={6}>
      <View
        style={[
          dotStyles.dot,
          {
            backgroundColor: selected ? colors.accentDim : 'transparent',
            borderRadius: radius,
            borderWidth: previewWidth,
            borderColor: selected ? colors.accent : colors.textSecondary,
            ...(config.lineStyle && { borderStyle: config.lineStyle }),
          },
          // Glow gets a persistent (if faint) halo even unselected, so it
          // doesn't sit there looking identical to Soft until you tap it.
          config.glow && {
            shadowColor: colors.accent,
            shadowOpacity: selected ? 0.7 : 0.35,
            shadowRadius: selected ? 6 : 3,
            elevation: selected ? 6 : 3,
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
    width: 26,
    height: 26,
    borderRadius: 13,
  },
});

const homeModeStyles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  segmentText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
});

// ─── Brightness slider ────────────────────────────────────────────────────────

const THUMB_SIZE = 20;

function BrightnessSlider({ value, onChange, colors }: {
  value: number;
  onChange: (v: number) => void;
  colors: ThemePalette;
}) {
  const trackWidth = useRef(0);
  const startValue = useRef(value);
  const [trackW, setTrackW] = useState(0);
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const w = trackWidth.current;
        if (w <= 0) return;
        // Map tap position into 0-100, accounting for thumb radius padding
        const usableW = w - THUMB_SIZE;
        const x = Math.max(0, Math.min(e.nativeEvent.locationX - THUMB_SIZE / 2, usableW));
        const v = clamp((x / usableW) * 100);
        startValue.current = v;
        onChange(v);
      },
      onPanResponderMove: (_, gs) => {
        const w = trackWidth.current;
        if (w <= 0) return;
        const usableW = w - THUMB_SIZE;
        const v = clamp(startValue.current + (gs.dx / usableW) * 100);
        onChange(v);
      },
    })
  ).current;

  // Pixel-based thumb position — stays fully within track at value=0 and value=100
  const usableW  = trackW - THUMB_SIZE;
  const thumbLeft = trackW > 0 ? (value / 100) * usableW : 0;
  const fillWidth = thumbLeft + THUMB_SIZE / 2;

  return (
    <View style={brightStyles.container}>
      <Feather name="moon" size={14} color={value < 40 ? colors.accent : colors.textMuted} />
      <View
        style={brightStyles.trackWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          trackWidth.current = w;
          setTrackW(w);
        }}
        {...panResponder.panHandlers}
      >
        {/* Track fill — grows from left edge to center of thumb */}
        <View style={[brightStyles.trackBg, { backgroundColor: colors.border }]}>
          <View style={[brightStyles.trackFill, { width: fillWidth, backgroundColor: colors.accent }]} />
        </View>
        {/* Center tick — marks the Grey anchor at the midpoint of the dial */}
        <View
          pointerEvents="none"
          style={[brightStyles.tick, { backgroundColor: colors.textMuted }]}
        />
        {/* Thumb — pixel-positioned, no overflow */}
        <View
          style={[
            brightStyles.thumb,
            {
              left: thumbLeft,
              backgroundColor: colors.accent,
              borderColor: colors.surface,
            },
          ]}
        />
      </View>
      <Feather name="sun" size={14} color={value > 60 ? colors.accent : colors.textMuted} />
    </View>
  );
}

const brightStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
  },
  trackWrap: {
    flex: 1,
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  trackBg: {
    height: 4,
    borderRadius: 2,
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 10,
    borderRadius: 1,
    top: (THUMB_SIZE + 8) / 2 - 5,
    opacity: 0.6,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2.5,
    top: (THUMB_SIZE + 8) / 2 - THUMB_SIZE / 2,
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
    themeBrightness, setThemeBrightness,
    homeMode, setHomeMode,
  } = useThemeStore();

  const {
    name, setName, walkAwayCount,
    windDownEnabled, windDownHour,
    setWindDownEnabled, setWindDownHour,
    isBricked, enableBricked, requestDisableBricked, cancelDisableBricked, brickedDisableRequestedAt,
    startFocusSession, endFocusSession, focusSessionEnd,
    isColdTurkey, coldTurkeyDisableRequestedAt, enableColdTurkey, requestDisableColdTurkey,
    cancelDisableColdTurkey, confirmDisableColdTurkey,
    curfewEnabled, curfewStart, curfewEnd, setCurfew,
    preferWaitingRoom, setPreferWaitingRoom,
  } = useUserStore();

  const { signOut, deleteAccount } = useAuthStore();
  const [showDelete, setShowDelete] = useState(false);
  const [showColdOff, setShowColdOff] = useState(false);
  const [coldText, setColdText] = useState('');
  const COLD_PHRASE = 'TURN IT OFF';
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { blockingStatus, openSettings } = useAppBlocker();
  const blockingView = describeBlockingStatus(blockingStatus, colors);
  const { unlocked } = useUnlockedFeatures();
  const { forceUnlockAll, setForceUnlockAll } = useProgressStore();

  const [editingName, setEditingName]   = useState(false);
  const [nameDraft,   setNameDraft]     = useState(name);
  const [showWdPicker, setShowWdPicker] = useState(false);
  const [dayCount,    setDayCount]      = useState(1);

  // Focus Session — a small local clock tick so "X min left" stays roughly
  // fresh without a full per-second countdown (this is a settings row, not
  // the gate screen's hard-lock timer).
  const [focusNow, setFocusNow] = useState(() => Date.now());
  useEffect(() => {
    if (!focusSessionEnd) return;
    const interval = setInterval(() => setFocusNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [focusSessionEnd]);
  const focusActive = !!focusSessionEnd && focusSessionEnd > focusNow;
  const focusMinutesLeft = focusActive ? Math.max(1, Math.ceil((focusSessionEnd! - focusNow) / 60_000)) : 0;

  // ── Companion rename state ───────────────────────────────────────────────
  const [companionNames,    setCompanionNames]    = useState<Record<CharacterId, string>>(DEFAULT_COMPANION_NAMES);
  const [editingCompanion,  setEditingCompanion]  = useState<CharacterId | null>(null);
  const [companionDraft,    setCompanionDraft]    = useState('');

  const companionStage = getGoonStage(walkAwayCount);

  useEffect(() => {
    async function computeDay() {
      const startDate = await AsyncStorage.getItem('nogoon_start_date');
      if (startDate) {
        // Local calendar-day difference, not ms-since-epoch math against a
        // date-only string — new Date('YYYY-MM-DD') parses as UTC midnight,
        // which drifted the count by a day for anyone off from UTC (see
        // utils/date.ts).
        const days = localDateKeyDiffDays(getLocalDateKey(), startDate) + 1;
        setDayCount(days);
      } else {
        // First time anything has read this key (e.g. user opened Me before
        // ever landing on the home screen) — set it now so Day count starts
        // counting immediately instead of silently staying stuck at 1.
        await AsyncStorage.setItem('nogoon_start_date', getLocalDateKey());
        setDayCount(1);
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
    Alert.alert('Sign out?', 'Your progress is synced to your account. Sign back in to pick up where you left off.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  const closeDelete = () => {
    if (deleting) return;
    setShowDelete(false);
    setDeleteText('');
    setDeleteError(null);
  };

  const runDelete = async () => {
    if (deleting || deleteText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    setDeleteError(null);
    const err = await deleteAccount();
    setDeleting(false);
    if (err) setDeleteError(err);
    // On success the auth listener routes to the sign-in screen.
  };

  // Cold Turkey: the strictest setting. No unlock path at all (it also switches
  // Hard Mode on). Turning it off takes a 48-hour wait AND typing a phrase, so a
  // weak moment can't undo a decision made on a strong one.
  const coldTurkeyConfirm = () => {
    const WAIT = 48 * 3600000;
    if (isColdTurkey && coldTurkeyDisableRequestedAt) {
      const left = WAIT - (Date.now() - coldTurkeyDisableRequestedAt);
      if (left <= 0) { setColdText(''); setShowColdOff(true); return; }
      const hrs = Math.floor(left / 3600000);
      const mins = Math.ceil((left % 3600000) / 60000);
      Alert.alert(
        'Cold Turkey is turning off',
        `You can finish turning it off in about ${hrs}h ${mins}m. Or keep it on.`,
        [
          { text: 'Keep waiting', style: 'cancel' },
          { text: 'Keep it on', onPress: cancelDisableColdTurkey },
        ]
      );
      return;
    }
    if (isColdTurkey) {
      Alert.alert(
        'Turn off Cold Turkey?',
        'You\'ll have to wait 48 hours, then type a phrase to confirm. Until then nothing can be unlocked.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start the 48 hours', style: 'destructive', onPress: requestDisableColdTurkey },
        ]
      );
      return;
    }
    Alert.alert(
      'Start Cold Turkey?',
      'Blocked apps and sites can\'t be unlocked at all. No points, no waiting, no override. Hard Mode turns on with it. To end it you must ask, wait 48 hours, and type a phrase. This is for when you really mean it.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Start Cold Turkey', style: 'destructive', onPress: enableColdTurkey },
      ]
    );
  };

  const hardModeConfirm = () => {
    if (isBricked && brickedDisableRequestedAt) {
      const left = Math.max(0, 24 * 3600000 - (Date.now() - brickedDisableRequestedAt));
      const hrs = Math.floor(left / 3600000);
      const mins = Math.ceil((left % 3600000) / 60000);
      Alert.alert(
        'Hard Mode is turning off',
        `It switches off in about ${hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}. You can keep it on instead.`,
        [
          { text: 'Let it turn off', style: 'cancel' },
          { text: 'Keep it on', onPress: cancelDisableBricked },
        ]
      );
      return;
    }
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

  const timeSaved = getTimeSaved(getMinutesSaved(walkAwayCount));

  return (
    <>
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        {/* Regrouped into three labeled clusters (was one flat list of 7
            rows) — new users kept landing on this screen after having just
            met Hard Mode/Wind-down/Waiting Room/Modes in onboarding-adjacent
            copy with nothing tying them together. Enforcement = is blocking
            even running. Blocklist = what's on it and when. Blocking
            strength = how hard the gate pushes back once something's hit. */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Controls</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>

          <Text style={[ctrlStyles.groupLabel, { color: colors.textMuted }]}>Enforcement</Text>

          {/* Blocking */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="shield" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Blocking</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {blockingView.visible ? blockingView.short : ' '}
              </Text>
            </View>
            {blockingView.alarm && (
              <PulseGlow active color={blockingView.color} radius={RADIUS.sm}>
                <Pressable
                  style={[ctrlStyles.fixBtn, { backgroundColor: blockingView.dim }]}
                  onPress={openSettings}
                >
                  <Text style={[ctrlStyles.fixTxt, { color: blockingView.color }]}>Fix</Text>
                </Pressable>
              </PulseGlow>
            )}
            {blockingStatus === 'active' && (
              <View style={[ctrlStyles.activeTag, { backgroundColor: colors.successDim }]}>
                <Text style={[ctrlStyles.activeTxt, { color: colors.success }]}>On</Text>
              </View>
            )}
          </View>

          {/* Coverage — was "Protection layers"; renamed so it stops reading
              as a duplicate of the Protect tab. Same screen (app/protection.tsx),
              still the Accessibility/VPN/Notification-listener status page. */}
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/protection')}
          >
            <Feather name="layers" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Coverage</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>{NETWORK_SHIELD_ENABLED ? 'Accessibility, VPN filter, notifications' : 'Accessibility, notifications, battery'}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          <Text style={[ctrlStyles.groupLabel, { color: colors.textMuted }]}>Blocklist</Text>

          {/* Modes */}
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/modes' as any);
            }}
          >
            <Feather name="layers" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Modes</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                Saved blocklists that can switch on a schedule
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          <Text style={[ctrlStyles.groupLabel, { color: colors.textMuted }]}>Blocking strength</Text>

          {/* Wind-down */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="moon" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Wind-down</Text>
              {!windDownEnabled && (
                <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Ramps up friction after a nightly cutoff</Text>
              )}
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

          {/* Digital Curfew — the store/native plumbing (setCurfew, and a live
              per-event check in NoGoonAccessibilityService.kt) has existed for
              a while with no way to actually turn it on. This is that control. */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border, alignItems: 'flex-start' }]}>
            <Feather name="moon" size={16} color={colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[ctrlStyles.label, { color: colors.text }]}>Digital Curfew</Text>
                  <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Dead-end gate, no unlock, during these hours</Text>
                </View>
                <Switch
                  value={curfewEnabled}
                  onValueChange={(val) => setCurfew(val, curfewStart, curfewEnd)}
                  trackColor={{ false: colors.border, true: colors.danger }}
                  thumbColor="#fff"
                />
              </View>
              {curfewEnabled && (
                <View style={{ flexDirection: 'row', gap: SPACING.xl, marginTop: 2 }}>
                  <TimeStepper label="Starts" value={curfewStart} onChange={(v) => setCurfew(true, v, curfewEnd)} colors={colors} />
                  <TimeStepper label="Ends"   value={curfewEnd}   onChange={(v) => setCurfew(true, curfewStart, v)} colors={colors} />
                </View>
              )}
            </View>
          </View>

          {/* Hard Mode */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="lock" size={16} color={isBricked ? colors.danger : colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: isBricked ? colors.danger : colors.text }]}>Hard Mode</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {isBricked && brickedDisableRequestedAt ? 'Turning off — within 24 hours' : 'Removes unlock button entirely'}
              </Text>
            </View>
            <Switch
              value={isBricked}
              onValueChange={hardModeConfirm}
              trackColor={{ false: colors.border, true: colors.danger }}
              thumbColor="#fff"
            />
          </View>

          {/* Cold Turkey — strictest tier above Hard Mode */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="slash" size={16} color={isColdTurkey ? colors.danger : colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: isColdTurkey ? colors.danger : colors.text }]}>Cold Turkey</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {isColdTurkey && coldTurkeyDisableRequestedAt ? 'Turning off: 48 hour wait' : 'No unlocks at all. Takes 48 hours to turn off'}
              </Text>
            </View>
            <Switch
              value={isColdTurkey}
              onValueChange={coldTurkeyConfirm}
              trackColor={{ false: colors.border, true: colors.danger }}
              thumbColor="#fff"
            />
          </View>

          {/* Focus Session — same story as Curfew: startFocusSession /
              endFocusSession and gate.tsx's whole no-bypass "focus" phase
              already existed; this is the first actual button for it. */}
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border, alignItems: 'flex-start' }]}>
            <Feather name="target" size={16} color={focusActive ? colors.danger : colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[ctrlStyles.label, { color: focusActive ? colors.danger : colors.text }]}>Focus Session</Text>
              {focusActive ? (
                <>
                  <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                    No bypasses for {focusMinutesLeft} more min
                  </Text>
                  <Pressable
                    style={[ctrlStyles.fixBtn, { backgroundColor: colors.surfaceHigh, alignSelf: 'flex-start' }]}
                    onPress={() => Alert.alert('End focus session?', 'Blocked apps will get their normal unlock path back.', [
                      { text: 'Keep going', style: 'cancel' },
                      { text: 'End it', style: 'destructive', onPress: endFocusSession },
                    ])}
                  >
                    <Text style={[ctrlStyles.fixTxt, { color: colors.textSecondary }]}>End early</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Temporary hard-lock, no unlock path until it ends</Text>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    {[30, 60, 120].map((mins) => (
                      <Pressable
                        key={mins}
                        style={[ctrlStyles.fixBtn, { backgroundColor: colors.accentDim }]}
                        onPress={() => Alert.alert(`Start a ${mins}-minute focus session?`, 'Blocked apps get no unlock path until it ends. You can end it early from this screen.', [
                          { text: 'Not now', style: 'cancel' },
                          { text: 'Start', onPress: () => startFocusSession(mins) },
                        ])}
                      >
                        <Text style={[ctrlStyles.fixTxt, { color: colors.accent }]}>{mins}m</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Waiting Room mode */}
          <View style={[ctrlStyles.row, { borderBottomWidth: 0 }]}>
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
        </View>

        {/* ── Home Screen layout ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Home Screen</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="layout" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Layout</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {homeMode === 'organizer' ? 'Customizable widget grid' : 'Companion front and center'}
              </Text>
            </View>
            <View style={homeModeStyles.segment}>
              {(['companion', 'organizer'] as const).map((mode) => {
                const selected = homeMode === mode;
                const modeLocked = mode === 'organizer' && !unlocked.has('organizerMode');
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      if (selected) return;
                      if (modeLocked) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Alert.alert('Still locked', lockHint('organizerMode'));
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setHomeMode(mode);
                    }}
                    style={[
                      homeModeStyles.segmentBtn,
                      {
                        backgroundColor: selected ? colors.accent : 'transparent',
                        borderColor: selected ? colors.accent : colors.border,
                        opacity: modeLocked ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        homeModeStyles.segmentText,
                        { color: selected ? '#fff' : colors.textSecondary },
                      ]}
                    >
                      {mode === 'companion' ? 'Companion' : modeLocked ? 'Organizer 🔒' : 'Organizer'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {homeMode === 'organizer' ? (
            <Pressable
              style={[ctrlStyles.row, { borderBottomWidth: 0 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/layout-picker' as any);
              }}
            >
              <Feather name="grid" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[ctrlStyles.label, { color: colors.text }]}>Change template</Text>
                <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                  Or long-press the home screen to edit bubbles directly
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          ) : (
            <>
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
            </>
          )}
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
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="square" size={16} color={colors.accent} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Borders</Text>
            <View style={appearStyles.dots}>
              {BORDER_ORDER.map((id) => (
                <BorderDot key={id} borderId={id} selected={id === borderId} onSelect={() => setBorder(id)} />
              ))}
            </View>
          </View>
          {/* Brightness slider — no ctrlStyles.row, custom layout */}
          <View style={{ borderTopWidth: 0 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
            }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Brightness</Text>
              <Text style={[ctrlStyles.label, { color: colors.textMuted, fontSize: 12.5 }]}>
                {brightnessLabel(themeBrightness)}
              </Text>
            </View>
            <BrightnessSlider
              value={themeBrightness}
              onChange={setThemeBrightness}
              colors={colors}
            />
          </View>
        </View>

        {/* ── Stats & Insights ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Stats</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => {
              if (!unlocked.has('insights')) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Still locked', lockHint('insights'));
                return;
              }
              router.push('/insights');
            }}
          >
            <Feather name="bar-chart-2" size={16} color={unlocked.has('insights') ? colors.accent : colors.textMuted} />
            <View style={{ flex: 1, opacity: unlocked.has('insights') ? 1 : 0.5 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Insights</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {unlocked.has('insights') ? 'Triggers, patterns, peak hours' : lockHint('insights')}
              </Text>
            </View>
            <Feather name={unlocked.has('insights') ? 'chevron-right' : 'lock'} size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/weekly-recap')}
          >
            <Feather name="calendar" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Weekly Recap</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Your last 7 days at a glance</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomWidth: 0 }]}
            onPress={() => {
              if (!unlocked.has('journal')) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Still locked', lockHint('journal'));
                return;
              }
              router.push('/journal' as any);
            }}
          >
            <Feather name="book-open" size={16} color={unlocked.has('journal') ? colors.accent : colors.textMuted} />
            <View style={{ flex: 1, opacity: unlocked.has('journal') ? 1 : 0.5 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Impulse Journal</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
                {unlocked.has('journal') ? 'A private record you can write in anytime' : lockHint('journal')}
              </Text>
            </View>
            <Feather name={unlocked.has('journal') ? 'chevron-right' : 'lock'} size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Zone 6: Account ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Account</Text>

        <View style={[ctrlStyles.board, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/tutorial')}
          >
            <Feather name="map" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Interactive tour</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/tips')}
          >
            <Feather name="help-circle" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Tips & feature guide</Text>
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
            style={[ctrlStyles.row, { borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL('https://88eightsss.github.io/nogoon-legal/terms-of-service.html').catch(() => {})}
          >
            <Feather name="file-text" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Terms of service</Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </Pressable>
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.textMuted} />
            <Text style={[ctrlStyles.label, { color: colors.text, flex: 1 }]}>Version</Text>
            <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>
              {`${Constants.expoConfig?.version ?? '1.0.0'} (build ${Constants.expoConfig?.android?.versionCode ?? '?'})`}
            </Text>
          </View>
          {PROGRESSIVE_UNLOCKS && (
          <View style={[ctrlStyles.row, { borderBottomColor: colors.border }]}>
            <Feather name="unlock" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.text }]}>Unlock everything now</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Skip the walk-away milestones</Text>
            </View>
            <Switch
              value={forceUnlockAll}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setForceUnlockAll(val);
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          )}
          <Pressable
            style={[ctrlStyles.row, { borderBottomWidth: 0 }]}
            onPress={signOutConfirm}
          >
            <Feather name="log-out" size={16} color={colors.danger} />
            <Text style={[ctrlStyles.label, { color: colors.danger, flex: 1 }]}>Sign out</Text>
          </Pressable>
          <Pressable
            style={[ctrlStyles.row, { borderBottomWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => setShowDelete(true)}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[ctrlStyles.label, { color: colors.danger }]}>Delete account</Text>
              <Text style={[ctrlStyles.sub, { color: colors.textMuted }]}>Erase your account and all synced data</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete account modal */}
      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={closeDelete}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[modalStyles.overlay, { backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: SPACING.lg }]}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md }}>
            <Text style={{ color: colors.danger, fontFamily: FONTS.bodyBold, fontSize: 18 }}>Delete your account?</Text>
            <Text style={{ color: colors.textMuted, fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 }}>
              This permanently erases your account, streak, points and synced blocklist from our servers, and clears your NoGoon data on this phone. It can't be undone.
            </Text>
            <Text style={{ color: colors.text, fontFamily: FONTS.body, fontSize: 13 }}>Type DELETE to confirm.</Text>
            <TextInput
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              placeholder="DELETE"
              placeholderTextColor={colors.textMuted}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, padding: SPACING.md, color: colors.text, fontFamily: FONTS.body, fontSize: 16 }}
            />
            {deleteError && (
              <Text style={{ color: colors.danger, fontFamily: FONTS.body, fontSize: 13 }}>{deleteError}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <Pressable
                onPress={closeDelete}
                disabled={deleting}
                style={{ flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontFamily: FONTS.bodyBold, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={runDelete}
                disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'}
                style={{
                  flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md,
                  backgroundColor: colors.danger,
                  opacity: deleting || deleteText.trim().toUpperCase() !== 'DELETE' ? 0.4 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: FONTS.bodyBold, fontSize: 15 }}>{deleting ? 'Deleting…' : 'Delete forever'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showColdOff} transparent animationType="fade" onRequestClose={() => setShowColdOff(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[modalStyles.overlay, { backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: SPACING.lg }]}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md }}>
            <Text style={{ color: colors.text, fontFamily: FONTS.bodyBold, fontSize: 18 }}>Finish turning off Cold Turkey</Text>
            <Text style={{ color: colors.textMuted, fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 }}>
              Your 48 hours are up. Type the phrase below to confirm. Hard Mode stays on until you turn it off separately.
            </Text>
            <Text style={{ color: colors.text, fontFamily: FONTS.body, fontSize: 13 }}>Type {COLD_PHRASE} to confirm.</Text>
            <TextInput
              value={coldText}
              onChangeText={setColdText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={COLD_PHRASE}
              placeholderTextColor={colors.textMuted}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, padding: SPACING.md, color: colors.text, fontFamily: FONTS.body, fontSize: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <Pressable
                onPress={() => setShowColdOff(false)}
                style={{ flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontFamily: FONTS.bodyBold, fontSize: 15 }}>Keep it on</Text>
              </Pressable>
              <Pressable
                onPress={() => { confirmDisableColdTurkey(); setShowColdOff(false); }}
                disabled={coldText.trim().toUpperCase() !== COLD_PHRASE}
                style={{
                  flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md,
                  backgroundColor: colors.danger,
                  opacity: coldText.trim().toUpperCase() !== COLD_PHRASE ? 0.4 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontFamily: FONTS.bodyBold, fontSize: 15 }}>Turn it off</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

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
    <PageGuide
      page="profile"
      icon="user"
      accent={colors.me}
      title="Me"
      hint="Stats & settings"
      subtitle="Your progress, controls and look."
      points={[
        { icon: 'trending-up', title: 'Stats',           body: 'Walk-aways and time saved over time.' },
        { icon: 'sliders',     title: 'Control board',   body: 'Wind-down hours, hard mode and focus sessions.' },
        { icon: 'droplet',     title: 'Look & feel',     body: 'Pick a theme and border style.' },
      ]}
    />
    </>
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
  groupLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 2,
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
