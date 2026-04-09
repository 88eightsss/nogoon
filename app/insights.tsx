// ─── Weekly Insights Screen ───────────────────────────────────────────────────
//
// A Pro-only screen showing detailed stats and behavioral feedback.
//
// Four sections:
//   1. "This Week"     — 7-bar mini chart (Sun–Sat) + games played this week
//   2. "Your Stats"    — 2×2 grid of lifetime totals
//   3. "Patterns"      — Most active day, total sites blocked, current streak
//   4. "Insights"      — Text paragraphs with tailored behavioral feedback
//
// All data comes from useUserStore — no extra fetching needed here.
//
// Route: /insights
// Navigated to from: Profile screen → "Weekly Insights" settings row (Pro only)
// ─────────────────────────────────────────────────────────────────────────────

import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';

// ─── Day labels for the weekly chart ─────────────────────────────────────────
// Index 0 = Sunday because getLast7Days in the store uses JS Date, which
// starts weeks on Sunday. These labels are displayed below each bar.
// Note: weeklyActivity is indexed 0 = 6 days ago, 6 = today. We compute
// which day-of-week each slot is from that offset.
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helper: get the day name for each bar ───────────────────────────────────
// Given bar index i (0 = 6 days ago, 6 = today), return the day abbreviation.
function getDayLabel(barIndex: number): string {
  const today    = new Date();
  const date     = new Date(today);
  date.setDate(today.getDate() - (6 - barIndex)); // offset back from today
  return SHORT_DAYS[date.getDay()];
}

// ─── Helper: find the most active day in the week ────────────────────────────
// Returns the day name with the highest game count.
// If all days are 0, returns "None yet".
function getMostActiveDay(activity: number[]): string {
  const max = Math.max(...activity);
  if (max === 0) return 'None yet';
  const index = activity.indexOf(max);
  return getDayLabel(index);
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  // Pull all the data we need from the store in one destructure
  const {
    weeklyActivity,
    blocklist,
    points,
    streak,
    longestStreak,
    gamesPlayed,
  } = useUserStore();

  // Total games played this week (sum of all 7 bars)
  const gamesThisWeek = weeklyActivity.reduce((sum, n) => sum + n, 0);

  // The height of the tallest bar — used to scale all other bars proportionally.
  // Floor at 1 to avoid divide-by-zero when everything is 0.
  const maxActivity = Math.max(...weeklyActivity, 1);

  // Pre-compute the most active day label once
  const mostActiveDay = getMostActiveDay(weeklyActivity);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      {/* Back arrow + title + PRO badge */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Weekly Insights</Text>
        {/* PRO badge sits to the right of the title */}
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ════════════════════════════════════════════════════════════════════
            CARD 1 — This Week
            Mini bar chart showing daily game activity for the last 7 days.
            Same visual language as the WeeklyChart component on the Home tab.
        ════════════════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>

          {/* Bar chart container */}
          <View style={styles.chartRow}>
            {weeklyActivity.map((count, i) => {
              // Each bar fills proportionally to the max day's count
              const fillPercent = count > 0 ? count / maxActivity : 0;
              const isToday     = i === 6; // rightmost bar is always today
              return (
                <View key={i} style={styles.chartBarWrapper}>

                  {/* Show the count above the bar if it's > 0 */}
                  {count > 0 && (
                    <Text style={styles.chartBarCount}>{count}</Text>
                  )}

                  {/* The outer track (full height, dim) */}
                  <View style={styles.chartBarTrack}>
                    {/* The inner fill (proportional height, colored) */}
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${Math.max(fillPercent * 100, 4)}%`,
                          // Today's bar is green; past days are purple
                          backgroundColor: isToday ? COLORS.green : COLORS.purple,
                          opacity: isToday ? 1 : 0.7,
                        },
                      ]}
                    />
                  </View>

                  {/* Day label below each bar */}
                  <Text style={[styles.chartDayLabel, isToday && { color: COLORS.green }]}>
                    {getDayLabel(i)}
                  </Text>

                </View>
              );
            })}
          </View>

          {/* Summary line below the chart */}
          <Text style={styles.chartSummary}>
            <Text style={{ color: COLORS.purple, fontFamily: FONTS.monoBold }}>
              {gamesThisWeek}
            </Text>
            {gamesThisWeek === 1 ? ' game' : ' games'} played this week
          </Text>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            CARD 2 — Your Stats
            2×2 grid of lifetime numbers — same StatCell pattern as profile.tsx
        ════════════════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Stats</Text>

          <View style={styles.statsGrid}>
            <StatCell
              label="Total Games"
              value={String(gamesPlayed)}
              color={COLORS.green}
            />
            <StatCell
              label="Best Streak"
              value={`${longestStreak}d`}
              color={COLORS.warning}
            />
            <StatCell
              label="Sites Blocked"
              value={String(blocklist.length)}
              color={COLORS.cyan}
            />
            <StatCell
              label="Points Earned"
              // toLocaleString adds thousands separators (e.g. "1,250")
              value={points.toLocaleString()}
              color={COLORS.purple}
            />
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            CARD 3 — Patterns
            Three rows with icons showing behavioral patterns
        ════════════════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patterns</Text>

          {/* Most active day of the week */}
          <PatternRow
            icon="sunny-outline"
            iconColor={COLORS.warning}
            label="Most active day"
            value={mostActiveDay}
          />

          <View style={styles.patternDivider} />

          {/* How many sites the user has blocked in total */}
          <PatternRow
            icon="ban-outline"
            iconColor={COLORS.danger}
            label="Total sites blocked"
            value={`${blocklist.length} site${blocklist.length !== 1 ? 's' : ''}`}
          />

          <View style={styles.patternDivider} />

          {/* Current active streak */}
          <PatternRow
            icon="flame-outline"
            iconColor={COLORS.green}
            label="Current streak"
            value={`${streak} day${streak !== 1 ? 's' : ''}`}
          />
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            CARD 4 — Insights
            Personalized behavioral feedback paragraphs.
            Which ones appear depends on the user's actual stats.
            The default message always appears at the bottom.
        ════════════════════════════════════════════════════════════════════ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Insights</Text>

          <View style={styles.insightsBody}>

            {/* Streak milestone message — shown if user has 7+ day streak */}
            {streak >= 7 && (
              <InsightParagraph
                icon="cellular-outline"
                iconColor={COLORS.green}
                text="You've built a 7+ day streak — your neural pathways are actively rewiring. Consistency at this level creates lasting behavioral change."
              />
            )}

            {/* Games milestone message — shown if user has played 20+ games */}
            {gamesPlayed >= 20 && (
              <InsightParagraph
                icon="game-controller-outline"
                iconColor={COLORS.purple}
                text="You've played 20+ games. Each one was a moment of resistance — a choice to pause instead of consume. That adds up."
              />
            )}

            {/* Default message — always shown, acts as a motivational baseline */}
            <InsightParagraph
              icon="trending-up-outline"
              iconColor={COLORS.cyan}
              text="Keep going. Consistency over intensity. Small daily wins compound into habits that stick — the data backs it up."
            />

          </View>
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCell sub-component ────────────────────────────────────────────────────
// Reused from profile.tsx pattern: large colored number on top, small muted label below.

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── PatternRow sub-component ─────────────────────────────────────────────────
// A single row in the Patterns card: colored icon on left, label in middle, value on right.

function PatternRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.patternRow}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={styles.patternLabel}>{label}</Text>
      <Text style={[styles.patternValue, { color: iconColor }]}>{value}</Text>
    </View>
  );
}

// ─── InsightParagraph sub-component ──────────────────────────────────────────
// A single insight block: icon on top-left, paragraph text beside it.

function InsightParagraph({
  icon,
  iconColor,
  text,
}: {
  icon: string;
  iconColor: string;
  text: string;
}) {
  return (
    <View style={styles.insightRow}>
      <Ionicons name={icon as any} size={18} color={iconColor} style={styles.insightIcon} />
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // ── Header bar ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.textPrimary,
    // No textAlign: 'center' here — the PRO badge sits to the right so the
    // title naturally left-centers between the back button and the badge.
    marginLeft: SPACING.sm,
    letterSpacing: -0.3,
  },

  // PRO badge — small purple pill on the right side of the header
  proBadge: {
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.purple + '66',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  proBadgeText: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: COLORS.purple,
    letterSpacing: 1.5,
  },

  // ── Shared card styles ──
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },

  // ── Weekly chart ──
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    gap: SPACING.xs,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartBarCount: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  // The full-height track (background of each bar)
  chartBarTrack: {
    width: '100%',
    height: 52, // fixed track height; fill grows from bottom up
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end', // fill rises from the bottom
  },
  // The colored fill portion of each bar
  chartBarFill: {
    width: '100%',
    borderRadius: RADIUS.sm,
    minHeight: 3,
  },
  chartDayLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  chartSummary: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // ── Stats grid (2×2) ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCell: {
    // Each cell takes roughly half the card width, accounting for the gap
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 26,
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Patterns rows ──
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  patternLabel: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  patternValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
  },
  patternDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: -SPACING.xs,
  },

  // ── Insights paragraphs ──
  insightsBody: { gap: SPACING.md },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  insightIcon: {
    // Nudge down slightly so the icon top-aligns with the text cap height
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
});
