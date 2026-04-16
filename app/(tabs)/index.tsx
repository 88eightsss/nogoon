// ─── Home Screen ──────────────────────────────────────────────────────────────
//
// The main dashboard the user sees every time they open GATE.
// Scrollable page with 5 sections:
//   1. Header (greeting + level badge)
//   2. Shield status (is GATE active?)
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
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// ─── Getting Started Card ──────────────────────────────────────────────────────
//
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
          Add your first blocked site and enable app blocking to start building your streak.
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={COLORS.indigoBright} />
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
  } = useUserStore();

  // Pull the real blocking state from the hook that talks to Android
  // blockingStatus: 'active' | 'empty' | 'off'
  const { blockingStatus, openSettings } = useAppBlocker();

  // Re-fetch data from Supabase every time this tab comes into view.
  // This keeps the home screen fresh if the user just completed a game
  // or if another device made changes (cloud sync).
  useEffect(() => {
    if (session?.user?.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user?.id]);

  // Calculate how far the user is through their current XP level
  const levelProgress = getLevelProgress(xp);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── Section 1: Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Time-of-day greeting */}
            <Text style={styles.greeting}>{getGreeting()}</Text>

            {/* User's name — comes from Supabase profile, not a hardcoded default */}
            <Text style={[TYPE.headingM, styles.name]}>
              {name ? `${name} 👋` : '👋'}
            </Text>
          </View>

          {/* Level badge — top right corner */}
          <Badge label={level} color={COLORS.purple} size="sm" />
        </View>

        {/* ─── Section 2: Shield Status ──────────────────────── */}
        {/* status is read from the real Android Accessibility Service state —
            'active' = actually blocking, 'empty' = on but empty list, 'off' = not enabled */}
        <ShieldStatus
          status={blockingStatus}
          onFix={openSettings}
        />

        {/* ─── Section 3: Stats Row ──────────────────────────── */}
        {/* Streak and Points side by side, each taking half the width */}
        <View style={styles.statsRow}>
          <StreakBadge streak={streak} longestStreak={longestStreak} walkAwayCount={walkAwayCount} />
          <PointsBadge
            points={points}
            level={level}
            xpPercent={levelProgress.percent}
          />
        </View>

        {/* ─── Section 4: Weekly Chart ───────────────────────── */}
        {/* Data comes from game_sessions table in Supabase.
            Each bar = number of games played that day. Today = rightmost bar. */}
        <WeeklyChart data={weeklyActivity} />

        {/* Show a getting-started card when the user has never played a game */}
        {weeklyActivity.every(v => v === 0) && (
          <GettingStartedCard />
        )}

        {/* ─── Section 5: Daily Challenge ────────────────────── */}
        <DailyChallengeCard
          alreadyCompleted={dailyChallengeCompleted}
          onPress={() => {
            // Navigate to the Arcade tab so the user can pick a game
            router.push('/(tabs)/arcade');
          }}
        />

        {/* Bottom padding so the last card doesn't sit right on the tab bar */}
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ─── Bottom banner ad ───────────────────────────────────── */}
      {/* Pinned to the bottom of the screen, above the tab bar.
          Pro users see nothing here. Free users see a standard 52px banner.
          This single placement can generate $200–$500/month at scale. */}
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
});

// ─── Getting Started Card styles ───────────────────────────────────────────────
//
// Kept separate from the main StyleSheet so the component is self-contained
// and easy to delete once the user has activity data.

const gettingStartedStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',  // indigo at 20% opacity — subtle highlight
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
