// ─── Home Screen ────────────────────────────────────────────────────────────── //
//
// The main dashboard the user sees every time they open NoGoon.
// Scrollable page with 5 sections:
//   1. Header (greeting + level badge)
//   2. Shield status (is NoGoon active?)
//   3. Stats row (streak + points side by side)
//   4. Weekly activity chart (real data from Supabase game_sessions)
//   5. Daily challenge card
//
// All data comes from useUserStore, which is populated by loadFromSupabase()
// on every login. No mock data — if a value is 0, the user genuinely has 0.

import { useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore, getLevelProgress } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { AdBanner } from '@/components/ads/AdBanner';
import { ShieldStatus } from '@/components/home/ShieldStatus';
import { StreakBadge } from '@/components/home/StreakBadge';
import { PointsBadge } from '@/components/home/PointsBadge';
import { WeeklyChart } from '@/components/home/WeeklyChart';
import { DailyChallengeCard } from '@/components/home/DailyChallengeCard';
import { Badge } from '@/components/ui/Badge';
import { getColors, COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// ─── Getting Started Card ────────────────────────────────────────────────────── //
// Shown on the home screen only when the user has zero activity yet
// (weeklyActivity is all 0s). Tapping it takes them to the blocklist tab
// so they can set up their first blocked site and get protected.
function GettingStartedCard() {
  return (
    <Pressable
      style={gettingStartedStyles.card}
      onPress={() => router.push('/(tabs)/blocklist')}
    >
      <Text style={gettingStartedStyles.emoji}>🚀</Text>
      <View style={gettingStartedStyles.text}>
        <Text style={gettingStartedStyles.title}>Get protected in 30 seconds</Text>
        <Text style={gettingStartedStyles.body}>
          Add your first blocked site and enable app blocking to start building
          your streak.
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={COLORS.indigoBright} />
    </Pressable>
  );
}

// ─── Setup Help Card ─────────────────────────────────────────────────────────── //
// Shown when the Accessibility Service is disabled (blockingStatus === 'off').
// Tapping opens the setup guide screen so the user can re-enable blocking.
function SetupHelpCard() {
  return (
    <Pressable
      style={setupHelpStyles.card}
      onPress={() => router.push('/setup-guide')}
    >
      <Feather name="alert-circle" size={24} color={COLORS.hotPink} />
      <View style={setupHelpStyles.text}>
        <Text style={setupHelpStyles.title}>Blocking is disabled</Text>
        <Text style={setupHelpStyles.body}>
          Tap here to reopen the setup guide and enable the Accessibility Service.
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={COLORS.hotPink} />
    </Pressable>
  );
}

// Returns "Good morning", "Good afternoon", or "Good evening"
// based on the current hour of the day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { session } = useAuthStore();
  const {
    name,
    streak,
    longestStreak,
    points,
    xp,
    level,
    weeklyActivity,
    dailyChallengeCompleted,
    walkAwayCount,
    loadFromSupabase,
    colorScheme,
  } = useUserStore();

  const C = getColors(colorScheme ?? 'dark');

  // Pull the real blocking state from the hook that talks to Android
  // blockingStatus: 'active' | 'empty' | 'off'
  const { blockingStatus, openSettings } = useAppBlocker();

  // Re-fetch data from Supabase every time this tab comes into view.
  useEffect(() => {
    if (session?.user?.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user?.id]);

  // Calculate how far the user is through their current XP level
  const levelProgress = getLevelProgress(xp);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Section 1: Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: C.textSecondary }]}>{getGreeting()}</Text>
            <Text style={[TYPE.headingM, styles.name]}>
              {name ? `${name} 👋` : '👋'}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {/* Help button — opens setup guide */}
            <Pressable
              style={[styles.helpButton, { backgroundColor: C.surface, borderColor: C.cardBorder }]}
              onPress={() => router.push('/help')}
              hitSlop={8}
            >
              <Feather name="help-circle" size={20} color={C.textMuted} />
            </Pressable>
            {/* Level badge */}
            <Badge label={level} color={C.purple} size="sm" />
          </View>
        </View>

        {/* ─── Section 2: Shield Status ──────────────────────── */}
        <ShieldStatus status={blockingStatus} onFix={openSettings} />

        {/* ─── Setup Help Card (shown when blocking is off) ──── */}
        {blockingStatus === 'off' && <SetupHelpCard />}

        {/* ─── Section 3: Stats Row ──────────────────────────── */}
        <View style={styles.statsRow}>
          <StreakBadge
            streak={streak}
            longestStreak={longestStreak}
            walkAwayCount={walkAwayCount}
          />
          <PointsBadge
            points={points}
            level={level}
            xpPercent={levelProgress.percent}
          />
        </View>

        {/* ─── Arcade Card ───────────────────────────────────── */}
        <Pressable
          style={[styles.arcadeCard, { backgroundColor: C.purpleDim, borderColor: C.purple + '44' }]}
          onPress={() => router.push('/(tabs)/arcade')}
        >
          <View style={styles.arcadeLeft}>
            <View style={[styles.arcadeIconWrap, { backgroundColor: C.purple + '22', borderColor: C.purple + '44' }]}>
              <Feather name="zap" size={22} color={C.purple} />
            </View>
            <View style={styles.arcadeText}>
              <Text style={[styles.arcadeTitle, { color: C.purple }]}>Play Arcade</Text>
              <Text style={[styles.arcadeSub, { color: C.purple + 'aa' }]}>Earn points · Beat cravings</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={C.purple + 'aa'} />
        </Pressable>

        {/* ─── Section 4: Weekly Chart ───────────────────────── */}
        <WeeklyChart data={weeklyActivity} />

        {weeklyActivity.every(v => v === 0) && (
          <GettingStartedCard />
        )}

        {/* ─── Section 5: Daily Challenge ────────────────────── */}
        <DailyChallengeCard
          alreadyCompleted={dailyChallengeCompleted}
          onPress={(gameId) => {
            router.push({ pathname: '/(tabs)/arcade', params: { game: gameId } });
          }}
        />

        <View style={styles.bottomPad} />
      </ScrollView>

      <AdBanner size="banner" />
    </SafeAreaView>
  );
      }

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
  },
  headerLeft: {
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  name: {
    marginTop: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  bottomPad: {
    height: SPACING.xl,
  },

  // ── Arcade card ──
  arcadeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    padding: SPACING.lg,
  },
  arcadeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  arcadeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.purple + '22',
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcadeText: { gap: 2 },
  arcadeTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.purple,
  },
  arcadeSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.purple + 'aa',
  },
});

// ─── Getting Started Card styles ─────────────────────────────────────────────── //
const gettingStartedStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  emoji: { fontSize: 32 },
  text: { flex: 1, gap: 4 },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

// ─── Setup Help Card styles ──────────────────────────────────────────────────── //
// Shown when blocking is disabled. Uses hotPink to convey urgency per design system.
const setupHelpStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.hotPink + '33',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  text: { flex: 1, gap: 4 },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.hotPink,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

