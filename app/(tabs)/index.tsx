// ─── Home Screen (Today) ─────────────────────────────────────────────────────
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
  TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/useThemeStore';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GoonMascot } from '@/components/home/GoonMascot';

// ─── Milestone thresholds ─────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const MILESTONE_KEY = 'goon_last_shown_milestone';

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

const INTENTION_KEY = 'nogoon_today_intention';
const INTENTION_DATE_KEY = 'nogoon_intention_date';

function IntentionCard() {
  const { colors, cardStyle } = useTheme();
  const [intention, setIntention] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Load today's intention from AsyncStorage
  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const [saved, savedDate] = await Promise.all([
        AsyncStorage.getItem(INTENTION_KEY),
        AsyncStorage.getItem(INTENTION_DATE_KEY),
      ]);
      if (savedDate === today && saved) {
        setIntention(saved);
      }
    }
    load();
  }, []);

  const save = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const val = draft.trim();
    setIntention(val);
    setEditing(false);
    if (val) {
      await AsyncStorage.setItem(INTENTION_KEY, val);
      await AsyncStorage.setItem(INTENTION_DATE_KEY, today);
    }
  }, [draft]);

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
      onPress={startEdit}
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

function ShieldStrip({ status, onFix }: { status: string; onFix: () => void }) {
  const { colors } = useTheme();
  if (status === 'active') {
    return (
      <View style={[stripStyles.wrap, { backgroundColor: colors.successDim }]}>
        <Feather name="shield" size={14} color={colors.success} />
        <Text style={[stripStyles.text, { color: colors.success }]}>Blocking active</Text>
      </View>
    );
  }
  return (
    <Pressable style={[stripStyles.wrap, { backgroundColor: colors.dangerDim }]} onPress={onFix}>
      <Feather name="alert-circle" size={14} color={colors.danger} />
      <Text style={[stripStyles.text, { color: colors.danger }]}>Blocking off — tap to fix</Text>
    </Pressable>
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

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { session } = useAuthStore();
  const { name, walkAwayCount, totalMinutesAvoided = 0, streakFreezeTokens = 0, loadFromSupabase } = useUserStore();
  const { showIntentionCard, showStruggleToggle, showTimeReclaimed } = useThemeStore();
  const { blockingStatus, openSettings } = useAppBlocker();
  const { colors, struggling, setStruggling, cardStyle } = useTheme();

  const [showMilestone, setShowMilestone] = useState<number | null>(null);

  // Load Supabase data after login
  useEffect(() => {
    if (session?.user?.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user?.id, loadFromSupabase]);

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
        const today = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem('nogoon_start_date', today);
        setDayCount(1);
      } else {
        const start = new Date(startDate).getTime();
        const now   = new Date().getTime();
        const days  = Math.floor((now - start) / 86_400_000) + 1;
        setDayCount(days);
      }
    }
    computeDay();
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
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
            onPress={() => router.push('/help')}
            hitSlop={8}
          >
            <Feather name="help-circle" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Shield status strip — top so blocking state is never missed ── */}
        <ShieldStrip status={blockingStatus} onFix={openSettings} />

        {/* ── Goon character zone ── */}
        <View style={styles.goonZone}>
          <GoonMascot walkAwayCount={walkAwayCount} />

          <Text style={[styles.walkAwayNum, { color: colors.accent }]}>
            {walkAwayCount.toLocaleString()}
          </Text>
          <Text style={[styles.walkAwayLabel, { color: colors.textSecondary }]}>
            times you walked away
          </Text>

          {/* Time reclaimed sub-stat */}
          {showTimeReclaimed && totalMinutesAvoided > 0 && (
            <Text style={[styles.timeReclaimed, { color: colors.textMuted }]}>
              {totalMinutesAvoided >= 60
                ? `~${Math.round(totalMinutesAvoided / 60)} hrs of attention reclaimed`
                : `~${totalMinutesAvoided} min reclaimed`}
            </Text>
          )}

          {/* Streak freeze tokens */}
          {streakFreezeTokens > 0 && (
            <View style={[styles.freezePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="wind" size={12} color="#a5b4fc" />
              <Text style={[styles.freezeText, { color: '#a5b4fc' }]}>
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
              onPress={() => setStruggling(true)}
              hitSlop={12}
            >
              <Text style={[styles.struggleTxt, { color: colors.textMuted }]}>
                Having a hard day?
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.struggleBtnActive, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
              onPress={() => setStruggling(false)}
            >
              <Text style={[styles.struggleTxtActive, { color: colors.accent }]}>
                You're doing great — tap to reset
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Today's intention ── */}
        {showIntentionCard && <IntentionCard />}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
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
