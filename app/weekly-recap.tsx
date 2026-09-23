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
import { useTheme } from '@/hooks/useTheme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function dayLabel(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return DAY_LABELS[d.getDay()];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyRecapScreen() {
  const { colors } = useTheme();
  const {
    walkAwayActivity,
    dailyWalkAways,
    reflectionCounts,
    walkAwayCount,
    streak,
    name,
  } = useUserStore();

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const key = dateKey(daysAgo);
      const count = dailyWalkAways[key] ?? walkAwayActivity[i] ?? 0;
      return { key, label: dayLabel(key), count, daysAgo };
    });
  }, [dailyWalkAways, walkAwayActivity]);

  const weekTotal   = useMemo(() => days.reduce((s, d) => s + d.count, 0), [days]);
  const maxDay      = useMemo(() => Math.max(...days.map((d) => d.count), 1), [days]);
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

  const handleShare = async () => {
    const lines = [
      `My NoGoon Week`,
      ``,
      `Walk-aways: ${weekTotal} this week`,
      `Consistency: ${consistency}% of days`,
      bestDay ? `Best day: ${bestDay.label} (${bestDay.count} walk-aways)` : '',
      topTag ? `Top trigger: ${topTag}` : '',
      `Lifetime total: ${walkAwayCount} walk-aways`,
      streak > 0 ? `Current streak: ${streak} days` : '',
      ``,
      `Built the discipline muscle with NoGoon`,
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message: lines });
    } catch (_) { /* cancelled */ }
  };

  const todayKey = dateKey(0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.navBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Weekly Recap</Text>
          <Pressable style={styles.navBtn} onPress={handleShare}>
            <Feather name="share-2" size={18} color={colors.accent} />
          </Pressable>
        </View>

        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.accent + '44' }]}>
          <Text style={[styles.heroNum, { color: colors.accent }]}>{weekTotal}</Text>
          <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>walk-aways this week</Text>
          {name ? (
            <Text style={[styles.heroName, { color: colors.textMuted }]}>Keep going, {name}</Text>
          ) : null}
        </View>

        {/* Bar chart */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>Daily Breakdown</Text>
          <View style={styles.barChart}>
            {days.map((d) => {
              const isToday = d.key === todayKey;
              const barH = d.count > 0 ? Math.max(12, (d.count / maxDay) * 100) : 4;
              return (
                <View key={d.key} style={styles.barCol}>
                  {d.count > 0 && (
                    <Text style={[styles.barCount, { color: colors.textMuted }]}>{d.count}</Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barH,
                        backgroundColor: d.count === 0
                          ? colors.border
                          : isToday ? colors.accent : colors.accent + '55',
                      },
                    ]}
                  />
                  <Text style={[styles.barLabel, { color: isToday ? colors.accent : colors.textMuted }]}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { num: `${consistency}%`, label: 'consistency' },
            { num: bestDay ? String(bestDay.count) : '0', label: 'best day' },
            { num: String(streak), label: 'day streak' },
          ].map(({ num, label }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statNum, { color: colors.text }]}>{num}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Top trigger */}
        {topTag && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>Top Trigger</Text>
            <View style={styles.tagRow}>
              <View style={[styles.tagPill, { backgroundColor: COLORS.warning + '22', borderColor: COLORS.warning + '55' }]}>
                <Text style={[styles.tagText, { color: COLORS.warning }]}>{topTag}</Text>
              </View>
              <Text style={[styles.cardBody, { flex: 1, color: colors.textSecondary }]}>
                Your most common feeling when you hit a blocked app.
              </Text>
            </View>
          </View>
        )}

        {/* Lifetime */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>All Time</Text>
          <Text style={[styles.lifetimeNum, { color: COLORS.cyan }]}>{walkAwayCount}</Text>
          <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
            total walk-aways since you started
          </Text>
        </View>

        {/* Share CTA */}
        <Pressable style={[styles.shareBlock, { backgroundColor: colors.accent }]} onPress={handleShare}>
          <Feather name="share-2" size={18} color={colors.background} />
          <Text style={[styles.shareBlockText, { color: colors.background }]}>Share Your Week</Text>
        </Pressable>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles (layout only — no colors) ────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  navBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
  },

  heroCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  heroNum: {
    fontFamily: FONTS.display,
    fontSize: 64,
    lineHeight: 68,
  },
  heroLabel: {
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  heroName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    marginTop: SPACING.xs,
  },

  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },

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
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 26,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  tagPill: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },

  lifetimeNum: {
    fontFamily: FONTS.display,
    fontSize: 48,
  },

  shareBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xs,
  },
  shareBlockText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
});
