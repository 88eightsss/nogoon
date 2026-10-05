// ─── Home Screen — Companion mode ────────────────────────────────────────────
//
// One of two home screen modes (the other is HomeOrganizer). This is the
// default: mascot front and center, walk-away count, milestone flash.
// Switched via useThemeStore.homeMode, toggled from the Me screen.
//
// Layout (top to bottom):
//   1. Header    — greeting + day count + help icon
//   2. Shield    — blocking status (top so it's never missed)
//   3. Goon      — character + cumulative walk-away number + milestone flash
//   4. Struggle  — "Having a hard day?" (small, optional)
//   5. Intention — today's entry

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, Pressable,
  TextInput, Animated, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateKey, localDateKeyDiffDays } from '@/utils/date';
import * as Haptics from 'expo-haptics';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { describeBlockingStatus, type BlockingStatus } from '@/utils/blockingStatus';
import { PulseGlow } from '@/components/PulseGlow';
import { ProtectionBanner } from '@/components/ProtectionBanner';
import { useTheme } from '@/hooks/useTheme';
import { readableOn } from '@/utils/colorLuminance';
import { useThemeStore } from '@/stores/useThemeStore';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GoonMascot, CHAR_COLORS, getGoonStage, STORAGE_KEY as MASCOT_STORAGE_KEY } from '@/components/home/GoonMascot';
import { useUnlockedFeatures, lockHint, type FeatureId } from '@/stores/useProgressStore';

// ─── Milestone thresholds ─────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const MILESTONE_KEY = 'goon_last_shown_milestone';
const WHATNOW_NUDGE_KEY = 'nogoon_whatnow_nudge_shown';

// ─── Milestone flash ──────────────────────────────────────────────────────────

function MilestoneFlash({ count, onDone }: { count: number; onDone: () => void }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View style={[milestoneStyles.wrap, { opacity, backgroundColor: colors.accentDim, borderColor: colors.cardBorder }]}>
      <Text style={[milestoneStyles.text, { color: colors.accent }]}>
        {count} walk-aways — keep going
      </Text>
    </Animated.View>
  );
}

const milestoneStyles = StyleSheet.create({
  wrap: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'center',
    marginTop: SPACING.xs,
  },
  text: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },
});

// ─── Intention card ───────────────────────────────────────────────────────────


function IntentionCard() {
  const { colors, cardStyle } = useTheme();
  // Single source of truth is the user store (the gate reads it too). It used to live
  // only in AsyncStorage, so the "Today you wanted to…" line on the gate never appeared.
  const storeIntention    = useUserStore((s) => s.dailyIntention);
  const intentionDate     = useUserStore((s) => s.intentionDate);
  const setDailyIntention = useUserStore((s) => s.setDailyIntention);
  const intention = intentionDate === getLocalDateKey() ? storeIntention : '';
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const save = useCallback(() => {
    setDailyIntention(draft.trim());   // an empty draft clears it
    setEditing(false);
  }, [draft, setDailyIntention]);

  const startEdit = () => {
    setDraft(intention);
    setEditing(true);
  };

  if (editing) {
    return (
      <View style={[intentionStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[intentionStyles.label, { color: colors.textMuted }]}>What are you choosing instead?</Text>
        <TextInput
          style={[intentionStyles.input, { color: colors.text }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="I'm here to..."
          placeholderTextColor={colors.textMuted}
          multiline
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          blurOnSubmit
          onBlur={save}
        />
      </View>
    );
  }

  return (
    <Pressable
      style={[intentionStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        startEdit();
      }}
    >
      <View style={intentionStyles.headerRow}>
        <Text style={[intentionStyles.label, { color: colors.textMuted }]}>Today's intention</Text>
        <Feather name={intention ? 'edit-2' : 'plus'} size={14} color={colors.textMuted} />
      </View>
      {intention ? (
        <Text style={[intentionStyles.text, { color: colors.text }]} numberOfLines={3}>
          {intention}
        </Text>
      ) : (
        <Text style={[intentionStyles.placeholder, { color: colors.textMuted }]}>
          What are you choosing instead?
        </Text>
      )}
    </Pressable>
  );
}

const intentionStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  text: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },
  placeholder: {
    fontFamily: FONTS.body,
    fontSize: 14,
    fontStyle: 'italic',
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});

// ─── Shield status strip ──────────────────────────────────────────────────────

function ShieldStrip({ status, onFix }: { status: BlockingStatus; onFix: () => void }) {
  const { colors } = useTheme();
  const view = describeBlockingStatus(status, colors);
  if (!view.visible) return null;
  // Only a genuinely-off service is tappable and pulsing; paused / empty are
  // calm informational states (see utils/blockingStatus.ts).
  const strip = (
    <View style={[stripStyles.wrap, { backgroundColor: view.dim }]}>
      <Feather name={view.icon} size={14} color={view.color} />
      <Text style={[stripStyles.text, { color: view.color }]}>{view.label}</Text>
    </View>
  );
  if (!view.alarm) return strip;
  return (
    <PulseGlow active color={view.color} radius={RADIUS.sm} style={{ alignSelf: 'flex-start' }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onFix();
        }}
      >
        {strip}
      </Pressable>
    </PulseGlow>
  );
}

const stripStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
});

// ─── Companion suggestion sheet ────────────────────────────────────────────────
//
// Tap the mascot to get 2-3 relevant things to do next, instead of hunting
// through tabs. Leads with any feature that just unlocked, then fills in
// with whatever's actually available right now.

type Suggestion = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  sub: string;
  isNew?: boolean;
  onPress: () => void;
};

function routeForFeature(id: FeatureId): string {
  switch (id) {
    case 'fullArcade':    return '/(tabs)/arcade';
    case 'insights':      return '/insights';
    case 'journal':       return '/journal';
    case 'organizerMode': return '/(tabs)/profile';
  }
}

function CompanionSheet({
  onClose, walkAwayCount,
}: {
  onClose: () => void;
  walkAwayCount: number;
}) {
  const { colors, cardStyle } = useTheme();
  const { unlocked, newlyUnlocked, markSeen } = useUnlockedFeatures();

  const go = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.push(route as any);
  };

  const suggestions: Suggestion[] = [];

  // Lead with anything that just crossed its unlock threshold.
  for (const rule of newlyUnlocked) {
    suggestions.push({
      key: `new-${rule.id}`,
      icon: 'star',
      title: `${rule.label} unlocked!`,
      sub: 'Tap to check it out',
      isNew: true,
      onPress: () => { markSeen(rule.id); go(routeForFeature(rule.id)); },
    });
  }

  // Fill remaining slots with whatever's genuinely available right now.
  if (unlocked.has('fullArcade')) {
    suggestions.push({
      key: 'arcade', icon: 'zap', title: 'Take a breather',
      sub: 'Play something in the Arcade', onPress: () => go('/(tabs)/arcade'),
    });
  }
  if (unlocked.has('insights')) {
    suggestions.push({
      key: 'insights', icon: 'bar-chart-2', title: 'See your patterns',
      sub: 'Triggers, peak hours, streaks', onPress: () => go('/insights'),
    });
  }
  if (unlocked.has('journal')) {
    suggestions.push({
      key: 'journal', icon: 'book-open', title: 'Revisit your journal',
      sub: 'What you wrote during intercepts', onPress: () => go('/journal'),
    });
  }
  // Calm tools aren't gated behind a walk-away threshold like the rest of
  // these — always offer them, so a genuine day-one user (0 walk-aways,
  // nothing else unlocked yet) still gets more than a single suggestion here.
  suggestions.push({
    key: 'calm', icon: 'wind', title: 'Try a calming tool',
    sub: 'Breathing, grounding, brain dump', onPress: () => go('/(tabs)/calm'),
  });
  suggestions.push({
    key: 'me', icon: 'user', title: 'Rename your companion',
    sub: 'Or tweak theme and layout', onPress: () => go('/(tabs)/profile'),
  });

  const shown = suggestions.slice(0, 3);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable
          style={[sheetStyles.sheet, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          onPress={() => {}}
        >
          <Text style={[sheetStyles.heading, { color: colors.text }]}>
            {walkAwayCount > 0 ? `${walkAwayCount.toLocaleString()} walk-aways strong` : 'Just getting started'}
          </Text>
          {shown.map((s) => (
            <Pressable
              key={s.key}
              style={[sheetStyles.row, { borderColor: colors.border }]}
              onPress={s.onPress}
            >
              <Feather name={s.icon} size={18} color={s.isNew ? colors.accent : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[sheetStyles.rowTitle, { color: colors.text }]}>{s.title}</Text>
                <Text style={[sheetStyles.rowSub, { color: colors.textMuted }]}>{s.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
          <Pressable style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={[sheetStyles.closeText, { color: colors.textMuted }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  heading: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  rowTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
  rowSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    alignSelf: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  closeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
});

// ─── Quick-access row ──────────────────────────────────────────────────────────
//
// A compact row of shortcuts for people who'd rather tap straight to a
// screen than open the "What now?" sheet. Same unlock gating as
// everywhere else — locked items show a lock badge and explain what's
// needed instead of silently doing nothing.

function QuickAccessRow() {
  const { colors, cardStyle } = useTheme();
  const { unlocked } = useUnlockedFeatures();
  const { setHomeMode } = useThemeStore();

  const items: {
    key: string;
    icon: keyof typeof Feather.glyphMap;
    label: string;
    featureId?: FeatureId;
    onPress: () => void;
  }[] = [
    { key: 'insights',   icon: 'bar-chart-2', label: 'Insights',   featureId: 'insights',
      onPress: () => router.push('/insights' as any) },
    { key: 'journal',    icon: 'book-open',   label: 'Journal',    featureId: 'journal',
      onPress: () => router.push('/journal' as any) },
    { key: 'organizer',  icon: 'grid',        label: 'Organizer',  featureId: 'organizerMode',
      onPress: () => setHomeMode('organizer') },
    // Always available — personal progress, not gated like the deeper features above.
    { key: 'milestones', icon: 'award',       label: 'Milestones',
      onPress: () => router.push('/milestones' as any) },
  ];

  return (
    <View style={[quickAccessStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      {items.map((item) => {
        const isUnlocked = !item.featureId || unlocked.has(item.featureId);
        return (
          <Pressable
            key={item.key}
            style={quickAccessStyles.item}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!isUnlocked && item.featureId) {
                Alert.alert('Still locked', lockHint(item.featureId));
                return;
              }
              item.onPress();
            }}
          >
            <View
              style={[
                quickAccessStyles.iconWrap,
                { backgroundColor: isUnlocked ? colors.accentDim : colors.surfaceHigh },
              ]}
            >
              <Feather
                name={isUnlocked ? item.icon : 'lock'}
                size={16}
                color={isUnlocked ? colors.accent : colors.textMuted}
              />
            </View>
            <Text style={[quickAccessStyles.label, { color: isUnlocked ? colors.textSecondary : colors.textMuted }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const quickAccessStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
  },
});

// ─── Home screen ──────────────────────────────────────────────────────────────

export function HomeCompanion() {
  const { name, walkAwayCount, streakFreezeTokens = 0, requestGuideReopen } = useUserStore();
  const minutesSaved = getMinutesSaved(walkAwayCount);
  const { showIntentionCard, showStruggleToggle, showTimeReclaimed } = useThemeStore();
  const { blockingStatus, openSettings } = useAppBlocker();
  const { colors, struggling, setStruggling } = useTheme();
  const { newlyUnlocked } = useUnlockedFeatures();

  const [showMilestone, setShowMilestone] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  // (Cloud data is pulled once per launch by the root layout, before the streak check.)

  // Check milestone
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

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Hey' : 'Evening';

  // Day count since onboarding (stored in AsyncStorage on first launch)
  const [dayCount, setDayCount] = useState<number>(1);
  useEffect(() => {
    async function computeDay() {
      const startDate = await AsyncStorage.getItem('nogoon_start_date');
      if (!startDate) {
        const today = getLocalDateKey();
        await AsyncStorage.setItem('nogoon_start_date', today);
        setDayCount(1);
      } else {
        // Local calendar-day diff — see utils/date.ts.
        const days = localDateKeyDiffDays(getLocalDateKey(), startDate) + 1;
        setDayCount(days);
      }
    }
    computeDay();
  }, []);

  // ── "What now?" glow — tinted a little with the current companion's color ──
  const [mascotColor, setMascotColor] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(MASCOT_STORAGE_KEY).then((v) => {
      const charId = (v !== null ? Number(v) : 0) as 0 | 1 | 2;
      const stage = getGoonStage(walkAwayCount);
      setMascotColor(CHAR_COLORS[charId][stage][1]);
    });
  }, [walkAwayCount]);

  const glowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowPulse]);

  // ── One-time "try this next" nudge toward What Now, shown right after the
  //    interactive tutorial finishes (see app/(tabs)/index.tsx) ──
  const hasSeenTutorial = useUserStore((s) => s.hasSeenTutorial);
  const [showWhatNowNudge, setShowWhatNowNudge] = useState(false);
  useEffect(() => {
    if (!hasSeenTutorial) return;
    AsyncStorage.getItem(WHATNOW_NUDGE_KEY).then((seen) => {
      if (seen) return;
      setShowWhatNowNudge(true);
      AsyncStorage.setItem(WHATNOW_NUDGE_KEY, 'true');
      setTimeout(() => setShowWhatNowNudge(false), 5000);
    });
  }, [hasSeenTutorial]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {greeting}{name ? `, ${name}` : ''}
            </Text>
            <Text style={[styles.dayCount, { color: colors.textMuted }]}>
              Day {dayCount} with NoGoon
            </Text>
          </View>
          <Pressable
            style={[styles.helpBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              requestGuideReopen('home');
            }}
            hitSlop={8}
          >
            <Feather name="help-circle" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Shield status strip — top so blocking state is never missed ── */}
        <ShieldStrip status={blockingStatus} onFix={openSettings} />

        {/* ── Battery-exemption warning — catches the state the strip above can't see ── */}
        <ProtectionBanner />

        {/* ── Goon character zone ── */}
        <View style={styles.goonZone}>
          <GoonMascot
            walkAwayCount={walkAwayCount}
            onPress={() => {
              if (newlyUnlocked.length > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSheet(true);
              }
            }}
          />

          <Text style={[styles.walkAwayNum, { color: colors.accent }]}>
            {walkAwayCount.toLocaleString()}
          </Text>
          <Text style={[styles.walkAwayLabel, { color: colors.textSecondary }]}>
            times you walked away
          </Text>

          <View style={styles.suggestWrap}>
            {showWhatNowNudge && (
              <View style={[styles.nudgeBubble, { backgroundColor: colors.text }]}>
                <Text style={[styles.nudgeText, { color: colors.background }]}>Try this next</Text>
              </View>
            )}
            {mascotColor && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.suggestGlow,
                  {
                    backgroundColor: mascotColor,
                    opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.30] }),
                  },
                ]}
              />
            )}
            <Pressable
              style={[styles.suggestBtn, { borderColor: mascotColor ?? colors.cardBorder }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSheet(true);
                setShowWhatNowNudge(false);
              }}
              hitSlop={8}
            >
              <Feather name="compass" size={13} color={colors.textMuted} />
              <Text style={[styles.suggestBtnText, { color: colors.textMuted }]}>What now?</Text>
              {newlyUnlocked.length > 0 && <View style={[styles.suggestDot, { backgroundColor: colors.accent }]} />}
            </Pressable>
          </View>

          {/* Time reclaimed sub-stat */}
          {showTimeReclaimed && minutesSaved > 0 && (
            <Text style={[styles.timeReclaimed, { color: colors.textMuted }]}>
              {minutesSaved >= 60
                ? `~${Math.round(minutesSaved / 60)} hrs of attention reclaimed`
                : `~${minutesSaved} min reclaimed`}
            </Text>
          )}

          {/* Streak freeze tokens */}
          {streakFreezeTokens > 0 && (
            <View style={[styles.freezePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="wind" size={12} color={readableOn('#a5b4fc', colors.surface)} />
              <Text style={[styles.freezeText, { color: readableOn('#a5b4fc', colors.surface) }]}>
                {streakFreezeTokens} streak freeze{streakFreezeTokens !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {showMilestone && (
            <MilestoneFlash
              count={showMilestone}
              onDone={() => setShowMilestone(null)}
            />
          )}

          {/* Struggling mode toggle */}
          {showStruggleToggle && (!struggling ? (
            <Pressable
              style={styles.struggleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStruggling(true);
              }}
              hitSlop={12}
            >
              <Text style={[styles.struggleTxt, { color: colors.textMuted }]}>
                Having a hard day?
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.struggleBtnActive, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStruggling(false);
              }}
            >
              <Text style={[styles.struggleTxtActive, { color: colors.accent }]}>
                You're doing great — tap to reset
              </Text>
            </Pressable>
          ))}
        </View>

        <QuickAccessRow />

        {/* ── Today's intention ── */}
        {showIntentionCard && <IntentionCard />}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {showSheet && (
        <CompanionSheet
          onClose={() => setShowSheet(false)}
          walkAwayCount={walkAwayCount}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
  },
  greeting: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  dayCount: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
  helpBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Goon zone
  goonZone: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  walkAwayNum: {
    fontFamily: FONTS.display,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1,
    marginTop: SPACING.sm,
  },
  walkAwayLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  suggestWrap: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  suggestGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: RADIUS.full,
  },
  nudgeBubble: {
    position: 'absolute',
    top: -30,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    zIndex: 2,
  },
  nudgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  suggestBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  suggestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timeReclaimed: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  freezePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginTop: SPACING.xs,
  },
  freezeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
  struggleBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  struggleTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  struggleBtnActive: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  struggleTxtActive: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
});
