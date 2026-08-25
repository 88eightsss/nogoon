// ─── Weekly Recap Screen ──────────────────────────────────────────────────────
//
// A full-screen recap of the user's past 7 days:
//   • Walk-away count + mini bar chart
//   • Top urge tag
//   • Consistency score (days with ≥1 walk-away / 7)
//   • Best day
//   • Share as text summary
//
// Accessible from the profile screen.

import { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Returns the date string "YYYY-MM-DD" for n days ago (0 = today).
function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Returns day-of-week label for a date key.
function dayLabel(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return DAY_LABELS[d.getDay()];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyRecapScreen() {
  const {
    walkAwayActivity,   // [number × 7] last-7-days walk-aways, index 0 = 6 days ago, index 6 = today
    dailyWalkAways,     // Record<YYYY-MM-DD, number>
    reflectionCounts,   // Record<tag, number>
    walkAwayCount,      // lifetime total
    streak,
    name,
  } = useUserStore();

  // ── Build 7-day data ───────────────────────────────────────────────────────
  // walkAwayActivity[6] = today, walkAwayActivity[0] = 6 days ago
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;           // i=0 → 6 days ago, i=6 → today
      const key = dateKey(daysAgo);
      const count = dailyWalkAways[key] ?? walkAwayActivity[i] ?? 0;
      return { key, label: dayLabel(key), count, daysAgo };
    });
  }, [dailyWalkAways, walkAwayActivity]);

  const weekTotal = useMemo(() => days.reduce((s, d) => s + d.count, 0), [days]);
  const maxDay    = useMemo(() => Math.max(...days.map((d) => d.count), 1), [days]);
  const consistency = useMemo(() => {
    const activeDays = days.filter((d) => d.count > 0).length;
    return Math.round((activeDays / 7) * 100);
  }, [days]);

  const bestDay = useMemo(() => {
    const top = [...days].sort((a, b) => b.count - a.count)[0];
    return top.count > 0 ? top : null;
  }, [days]);

  const topTag = useMemo(() => {
    const entries = Object.entries(reflectionCounts);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [reflectionCounts]);

  // ── Share ──────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    const lines = [
      `📊 My NoGoon Week`,
      ``,
      `Walk-aways: ${weekTotal} this week`,
      `Consistency: ${consistency}% of days`,
      bestDay ? `Best day: ${bestDay.label} (${bestDay.count} walk-aways)` : '',
      topTag ? `Top trigger: ${topTag}` : '',
      `Lifetime total: ${walkAwayCount} walk-aways`,
      streak > 0 ? `Current streak: ${streak} days` : '',
      ``,
      `🛡️ Built the discipline muscle with @NoGoon`,
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message: lines });
    } catch (_) {
      // share sheet cancelled — ignore
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const todayKey = dateKey(0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Weekly Recap</Text>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Feather name="share-2" size={18} color={COLORS.green} />
          </Pressable>
        </View>

        {/* Hero stat */}
        <View style={styles.heroCard}>
          <Text style={styles.heroNum}>{weekTotal}</Text>
          <Text style={styles.heroLabel}>walk-aways this week</Text>
          {name ? (
            <Text style={styles.heroName}>Keep going, {name} 🙌</Text>
          ) : null}
        </View>

        {/* Bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Breakdown</Text>
          <View style={styles.barChart}>
            {days.map((d) => {
              const isToday = d.key === todayKey;
              const barH = d.count > 0 ? Math.max(12, (d.count / maxDay) * 100) : 4;
              return (
                <View key={d.key} style={styles.barCol}>
                  {d.count > 0 && (
                    <Text style={styles.barCount}>{d.count}</Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      { height: barH, backgroundColor: isToday ? COLORS.green : COLORS.green + '55' },
                      d.count === 0 && styles.barEmpty,
                    ]}
                  />
                  <Text style={[styles.barLabel, isToday && { color: COLORS.green }]}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{consistency}%</Text>
            <Text style={styles.statLabel}>consistency</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{bestDay ? bestDay.count : 0}</Text>
            <Text style={styles.statLabel}>best day</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{streak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
        </View>

        {/* Urge insights */}
        {topTag && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Trigger</Text>
            <View style={styles.tagRow}>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>{topTag}</Text>
              </View>
              <Text style={[styles.cardBody, { flex: 1 }]}>
                Your most common feeling when you hit a blocked app.
              </Text>
            </View>
          </View>
        )}

        {/* Lifetime */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Time</Text>
          <Text style={styles.lifetimeNum}>{walkAwayCount}</Text>
          <Text style={styles.cardBody}>total walk-aways since you started</Text>
        </View>

        {/* Share CTA */}
        <Pressable style={styles.shareBlock} onPress={handleShare}>
          <Feather name="share-2" size={18} color={COLORS.background} />
          <Text style={styles.shareBlockText}>Share Your Week</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  shareBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hero
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.green + '44',
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  heroNum: {
    fontFamily: FONTS.display,
    fontSize: 64,
    color: COLORS.green,
    lineHeight: 68,
  },
  heroLabel: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  heroName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // ── Cards
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
    fontSize: 13,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // ── Bar chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 130,
    gap: SPACING.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    height: 130,
  },
  barCount: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barEmpty: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  barLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── Stats row
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 26,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Tag
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  tagPill: {
    backgroundColor: COLORS.warning + '22',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.warning + '55',
  },
  tagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.warning,
  },

  // ── Lifetime
  lifetimeNum: {
    fontFamily: FONTS.display,
    fontSize: 48,
    color: COLORS.cyan,
  },

  // ── Share CTA
  shareBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xs,
  },
  shareBlockText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
});
