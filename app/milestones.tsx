// ─── Milestones — personal achievement tracker ───────────────────────────────
//
// Replaces the old "Leagues" community leaderboard (a community leaderboard
// screen ranked by walk-away count — removed from the app before launch and
// no longer linked from anywhere). This is the personal, non-social version:
// streak stats plus a badge grid for lifetime walk-away milestones. No
// comparison to other users, just your own progress.

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

export default function MilestonesScreen() {
  const { colors, cardStyle } = useTheme();
  const { streak, longestStreak, walkAwayCount, gamesPlayed } = useUserStore();

  const stats = [
    { icon: 'zap' as const,         label: 'Current streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
    { icon: 'award' as const,       label: 'Longest streak',  value: `${longestStreak} day${longestStreak === 1 ? '' : 's'}` },
    { icon: 'shield' as const,      label: 'Total walk-aways', value: walkAwayCount.toLocaleString() },
    { icon: 'play-circle' as const, label: 'Games played',    value: gamesPlayed.toLocaleString() },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Milestones</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your own progress — no leaderboard, just how far you've come.
        </Text>

        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: colors.accentDim }]}>
                <Feather name={s.icon} size={18} color={colors.accent} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Walk-away badges</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Earned automatically as your lifetime count climbs.
        </Text>

        <View style={styles.badgeGrid}>
          {MILESTONES.map((m) => {
            const earned = walkAwayCount >= m;
            return (
              <View
                key={m}
                style={[
                  styles.badge,
                  cardStyle,
                  {
                    backgroundColor: earned ? colors.accentDim : colors.surface,
                    borderColor: earned ? colors.accent : colors.cardBorder,
                  },
                ]}
              >
                <Feather
                  name={earned ? 'award' : 'lock'}
                  size={20}
                  color={earned ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.badgeValue, { color: earned ? colors.text : colors.textMuted }]}>
                  {m.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontFamily: FONTS.display, fontSize: 18 },

  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'flex-start',
    gap: 4,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontFamily: FONTS.bodyBold, fontSize: 18 },
  statLabel: { fontFamily: FONTS.body, fontSize: 12 },

  sectionTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, marginBottom: 2 },
  sectionSubtitle: { fontFamily: FONTS.body, fontSize: 12, marginBottom: SPACING.md },

  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  badge: {
    width: '30%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  badgeValue: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
});
