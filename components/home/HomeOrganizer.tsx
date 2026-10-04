// ─── Home Screen — Organizer mode ────────────────────────────────────────────
//
// One of two home screen modes (the other is HomeCompanion). Fully
// customizable bubble/widget grid — for people who'd rather not have the
// pet front and center. Switched via useThemeStore.homeMode, toggled from
// the Me screen.
// Long-press anywhere to enter edit mode — swap, resize, reorder, add, remove.
// Templates available via "Change layout" in edit mode.

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, Pressable,
  TextInput, Animated, Modal, FlatList, RefreshControl,
  KeyboardAvoidingView, Platform, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey, localDateKeyDiffDays } from '@/utils/date';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePetStore } from '@/stores/usePetStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { PulseGlow } from '@/components/PulseGlow';
import { ProtectionBanner } from '@/components/ProtectionBanner';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/useThemeStore';
import { BORDERS } from '@/constants/Themes';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GoonSprite, getGoonStage, usePetPokeGate, type GoonStage } from '@/components/home/GoonMascot';
import { getPetMood, getPetSpeech } from '@/stores/usePetStore';
import { WIDGET_CATALOG, type BubbleConfig, type BubbleSize, type WidgetId } from '@/constants/HomeLayout';
import type { CharacterId } from '@/stores/usePetStore';

// Reordering/resizing/removing a bubble can shift which bubbles end up
// sharing a row with which further down the layout — rows are recomputed
// from bin-packed widths on every render, not fixed grid slots. Animating
// the transition turns "why did that other bubble also move?" into a
// visible, readable reflow instead of an abrupt jump-cut. New Architecture
// (this project has newArchEnabled) supports LayoutAnimation on Android
// without the old UIManager opt-in.
function animateLayoutChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

// ─── Milestone thresholds ─────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const MILESTONE_KEY = 'goon_last_shown_milestone';
// First-time discoverability nudge for edit mode — the only entry points are a
// plain header icon and a 500ms long-press, neither of which is obvious on a
// first visit. Shown once as a dismissible banner, then never again.
const EDIT_HINT_KEY = 'nogoon_organizer_edit_hint_seen';

// Companion celebrations at the big milestones
const COMPANION_MILESTONES = new Set([50, 100, 250, 500, 1000, 2500, 5000]);
const COMPANION_COPY: Record<number, string> = {
  50:   'Your companion is proud of you.',
  100:  '100 times you chose yourself.',
  250:  'This companion has seen you grow.',
  500:  'Halfway to a thousand. Incredible.',
  1000: 'A thousand walk-aways. Legendary.',
  2500: '2,500. You changed the habit.',
  5000: '5,000. This is who you are now.',
};

function MilestoneFlash({ count, character, stage, onDone }: {
  count: number;
  character?: CharacterId | null;
  stage?: GoonStage;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const isCompanion = COMPANION_MILESTONES.has(count) && character != null;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(isCompanion ? 3200 : 2200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDone);
  }, []);

  if (isCompanion) {
    return (
      <Pressable onPress={onDone}>
        <Animated.View style={[milestoneStyles.card, { opacity, backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <GoonSprite char={character!} stage={stage ?? 4} size={0.45} />
          <View style={{ alignItems: 'center', gap: 3 }}>
            <Text style={[milestoneStyles.cardNum, { color: colors.accent }]}>{count} walk-aways</Text>
            <Text style={[milestoneStyles.cardSub, { color: colors.textSecondary }]}>
              {COMPANION_COPY[count] ?? 'Your companion is proud.'}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onDone}>
      <Animated.View style={[milestoneStyles.wrap, { opacity, backgroundColor: colors.accentDim, borderColor: colors.cardBorder }]}>
        <Text style={[milestoneStyles.text, { color: colors.accent }]}>
          {count} walk-aways — keep going
        </Text>
      </Animated.View>
    </Pressable>
  );
}
const milestoneStyles = StyleSheet.create({
  wrap:    { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.full, borderWidth: 1, alignSelf: 'center', marginVertical: SPACING.xs },
  text:    { fontFamily: FONTS.bodyMedium, fontSize: 13, textAlign: 'center' },
  card:    { borderRadius: RADIUS.xl, borderWidth: 1, alignSelf: 'center', alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginVertical: SPACING.xs },
  cardNum: { fontFamily: FONTS.bodyBold, fontSize: 17 },
  cardSub: { fontFamily: FONTS.body, fontSize: 13, textAlign: 'center' },
});

// ─── Streak milestone flash ───────────────────────────────────────────────────
const STREAK_MILESTONES = [7, 30, 100, 365];
const STREAK_MILESTONE_KEY = 'goon_last_shown_streak_milestone';

const STREAK_MILESTONE_COPY: Record<number, string> = {
  7:   '7-day streak — one full week. You\'re doing it.',
  30:  '30 days straight. You broke the pattern.',
  100: '100-day streak. This is who you are now.',
  365: 'One full year. Legendary.',
};

function StreakMilestoneFlash({ days, onDone }: { days: number; onDone: () => void }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDone);
  }, []);
  const msg = STREAK_MILESTONE_COPY[days] ?? `${days}-day streak — incredible.`;
  return (
    <Pressable onPress={onDone}>
      <Animated.View style={[milestoneStyles.wrap, { opacity, backgroundColor: colors.accentDim, borderColor: colors.cardBorder }]}>
        <Text style={[milestoneStyles.text, { color: colors.accent }]}>{msg}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Intention card (inline) ──────────────────────────────────────────────────
const INTENTION_KEY      = 'nogoon_today_intention';
const INTENTION_DATE_KEY = 'nogoon_intention_date';

function IntentionWidget({ colors }: { colors: any }) {
  const [intention, setIntention] = useState('');
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState('');

  useEffect(() => {
    async function load() {
      const today = getLocalDateKey();
      const [saved, savedDate] = await Promise.all([
        AsyncStorage.getItem(INTENTION_KEY),
        AsyncStorage.getItem(INTENTION_DATE_KEY),
      ]);
      if (savedDate === today && saved) setIntention(saved);
    }
    load();
  }, []);

  const save = useCallback(async () => {
    const today = getLocalDateKey();
    const val = draft.trim();
    setIntention(val);
    setEditing(false);
    if (val) {
      await AsyncStorage.setItem(INTENTION_KEY, val);
      await AsyncStorage.setItem(INTENTION_DATE_KEY, today);
    }
  }, [draft]);

  if (editing) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={[iStyles.label, { color: colors.success }]}>TODAY'S INTENTION</Text>
        <TextInput
          style={[iStyles.input, { color: colors.text }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="I'm here to..."
          placeholderTextColor={colors.textMuted}
          multiline autoFocus returnKeyType="done"
          onSubmitEditing={save} blurOnSubmit onBlur={save}
        />
      </View>
    );
  }

  return (
    <Pressable style={{ flex: 1 }} onPress={() => { setDraft(intention); setEditing(true); }}>
      <View style={iStyles.headerRow}>
        <Text style={[iStyles.label, { color: colors.success }]}>TODAY'S INTENTION</Text>
        <Feather name={intention ? 'edit-2' : 'plus'} size={12} color={colors.success + '88'} />
      </View>
      {intention
        ? <Text style={[iStyles.text, { color: colors.text }]} numberOfLines={3}>{intention}</Text>
        : <Text style={[iStyles.placeholder, { color: colors.textMuted }]}>What are you choosing instead?</Text>
      }
    </Pressable>
  );
}
const iStyles = StyleSheet.create({
  label: { fontFamily: FONTS.mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  text: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19 },
  placeholder: { fontFamily: FONTS.body, fontSize: 12, fontStyle: 'italic' },
  input: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, minHeight: 48, textAlignVertical: 'top' },
});

// ─── Tool bubble (navigates on tap) ──────────────────────────────────────────
function ToolWidget({
  icon, iconColor, title, subtitle, route, colors,
}: { icon: string; iconColor: string; title: string; subtitle: string; route: any; colors: any }) {
  return (
    <Pressable style={toolStyles.wrap} onPress={() => router.push(route)}>
      <View style={[toolStyles.iconBox, { backgroundColor: iconColor + '18' }]}>
        <Feather name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={[toolStyles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[toolStyles.sub, { color: colors.textSecondary }]}>{subtitle}</Text>
    </Pressable>
  );
}
const toolStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: FONTS.bodyMedium, fontSize: 13, marginBottom: 2 },
  sub: { fontFamily: FONTS.body, fontSize: 10, lineHeight: 14 },
});

// ─── Poke speeches — shown on tap ─────────────────────────────────────────────
const POKE_SPEECHES = [
  "hey, I felt that!",
  "you came back!",
  "proud of you today.",
  "keep going!",
  "I missed you.",
  "you're doing great.",
  "one step at a time.",
  "I believe in you!",
  "we've got this.",
  "thanks for checking in.",
];

// ─── Interactive companion widget ─────────────────────────────────────────────
function CompanionWidget({
  char, stage, name, colors,
}: {
  char: CharacterId;
  stage: GoonStage;
  name: string;
  colors: any;
}) {
  const petStore = usePetStore();
  const stats = petStore.stats[char];
  const mood  = getPetMood(stats);
  const defaultSpeech = getPetSpeech(mood, name);

  const [pokeSpeech, setPokeSpeech] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokeGate = usePetPokeGate();

  const handlePoke = () => {
    // Bounce animation plays every tap; the speech bubble only updates every
    // Nth tap (shared gate with the main mascot) so it stays a treat, not noise.
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 6  }),
    ]).start();

    if (pokeGate()) {
      // Pick a random poke speech that isn't the current one
      const options = POKE_SPEECHES.filter((s) => s !== pokeSpeech);
      const next = options[Math.floor(Math.random() * options.length)];
      setPokeSpeech(next);

      // Reset speech after 3s
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
      pokeTimer.current = setTimeout(() => setPokeSpeech(null), 3000);
    }
  };

  return (
    <Pressable style={cStyles.petRow} onPress={handlePoke} hitSlop={4}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <GoonSprite char={char} stage={stage} size={0.6} />
      </Animated.View>
      <View style={cStyles.petInfo}>
        <Text style={[cStyles.petName, { color: colors.accent }]}>{name}</Text>
        <Text style={[cStyles.petSpeech, { color: colors.textSecondary }]}>
          {pokeSpeech ?? defaultSpeech}
        </Text>
        <Text style={[cStyles.petMood, { color: colors.textMuted }]}>{mood}</Text>
      </View>
    </Pressable>
  );
}

// ─── Companion Hero widget — centered, large sprite, stat bars ────────────────
function CompanionHeroWidget({
  char, stage, name, colors,
}: {
  char: CharacterId;
  stage: GoonStage;
  name: string;
  colors: any;
}) {
  const petStore = usePetStore();
  const stats = petStore.stats[char];
  const mood  = getPetMood(stats);
  const defaultSpeech = getPetSpeech(mood, name);

  const [pokeSpeech, setPokeSpeech] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokeGate = usePetPokeGate();

  const handlePoke = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, speed: 28, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 18, bounciness: 6  }),
    ]).start();
    if (pokeGate()) {
      const options = POKE_SPEECHES.filter((s) => s !== pokeSpeech);
      const next = options[Math.floor(Math.random() * options.length)];
      setPokeSpeech(next);
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
      pokeTimer.current = setTimeout(() => setPokeSpeech(null), 3000);
    }
  };

  const StatBar = ({ value, color }: { value: number; color: string }) => (
    <View style={heroStyles.barTrack}>
      <View style={[heroStyles.barFill, { width: `${Math.round(value)}%` as any, backgroundColor: color }]} />
    </View>
  );

  return (
    <Pressable onPress={handlePoke} hitSlop={4}>
      <View style={heroStyles.center}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <GoonSprite char={char} stage={stage} size={0.9} />
        </Animated.View>
        <Text style={[heroStyles.heroName, { color: colors.accent }]}>{name}</Text>
        <View style={[heroStyles.speechBubble, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[heroStyles.speechText, { color: colors.textSecondary }]}>
            {pokeSpeech ?? defaultSpeech}
          </Text>
        </View>
        <View style={heroStyles.bars}>
          <View style={heroStyles.barRow}>
            <Text style={[heroStyles.barLabel, { color: colors.textMuted }]}>mood</Text>
            <StatBar value={stats.happiness} color={colors.accent} />
          </View>
          <View style={heroStyles.barRow}>
            <Text style={[heroStyles.barLabel, { color: colors.textMuted }]}>hunger</Text>
            <StatBar value={stats.hunger} color='#e0a500' />
          </View>
          <View style={heroStyles.barRow}>
            <Text style={[heroStyles.barLabel, { color: colors.textMuted }]}>energy</Text>
            <StatBar value={stats.energy} color='#4d8bff' />
          </View>
        </View>
        <Text style={[heroStyles.moodTag, { color: colors.textMuted }]}>{mood}</Text>
      </View>
    </Pressable>
  );
}

const heroStyles = StyleSheet.create({
  center:      { alignItems: 'center', paddingVertical: SPACING.sm },
  heroName:    { fontFamily: FONTS.bodyBold, fontSize: 18, marginTop: SPACING.sm, letterSpacing: -0.3 },
  speechBubble: { marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 8,
                  borderRadius: RADIUS.lg, borderWidth: 1, maxWidth: '80%' },
  speechText:  { fontFamily: FONTS.body, fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 17 },
  bars:        { width: '80%', gap: 6, marginTop: SPACING.md },
  barRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel:    { fontFamily: FONTS.mono, fontSize: 9, width: 38, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  barTrack:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.15)' },
  barFill:     { height: 4, borderRadius: 2 },
  moodTag:     { fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SPACING.sm },
});

// ─── Widget content renderer ──────────────────────────────────────────────────
function WidgetContent({
  widgetId, colors, walkAwayCount, minutesSaved, streakFreezeTokens,
  blockingStatus, openSettings, gateCharacter, gateStage, gateCompanionName,
  streak, longestStreak, consistencyPct,
}: {
  widgetId: WidgetId;
  colors: any;
  walkAwayCount: number;
  minutesSaved: number;
  streakFreezeTokens: number;
  blockingStatus: string;
  openSettings: () => void;
  gateCharacter: CharacterId | null;
  gateStage: GoonStage;
  gateCompanionName: string;
  streak: number;
  longestStreak: number;
  consistencyPct: number;
}) {
  switch (widgetId) {
    case 'companion': {
      if (gateCharacter === null) {
        return <Text style={{ color: colors.textMuted, fontFamily: FONTS.body, fontSize: 12 }}>No companion selected</Text>;
      }
      return (
        <CompanionWidget
          char={gateCharacter}
          stage={gateStage}
          name={gateCompanionName}
          colors={colors}
        />
      );
    }

    case 'companion-hero': {
      if (gateCharacter === null) {
        return <Text style={{ color: colors.textMuted, fontFamily: FONTS.body, fontSize: 12 }}>No companion selected</Text>;
      }
      return (
        <CompanionHeroWidget
          char={gateCharacter}
          stage={gateStage}
          name={gateCompanionName}
          colors={colors}
        />
      );
    }

    case 'counter':
      return (
        <View>
          <Text style={[cStyles.tag, { color: colors.accent + 'AA' }]}>WALK-AWAYS</Text>
          <Text style={[cStyles.bigNum, { color: colors.accent }]}>{walkAwayCount.toLocaleString()}</Text>
          {minutesSaved > 0 && (
            <Text style={[cStyles.sub, { color: colors.textMuted }]}>
              {minutesSaved >= 60
                ? `~${Math.round(minutesSaved / 60)} hrs reclaimed`
                : `~${minutesSaved} min reclaimed`}
            </Text>
          )}
        </View>
      );

    case 'streak':
      return (
        <View>
          <Text style={[cStyles.tag, { color: '#0ea5e9AA' }]}>CONSISTENCY</Text>
          <Text style={[cStyles.medNum, { color: '#0ea5e9' }]}>{consistencyPct}%</Text>
          {streakFreezeTokens > 0 && (
            <View style={cStyles.freezeRow}>
              <Feather name="wind" size={10} color="#a5b4fc" />
              <Text style={[cStyles.freezeTxt, { color: '#a5b4fc' }]}>{streakFreezeTokens}× freeze</Text>
            </View>
          )}
        </View>
      );

    case 'time-saved': {
      const mins = minutesSaved;
      const display = mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`
        : `${mins}m`;
      return (
        <View>
          <Text style={[cStyles.tag, { color: '#0277BDAA' }]}>TIME SAVED</Text>
          <Text style={[cStyles.medNum, { color: '#0277BD' }]}>{display || '0m'}</Text>
        </View>
      );
    }

    case 'bill': {
      const costDollars = Math.round((walkAwayCount * 20 / 60) * 22);
      return (
        <View>
          <Text style={[cStyles.tag, { color: '#e0a500AA' }]}>THE BILL</Text>
          <Text style={[cStyles.medNum, { color: '#e0a500' }]}>${costDollars}</Text>
          <Text style={[cStyles.sub, { color: colors.textMuted }]}>at $22/hr avg</Text>
        </View>
      );
    }

    case 'intention':
      return <IntentionWidget colors={colors} />;

    case 'breathe':
      return (
        <ToolWidget
          icon="wind" iconColor="#4d8bff"
          title="Breathe" subtitle="Box breathing · 2 min"
          route="/breathe" colors={colors}
        />
      );

    case 'games':
      return (
        <ToolWidget
          icon="zap" iconColor="#6D28D9"
          title="Games" subtitle="Redirect the urge"
          route={{ pathname: '/(tabs)/arcade', params: { category: 'calm' } }} colors={colors}
        />
      );

    case 'waitingroom':
      return (
        <ToolWidget
          icon="clock" iconColor="#0277BD"
          title="Waiting Room" subtitle="Sit with the urge"
          route="/waiting-room" colors={colors}
        />
      );

    case 'bubbles-tool':
      return (
        <ToolWidget
          icon="feather" iconColor="#0ea5e9"
          title="Brain Bubbles" subtitle="Get the noise out"
          route="/bubbles" colors={colors}
        />
      );

    case 'milestones': {
      const earned = MILESTONE_THRESHOLDS.filter((m) => walkAwayCount >= m).length;
      return (
        <Pressable onPress={() => router.push('/milestones' as any)}>
          <Text style={[cStyles.tag, { color: '#D97706AA' }]}>MILESTONES</Text>
          <Text style={[cStyles.medNum, { color: '#D97706' }]}>
            {earned}/{MILESTONE_THRESHOLDS.length}
          </Text>
          <Text style={[cStyles.sub, { color: colors.textMuted }]}>
            {streak > 0 ? `${streak}-day streak` : longestStreak > 0 ? `best: ${longestStreak}-day streak` : 'badges earned'}
          </Text>
        </Pressable>
      );
    }

    case 'shield':
      if (blockingStatus === 'active') {
        return (
          <View style={cStyles.shieldRow}>
            <Feather name="shield" size={20} color={colors.success} />
            <View>
              <Text style={[cStyles.shieldTitle, { color: colors.success }]}>Blocking active</Text>
              <Text style={[cStyles.sub, { color: colors.textMuted }]}>You're protected</Text>
            </View>
          </View>
        );
      }
      return (
        <PulseGlow active color={colors.danger} radius={RADIUS.sm} style={{ padding: 6, margin: -6 }}>
          <Pressable style={cStyles.shieldRow} onPress={openSettings}>
            <Feather name="alert-circle" size={20} color={colors.danger} />
            <View>
              <Text style={[cStyles.shieldTitle, { color: colors.danger }]}>Blocking off</Text>
              <Text style={[cStyles.sub, { color: colors.textMuted }]}>Tap to fix</Text>
            </View>
          </Pressable>
        </PulseGlow>
      );

    default:
      return null;
  }
}

const cStyles = StyleSheet.create({
  tag:    { fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  bigNum: { fontFamily: FONTS.display, fontSize: 44, letterSpacing: -1.5, lineHeight: 50 },
  medNum: { fontFamily: FONTS.display, fontSize: 30, letterSpacing: -1, lineHeight: 36 },
  bigLabel: { fontFamily: FONTS.body, fontSize: 11, marginTop: 2 },
  sub: { fontFamily: FONTS.body, fontSize: 10, marginTop: 3 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  petInfo: { flex: 1, gap: 3 },
  petName: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  petSpeech: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  petMood: { fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  freezeTxt: { fontFamily: FONTS.bodyMedium, fontSize: 10 },
  shieldRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  shieldTitle: { fontFamily: FONTS.bodyBold, fontSize: 13, marginBottom: 2 },
});

// ─── Widget color accent lookup ───────────────────────────────────────────────
// Same thresholds as app/milestones.tsx and the home-screen mascot milestone flash.
const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

const WIDGET_ACCENT: Record<WidgetId, string> = {
  companion:    '#7c6aed',
  counter:      '#7c6aed',
  streak:       '#0ea5e9',
  'time-saved': '#0277BD',
  bill:         '#e0a500',
  intention:    '#2E7D32',
  breathe:      '#4d8bff',
  games:        '#6D28D9',
  waitingroom:  '#0277BD',
  'bubbles-tool': '#0ea5e9',
  shield:       '#4caf50',
  'companion-hero': '#7c6aed',
  milestones:       '#D97706',
  spacer:           '#888888',
};

// Fraction of row width each size occupies
const SIZE_FRAC: Record<BubbleSize, number> = { small: 1 / 3, half: 1 / 2, full: 1 };
const SIZE_PCT = { small: '33.33%', half: '50%', full: '100%' } as const;

// Cycle through sizes on resize: small → half → full → small
function nextSize(size: BubbleSize): BubbleSize {
  if (size === 'small') return 'half';
  if (size === 'half')  return 'full';
  return 'small';
}

// Resize icon by current size
function resizeIcon(size: BubbleSize): 'minimize-2' | 'maximize-2' | 'square' {
  if (size === 'full')  return 'minimize-2';
  if (size === 'half')  return 'maximize-2';
  return 'square'; // small → hint it can grow
}

// ─── Single bubble ─────────────────────────────────────────────────────────────
function Bubble({
  config, editMode, isFirst, isLast,
  onRemove, onResize, onMoveUp, onMoveDown, onSwap,
  colors, borderRadius, borderWidth, borderStyleOverride,
  contentProps,
}: {
  config: BubbleConfig;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onResize: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSwap: () => void;
  colors: any;
  borderRadius: number;
  borderWidth: number;
  borderStyleOverride?: 'dashed' | 'dotted';
  contentProps: any;
}) {
  const accent = WIDGET_ACCENT[config.widgetId] ?? colors.accent;
  const isSpacer = config.widgetId === 'spacer';

  // Spacer at runtime — invisible, just occupies space
  if (isSpacer && !editMode) return <View style={{ flex: 1 }} />;

  // Spacer in edit mode — dashed outline placeholder
  if (isSpacer && editMode) {
    return (
      <View style={[bubStyles.bubble, { borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius, backgroundColor: 'transparent', minHeight: 60 }]}>
        <View style={bubStyles.editOverlay}>
          <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onResize}>
            <Feather name={resizeIcon(config.size)} size={12} color={colors.textSecondary} />
          </Pressable>
          {!isFirst && (
            <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMoveUp}>
              <Feather name="arrow-up" size={12} color={colors.textSecondary} />
            </Pressable>
          )}
          {!isLast && (
            <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMoveDown}>
              <Feather name="arrow-down" size={12} color={colors.textSecondary} />
            </Pressable>
          )}
          <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.dangerDim, borderColor: colors.danger + '44' }]} onPress={onRemove}>
            <Feather name="x" size={12} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        bubStyles.bubble,
        {
          backgroundColor: accent + '0D',
          borderColor: accent + '38',
          borderWidth,
          borderRadius,
          ...(borderStyleOverride && { borderStyle: borderStyleOverride }),
        },
      ]}
    >
      <WidgetContent widgetId={config.widgetId} colors={colors} {...contentProps} />

      {editMode && (
        <View style={bubStyles.editOverlay}>
          {/* Swap widget */}
          <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onSwap}>
            <Feather name="refresh-cw" size={12} color={colors.textSecondary} />
          </Pressable>
          {/* Size cycle: small → half → full → small */}
          <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onResize}>
            <Feather name={resizeIcon(config.size)} size={12} color={colors.textSecondary} />
          </Pressable>
          {/* Move up */}
          {!isFirst && (
            <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMoveUp}>
              <Feather name="arrow-up" size={12} color={colors.textSecondary} />
            </Pressable>
          )}
          {/* Move down */}
          {!isLast && (
            <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMoveDown}>
              <Feather name="arrow-down" size={12} color={colors.textSecondary} />
            </Pressable>
          )}
          {/* Remove */}
          <Pressable style={[bubStyles.editBtn, { backgroundColor: colors.dangerDim, borderColor: colors.danger + '44' }]} onPress={onRemove}>
            <Feather name="x" size={12} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const bubStyles = StyleSheet.create({
  bubble: {
    padding: SPACING.lg,
    minHeight: 100,
    justifyContent: 'center',
    flex: 1,
  },
  editOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  editBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Widget picker modal ──────────────────────────────────────────────────────
function WidgetPicker({ visible, onClose, onSelect, colors }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: WidgetId) => void;
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[pickerStyles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[pickerStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={pickerStyles.header}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>Choose widget</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <FlatList
            data={WIDGET_CATALOG}
            keyExtractor={(w) => w.id}
            style={{ maxHeight: 400 }}
            renderItem={({ item: w }) => (
              <Pressable
                style={[pickerStyles.row, { borderBottomColor: colors.border }]}
                onPress={() => { onSelect(w.id); onClose(); }}
              >
                <View style={[pickerStyles.dot, { backgroundColor: w.color + '22', borderColor: w.color + '44' }]}>
                  <View style={[pickerStyles.dotInner, { backgroundColor: w.color }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[pickerStyles.label, { color: colors.text }]}>{w.label}</Text>
                  <Text style={[pickerStyles.desc, { color: colors.textMuted }]}>{w.desc}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: SPACING.xl },
  sheet: { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, paddingBottom: SPACING.md },
  title: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md, borderBottomWidth: 0.5 },
  dot: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 14, marginBottom: 2 },
  desc: { fontFamily: FONTS.body, fontSize: 11 },
});

// ─── Home screen ──────────────────────────────────────────────────────────────
export function HomeOrganizer() {
  const { session } = useAuthStore();
  const { name, walkAwayCount, streak, longestStreak, streakFreezeTokens = 0, dailyWalkAways, loadFromSupabase } = useUserStore();
  const minutesSaved = getMinutesSaved(walkAwayCount);
  const { blockingStatus, openSettings } = useAppBlocker();
  const { colors } = useTheme();
  const {
    homeLayout, updateBubble, addBubble, removeBubble, moveBubble, borderId,
  } = useThemeStore();

  const borderConfig   = BORDERS[borderId];
  const bubbleBorderW  = Math.max(borderConfig.width ?? 1, 0.5);
  const bubbleBorderSt = borderConfig.lineStyle; // 'dashed' | 'dotted' | undefined (solid)
  // Square-cornered styles (radius:0, i.e. Sharp) still get a soft nub of
  // rounding on the small organizer bubble tiles -- literal square corners
  // read badly at that size -- everything else keeps its own distinct radius.
  const bubbleBorderR  = borderConfig.radius === 0 ? RADIUS.lg : borderConfig.radius;

  const [editMode,      setEditMode]      = useState(false);
  const [swappingId,    setSwappingId]    = useState<string | null>(null);
  const [showMilestone,       setShowMilestone]       = useState<number | null>(null);
  const [showStreakMilestone, setShowStreakMilestone] = useState<number | null>(null);
  const [dayCount,      setDayCount]      = useState(1);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showEditHint,  setShowEditHint]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(EDIT_HINT_KEY).then((seen) => {
      if (seen !== 'true') setShowEditHint(true);
    });
  }, []);

  const dismissEditHint = useCallback(() => {
    setShowEditHint(false);
    AsyncStorage.setItem(EDIT_HINT_KEY, 'true');
  }, []);

  const enterEditMode = useCallback(() => {
    animateLayoutChange();
    setEditMode(true);
    setShowEditHint((seen) => {
      if (seen) AsyncStorage.setItem(EDIT_HINT_KEY, 'true');
      return false;
    });
  }, []);

  // Companion async state
  const [gateCharacter, setGateCharacter] = useState<CharacterId | null>(null);
  const [gateCompanionName, setGateCompanionName] = useState('Buddy');
  const gateStage = getGoonStage(walkAwayCount);

  useEffect(() => {
    async function loadCompanion() {
      const stored = await AsyncStorage.getItem('@nogoon_goon_character');
      if (stored !== null) {
        const id = parseInt(stored, 10) as CharacterId;
        setGateCharacter(id);
        const nameStored = await AsyncStorage.getItem(`@nogoon_pet_name_${id}`);
        if (nameStored) setGateCompanionName(nameStored);
      }
    }
    loadCompanion();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadFromSupabase(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    async function checkMilestone() {
      const lastShown = parseInt((await AsyncStorage.getItem(MILESTONE_KEY)) ?? '0', 10);
      const next = MILESTONES.find((m) => m > lastShown && walkAwayCount >= m);
      if (next) {
        setShowMilestone(next);
        await AsyncStorage.setItem(MILESTONE_KEY, String(next));
      }
    }
    if (walkAwayCount > 0) checkMilestone();
  }, [walkAwayCount]);

  useEffect(() => {
    async function checkStreakMilestone() {
      const lastShown = parseInt((await AsyncStorage.getItem(STREAK_MILESTONE_KEY)) ?? '0', 10);
      const next = STREAK_MILESTONES.find((m) => m > lastShown && streak >= m);
      if (next) {
        setShowStreakMilestone(next);
        await AsyncStorage.setItem(STREAK_MILESTONE_KEY, String(next));
      }
    }
    if (streak > 0) checkStreakMilestone();
  }, [streak]);

  useEffect(() => {
    async function computeDay() {
      const startDate = await AsyncStorage.getItem('nogoon_start_date');
      if (!startDate) {
        await AsyncStorage.setItem('nogoon_start_date', getLocalDateKey());
        setDayCount(1);
      } else {
        // Local calendar-day diff — see utils/date.ts for why not ms math
        // against new Date(startDate), which parses that string as UTC.
        const days = localDateKeyDiffDays(getLocalDateKey(), startDate) + 1;
        setDayCount(days);
      }
    }
    computeDay();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (session?.user?.id) await loadFromSupabase(session.user.id);
    setRefreshing(false);
  };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Hey' : 'Evening';

  // 30-day (or since-start, if the account is younger than that) consistency
  // score — % of days with at least one walk-away. Mirrors weekly-recap.tsx's
  // definition, just over a longer rolling window; previously this widget
  // showed a hardcoded 78% regardless of the user's real data.
  const consistencyPct = (() => {
    const windowDays = Math.min(dayCount, 30);
    if (windowDays <= 0) return 0;
    let activeDays = 0;
    for (let i = 0; i < windowDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      if ((dailyWalkAways[key] ?? 0) > 0) activeDays++;
    }
    return Math.round((activeDays / windowDays) * 100);
  })();

  const contentProps = {
    walkAwayCount,
    minutesSaved,
    streakFreezeTokens,
    blockingStatus,
    openSettings,
    gateCharacter,
    gateStage,
    gateCompanionName,
    streak,
    longestStreak,
    consistencyPct,
  };

  // Build display rows using bin-packing: small=1/3, half=1/2, full=1
  const bubbles = homeLayout?.bubbles ?? [];

  const rows: BubbleConfig[][] = [];
  let row: BubbleConfig[] = [];
  let used = 0;
  for (const b of bubbles) {
    const frac = SIZE_FRAC[b.size] ?? 0.5;
    if (used + frac > 1 + 0.001) {
      if (row.length > 0) rows.push(row);
      row = [b];
      used = frac;
    } else {
      row.push(b);
      used += frac;
    }
  }
  if (row.length > 0) rows.push(row);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {greeting}{name ? `, ${name}` : ''}
            </Text>
            <Text style={[styles.dayCount, { color: colors.textMuted }]}>Day {dayCount} with NoGoon</Text>
          </View>
          <View style={styles.headerRight}>
            {editMode ? (
              <Pressable
                style={[styles.editDoneBtn, { backgroundColor: colors.accent }]}
                onPress={() => { animateLayoutChange(); setEditMode(false); }}
              >
                <Text style={styles.editDoneTxt}>Done</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.helpBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                onPress={enterEditMode}
                hitSlop={8}
              >
                <Feather name="layout" size={17} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* First-time nudge — points at the two ways into edit mode, shown once */}
        {!editMode && showEditHint && bubbles.length > 0 && (
          <View style={[styles.editHintBanner, { backgroundColor: colors.accentDim, borderColor: colors.accent + '33' }]}>
            <Pressable style={styles.editHintMain} onPress={enterEditMode}>
              <Feather name="layout" size={16} color={colors.accent} />
              <Text style={[styles.editHintText, { color: colors.text }]}>
                Tap here, or long-press anywhere, to customize your bubbles
              </Text>
            </Pressable>
            <Pressable hitSlop={10} onPress={dismissEditHint}>
              <Feather name="x" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Battery-exemption warning — this layout has no other blocking-status indicator */}
        <ProtectionBanner />

        {/* Edit mode hint */}
        {editMode && (
          <View style={styles.editBar}>
            <Pressable onPress={() => router.push('/layout-picker' as any)} style={[styles.layoutBtn, { borderColor: colors.border }]}>
              <Feather name="layout" size={13} color={colors.textSecondary} />
              <Text style={[styles.layoutBtnTxt, { color: colors.textSecondary }]}>Change template</Text>
            </Pressable>
            <Pressable
              onPress={() => setSwappingId('__add__')}
              style={[styles.layoutBtn, { borderColor: colors.border }]}
            >
              <Feather name="plus" size={13} color={colors.textSecondary} />
              <Text style={[styles.layoutBtnTxt, { color: colors.textSecondary }]}>Add bubble</Text>
            </Pressable>
          </View>
        )}

        {showMilestone && (
          <MilestoneFlash
            count={showMilestone}
            character={gateCharacter}
            stage={gateStage}
            onDone={() => setShowMilestone(null)}
          />
        )}
        {showStreakMilestone && !showMilestone && (
          <StreakMilestoneFlash days={showStreakMilestone} onDone={() => setShowStreakMilestone(null)} />
        )}

        {/* Empty state */}
        {bubbles.length === 0 && !editMode && (
          <View style={[styles.emptyState, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
            <Feather name="layout" size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your home is empty</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Tap the layout icon above to add bubbles, or pick a template to get started.
            </Text>
          </View>
        )}

        {/* Bubble grid — long press anywhere to enter edit mode */}
        <Pressable
          onLongPress={() => { if (!editMode) enterEditMode(); }}
          delayLongPress={500}
          style={styles.grid}
        >
          {rows.map((rowBubbles, ri) => (
            <View key={ri} style={rowBubbles.length > 1 ? styles.row : undefined}>
              {rowBubbles.map((b) => (
                <View key={b.id} style={{ width: SIZE_PCT[b.size] }}>
                  <Bubble
                    config={b}
                    editMode={editMode}
                    isFirst={bubbles.indexOf(b) === 0}
                    isLast={bubbles.indexOf(b) === bubbles.length - 1}
                    onRemove={() => { animateLayoutChange(); removeBubble(b.id); }}
                    onResize={() => { animateLayoutChange(); updateBubble(b.id, { size: nextSize(b.size) }); }}
                    onMoveUp={() => { animateLayoutChange(); moveBubble(b.id, 'up'); }}
                    onMoveDown={() => { animateLayoutChange(); moveBubble(b.id, 'down'); }}
                    onSwap={() => setSwappingId(b.id)}
                    colors={colors}
                    borderRadius={bubbleBorderR}
                    borderWidth={bubbleBorderW}
                    borderStyleOverride={bubbleBorderSt}
                    contentProps={contentProps}
                  />
                </View>
              ))}
            </View>
          ))}
        </Pressable>

        {/* Long-press hint when not editing */}
        {!editMode && bubbles.length > 0 && (
          <Text style={[styles.hint, { color: colors.textMuted }]}>hold screen to edit layout</Text>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Widget swap/add picker */}
      <WidgetPicker
        visible={swappingId !== null}
        onClose={() => setSwappingId(null)}
        onSelect={(widgetId) => {
          animateLayoutChange();
          if (swappingId === '__add__') {
            addBubble(widgetId);
          } else if (swappingId) {
            const meta = WIDGET_CATALOG.find((w) => w.id === widgetId);
            // Reset size to widget's default when swapping to spacer,
            // so a full-width spacer doesn't silently blank the screen
            const changes: Partial<Pick<BubbleConfig, 'widgetId' | 'size'>> =
              widgetId === 'spacer' && meta
                ? { widgetId, size: meta.defaultSize }
                : { widgetId };
            updateBubble(swappingId, changes);
          }
          setSwappingId(null);
        }}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  greeting: { fontFamily: FONTS.bodyBold, fontSize: 20, letterSpacing: -0.3 },
  dayCount: { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  helpBtn: { width: 34, height: 34, borderRadius: RADIUS.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editDoneBtn: { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1 },
  editDoneTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' },

  editBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  layoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 0.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  layoutBtnTxt: { fontFamily: FONTS.bodyMedium, fontSize: 12 },

  grid: { gap: SPACING.md },
  row:  { flexDirection: 'row', gap: SPACING.md },

  hint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },

  editHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  editHintMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  editHintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    borderStyle: 'dashed',
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  emptyTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    marginTop: SPACING.xs,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
