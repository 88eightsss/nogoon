// ─── Insights Screen ──────────────────────────────────────────────────────────
//
// Shows the user's behavioral patterns over time:
//   1. Walk-aways this week (bar chart, from dailyWalkAways)
//   2. What you were feeling (reflectionCounts breakdown)
//   3. Your peak urge hour (hourlyOpenCounts heatmap)
//   4. All-time summary stats
//   5. 30-day consistency score (utils/consistencyScore.ts)
//
// All data is local — no server requests needed.

import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useTheme } from '@/hooks/useTheme';
import { getLocalDateKey, getLast7DaysWithLabels } from '@/utils/date';
import { computeConsistencyScore } from '@/utils/consistencyScore';

// ─── Constants ─────────────────────────────────────────────────────────────────
const MAX_BAR_HEIGHT = 56;

// IDs must match the REFLECTION_OPTIONS ids in post-game.tsx exactly (capitalized).
// reflectionCounts keys are stored verbatim from opt.id — lowercase would miss all data.
const FEELINGS = [
  { id: 'Bored',           emoji: '😴', label: 'Bored',      color: COLORS.cyan    },
  { id: 'Anxious',         emoji: '😰', label: 'Anxious',    color: COLORS.warning },
  { id: 'Stressed',        emoji: '😤', label: 'Stressed',   color: COLORS.warning },
  { id: 'Lonely',          emoji: '🫂', label: 'Lonely',     color: COLORS.purple  },
  { id: 'Procrastinating', emoji: '⏰', label: 'Avoiding',   color: COLORS.green   },
  { id: 'Habit',           emoji: '🔁', label: 'Just Habit', color: COLORS.cyan    },
] as const;

// Evenly-spaced hours for the heatmap (8 cells across the day)
const HEATMAP_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function hourLabel(h: number): string {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const {
    reflectionCounts,
    hourlyOpenCounts,
    walkAwayCount,
    gamesPlayed,
    weeklyActivity,
    streak,
    longestStreak,
    urgeJournal,
    commitmentLog,
    dailyWalkAways,
    dailyGateFires,
    followThroughLog,
    firstActiveDate,
    totalActiveDays,
  } = useUserStore();

  // ── All-time stats ─────────────────────────────────────────────────────────
  // firstActiveDate/totalActiveDays are lifetime counters maintained in the
  // store (see recordDailyWalkAway) — NOT derived from dailyWalkAways, which
  // is deliberately pruned to a rolling 30 days for the consistency score.
  // Deriving "first active day" from that pruned map used to mean the number
  // silently reset every month; these two don't.
  const firstActiveDay  = firstActiveDate || null;
  const activeDayCount  = totalActiveDays;
  // Time saved: derived, not stored — see getMinutesSaved in useUserStore
  const minutesSaved    = getMinutesSaved(walkAwayCount);
  const hoursSaved      = Math.floor(minutesSaved / 60);
  const remMinutes      = minutesSaved % 60;
  const timeSavedLabel  = hoursSaved > 0
    ? `${hoursSaved}h${remMinutes > 0 ? ` ${remMinutes}m` : ''}`
    : `${minutesSaved}m`;
  // Format first active day
  const firstDayLabel = firstActiveDay
    ? new Date(firstActiveDay + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Urge tag frequency — last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentUrges = urgeJournal.filter((e) => e.timestamp > thirtyDaysAgo);
  const tagCounts: Record<string, number> = {};
  const domainTagMap: Record<string, Record<string, number>> = {};
  for (const e of recentUrges) {
    tagCounts[e.tag] = (tagCounts[e.tag] ?? 0) + 1;
    if (!domainTagMap[e.domain]) domainTagMap[e.domain] = {};
    domainTagMap[e.domain][e.tag] = (domainTagMap[e.domain][e.tag] ?? 0) + 1;
  }
  const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const maxTagCount = Math.max(...Object.values(tagCounts), 1);
  // Per-domain top trigger (only domains with ≥3 entries)
  const domainInsights = Object.entries(domainTagMap)
    .filter(([, counts]) => Object.values(counts).reduce((a, b) => a + b, 0) >= 3)
    .map(([dom, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const [topTag, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return { domain: dom, topTag, pct: Math.round((topCount / total) * 100) };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  // Commitment breakdown — count each label in the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCommitments = commitmentLog.filter((e) => e.timestamp > sevenDaysAgo);
  const commitmentCounts: Record<string, number> = {};
  for (const e of recentCommitments) {
    commitmentCounts[e.text] = (commitmentCounts[e.text] ?? 0) + 1;
  }
  const commitmentEntries = Object.entries(commitmentCounts).sort((a, b) => b[1] - a[1]);

  const { colors } = useTheme();
  // Merge: theme-sensitive fields from useTheme, fixed semantic accent colors from COLORS
  const C = {
    ...COLORS,
    background:    colors.background,
    surface:       colors.surface,
    surfaceHigh:   colors.surfaceHigh,
    textPrimary:   colors.text,
    textSecondary: colors.textSecondary,
    textMuted:     colors.textMuted,
    cardBorder:    colors.cardBorder,
    border:        colors.border,
    green:         colors.accent,
    indigoBright:  colors.accent,
  };

  // Walk-away chart
  // Built from the per-day map, so the bars are the real last 7 days (and the
  // letters are the real weekdays) instead of a counter that never rolled over.
  const weekDays       = getLast7DaysWithLabels();
  const walkAwayWeek   = weekDays.map((d) => dailyWalkAways[d.key] ?? 0);
  const maxWalkAway    = Math.max(...walkAwayWeek, 1);
  const totalThisWeek  = walkAwayWeek.reduce((a, b) => a + b, 0);

  // 30-day consistency: days you walked away at least once / days the gate
  // fired at all. Unlike a streak, one bad day only dents it.
  const consistency = computeConsistencyScore(dailyGateFires, dailyWalkAways);
  const gradeColor =
    consistency.grade === 'S' || consistency.grade === 'A' ? C.green
    : consistency.grade === 'B' ? C.cyan
    : consistency.grade === 'C' ? C.warning
    : C.danger;
  const gradeCaption =
    consistency.grade === 'S' ? 'Rock solid. You almost always walk away.'
    : consistency.grade === 'A' ? 'Strong. Most days you walk away.'
    : consistency.grade === 'B' ? 'Solid. More wins than slips.'
    : consistency.grade === 'C' ? 'Building. Every walk-away counts.'
    : 'Rough stretch. A bad day doesn\'t erase progress.';

  // Week-over-week delta — compare this week vs last 7 days prior
  const MS_PER_DAY = 86_400_000;
  const lastWeekTotal = Array.from({ length: 7 }, (_, i) => {
    const d = getLocalDateKey(new Date(Date.now() - (7 + i) * MS_PER_DAY));
    return dailyWalkAways[d] ?? 0;
  }).reduce((a, b) => a + b, 0);
  const weekDelta = totalThisWeek - lastWeekTotal;

  // Follow-through rate by commitment label (only labels seen ≥2 times)
  const followThroughByLabel: Record<string, { total: number; completed: number }> = {};
  for (const e of followThroughLog) {
    if (!followThroughByLabel[e.text]) followThroughByLabel[e.text] = { total: 0, completed: 0 };
    followThroughByLabel[e.text].total++;
    if (e.completed) followThroughByLabel[e.text].completed++;
  }
  const ftEntries = Object.entries(followThroughByLabel)
    .filter(([, { total }]) => total >= 2)
    .sort((a, b) => b[1].total - a[1].total);
  const gamesThisWeek  = weeklyActivity.reduce((a, b) => a + b, 0);

  // Feeling breakdown
  const totalReflections = Object.values(reflectionCounts).reduce((a, b) => a + b, 0);

  // Peak hour
  const totalOpenEvents = hourlyOpenCounts.reduce((a, b) => a + b, 0);
  const peakHour        = totalOpenEvents > 0
    ? hourlyOpenCounts.indexOf(Math.max(...hourlyOpenCounts))
    : -1;
  const maxHourCount    = Math.max(...HEATMAP_HOURS.map(h => hourlyOpenCounts[h] ?? 0), 1);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={C.textMuted} />
          </Pressable>
          <Text style={[styles.title, { color: C.textPrimary }]}>Your Insights</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* ── All-time summary ──────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <SummaryCard num={gamesPlayed}     label={'games\nplayed'}      color={C.purple}  />
          <SummaryCard num={totalThisWeek}   label={'walk-aways\nthis week'} color={C.cyan} />
          <SummaryCard num={longestStreak}   label={'longest\nstreak'}    color={C.warning} />
        </View>

        {/* ── 30-day consistency ────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: consistency.daysActive > 0 ? gradeColor + '44' : C.cardBorder, backgroundColor: C.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Consistency</Text>
            <Text style={[styles.cardSub, { color: C.textMuted }]}>last 30 days</Text>
          </View>
          {consistency.daysActive === 0 ? (
            <Text style={[styles.cardSub, { color: C.textMuted, lineHeight: 18 }]}>
              Not enough data yet. This fills in once the gate has stepped in on a few days.
            </Text>
          ) : (
            <>
              <View style={styles.consistencyRow}>
                <View style={[styles.gradeBadge, { backgroundColor: gradeColor + '1c', borderColor: gradeColor + '55' }]}>
                  <Text style={[styles.gradeLetter, { color: gradeColor }]}>{consistency.grade}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.consistencyScore, { color: C.textPrimary }]}>{consistency.score}%</Text>
                  <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                    Walked away on {consistency.daysWon} of {consistency.daysActive} {consistency.daysActive === 1 ? 'day' : 'days'} the gate stepped in
                  </Text>
                </View>
              </View>
              <View style={[styles.consistencyTrack, { backgroundColor: C.border }]}>
                <View style={[styles.consistencyFill, { width: `${consistency.score}%`, backgroundColor: gradeColor }]} />
              </View>
              <Text style={[styles.cardSub, { color: C.textMuted, marginTop: SPACING.sm }]}>
                {consistency.daysActive < 7 ? 'Early read — it gets more accurate as you go. ' : ''}{gradeCaption}
              </Text>
            </>
          )}
        </View>

        {/* ── Since you started ─────────────────────────────────────────── */}
        {walkAwayCount > 0 && (
          <View style={[styles.card, { borderColor: C.green + '44', backgroundColor: C.surface }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Since you started</Text>
            <View style={styles.sinceGrid}>
              <SinceStat
                icon="shield"
                color={C.green}
                value={String(walkAwayCount)}
                label="walk-aways"
              />
              <SinceStat
                icon="clock"
                color={C.cyan}
                value={timeSavedLabel}
                label="est. time saved"
              />
              <SinceStat
                icon="calendar"
                color={C.purple}
                value={String(activeDayCount)}
                label="active days"
              />
              {streak >= 1 && (
                <SinceStat
                  icon="trending-up"
                  color={C.warning}
                  value={String(streak)}
                  label="day streak"
                />
              )}
            </View>
            {firstDayLabel && (
              <View style={[styles.sinceSince, { borderTopColor: C.border }]}>
                <Feather name="flag" size={11} color={C.textMuted} />
                <Text style={[styles.sinceSinceText, { color: C.textMuted }]}>
                  First active: {firstDayLabel}
                </Text>
              </View>
            )}
            {walkAwayCount >= 10 && (
              <View style={[styles.insightCallout, { backgroundColor: C.surface, borderColor: C.green + '44' }]}>
                <Feather name="award" size={13} color={C.green} />
                <Text style={[styles.insightCalloutText, { color: C.textSecondary }]}>
                  {walkAwayCount >= 100
                    ? `${walkAwayCount} walk-aways. You've genuinely changed a habit.`
                    : walkAwayCount >= 50
                    ? `${walkAwayCount} walk-aways. The pattern is breaking.`
                    : `${walkAwayCount} walk-aways. Keep going — the first 50 are the hardest.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Walk-away bar chart ───────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: C.cardBorder, backgroundColor: C.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Walk-aways this week</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {lastWeekTotal > 0 && (
                <Text style={[styles.cardSub, {
                  color: weekDelta > 0 ? C.green : weekDelta < 0 ? C.warning : C.textMuted,
                }]}>
                  {weekDelta > 0 ? `+${weekDelta}` : weekDelta === 0 ? '=' : weekDelta} vs last wk
                </Text>
              )}
              <Text style={[styles.cardSub, { color: C.textMuted }]}>{totalThisWeek} total</Text>
            </View>
          </View>
          <View style={styles.barRow}>
            {walkAwayWeek.map((val, i) => {
              const barH = (val / maxWalkAway) * MAX_BAR_HEIGHT;
              return (
                <View key={i} style={styles.barWrapper}>
                  {val > 0 && <Text style={[styles.barValue, { color: C.textMuted }]}>{val}</Text>}
                  <View style={[styles.barTrack, { backgroundColor: C.border }]}>
                    <View style={[styles.barFill, { height: barH, backgroundColor: i === 6 ? C.green : C.green + '55' }]} />
                  </View>
                  <Text style={[styles.dayLabel, { color: i === 6 ? C.green : C.textMuted }]}>{weekDays[i].label}</Text>
                </View>
              );
            })}
          </View>
          {gamesThisWeek > 0 && (
            <Text style={[styles.cardNote, { color: C.textMuted }]}>
              {gamesThisWeek} game{gamesThisWeek !== 1 ? 's' : ''} played this week
            </Text>
          )}
        </View>

        {/* ── Feeling breakdown ─────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: C.cardBorder, backgroundColor: C.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>What triggers you</Text>
            <Text style={[styles.cardSub, { color: C.textMuted }]}>
              {totalReflections > 0 ? `${totalReflections} logged` : 'No data yet'}
            </Text>
          </View>
          {totalReflections === 0 ? (
            <Text style={[styles.emptyHint, { color: C.textMuted }]}>
              Tap a feeling after walking away — the pattern shows up here.
            </Text>
          ) : (
            <View style={styles.feelingList}>
              {FEELINGS.map((f) => {
                const count = reflectionCounts[f.id] ?? 0;
                const pct   = totalReflections > 0 ? count / totalReflections : 0;
                return (
                  <View key={f.id} style={styles.feelingRow}>
                    <Text style={styles.feelingEmoji}>{f.emoji}</Text>
                    <View style={styles.feelingBarWrap}>
                      <View style={styles.feelingLabelRow}>
                        <Text style={[styles.feelingLabel, { color: C.textSecondary }]}>{f.label}</Text>
                        <Text style={[styles.feelingCount, { color: C.textMuted }]}>{count}×</Text>
                      </View>
                      <View style={[styles.feelingTrack, { backgroundColor: C.border }]}>
                        <View style={[styles.feelingFill, { width: `${pct * 100}%`, backgroundColor: f.color }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Peak hour heatmap ─────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: C.cardBorder, backgroundColor: C.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>When urges hit hardest</Text>
            {peakHour >= 0 && (
              <Text style={[styles.cardSub, { color: C.warning }]}>peak: {hourLabel(peakHour)}</Text>
            )}
          </View>
          {totalOpenEvents === 0 ? (
            <Text style={[styles.emptyHint, { color: C.textMuted }]}>
              Data builds as you use NoGoon — check back soon.
            </Text>
          ) : (
            <>
              <View style={styles.heatmapRow}>
                {HEATMAP_HOURS.map((h) => {
                  const count   = hourlyOpenCounts[h] ?? 0;
                  const opacity = 0.12 + (count / maxHourCount) * 0.88;
                  const isPeak  = peakHour >= h && peakHour < h + 3;
                  return (
                    <View key={h} style={styles.heatCell}>
                      <View
                        style={[
                          styles.heatBlock,
                          { backgroundColor: isPeak ? C.warning : C.cyan, opacity },
                        ]}
                      />
                      <Text style={[styles.heatLabel, { color: C.textMuted }]}>{hourLabel(h)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.insightCallout, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
                <Feather name="zap" size={13} color={C.warning} />
                <Text style={[styles.insightCalloutText, { color: C.textSecondary }]}>
                  Strongest urge window:{' '}
                  <Text style={{ color: C.warning, fontFamily: FONTS.bodyBold }}>{hourLabel(peakHour)}</Text>.
                  {' '}A block schedule or wind-down mode set for that window can cut the pull significantly.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Streak callout ────────────────────────────────────────────── */}
        {streak >= 3 && (
          <View style={[styles.card, { borderColor: C.green + '44', backgroundColor: C.surface }]}>
            <View style={styles.streakRow}>
              <Text style={{ fontSize: 28 }}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{streak}-day streak</Text>
                <Text style={[styles.emptyHint, { color: C.textSecondary, marginTop: 4 }]}>
                  {streak >= 30
                    ? 'Legendary. You\'re literally rewiring your habits.'
                    : streak >= 14
                    ? 'Two weeks. The pathways are firming up.'
                    : 'Building momentum — walk away keeps the streak alive.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── What pulls you in (urge tag analysis) ─────────────────────── */}
        {tagEntries.length > 0 && (
          <View style={[styles.card, { borderColor: C.cardBorder, backgroundColor: C.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: C.textPrimary }]}>What pulls you in</Text>
              <Text style={[styles.cardSub, { color: C.textMuted }]}>{recentUrges.length} tagged</Text>
            </View>
            <View style={{ gap: SPACING.sm }}>
              {tagEntries.map(([tag, count]) => {
                const pct = count / maxTagCount;
                return (
                  <View key={tag} style={styles.feelingRow}>
                    <View style={styles.feelingBarWrap}>
                      <View style={styles.feelingLabelRow}>
                        <Text style={[styles.feelingLabel, { color: C.textSecondary }]}>{tag}</Text>
                        <Text style={[styles.feelingCount, { color: C.textMuted }]}>{count}×</Text>
                      </View>
                      <View style={[styles.feelingTrack, { backgroundColor: C.border }]}>
                        <View style={[styles.feelingFill, { width: `${pct * 100}%`, backgroundColor: C.indigoBright }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
            {domainInsights.length > 0 && (
              <View style={{ gap: 6, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={[styles.cardSub, { color: C.textMuted, marginBottom: 2 }]}>BY APP</Text>
                {domainInsights.map(({ domain: dom, topTag, pct }) => (
                  <View key={dom} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: C.textSecondary }}>{dom}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: C.textMuted }}>
                      {pct}% {topTag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Urge journal (last 5 entries) ─────────────────────────────── */}
        {urgeJournal.length > 0 && (
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary, marginBottom: SPACING.sm }]}>
              Recent Urges
            </Text>
            {urgeJournal.slice(0, 5).map((entry, i, arr) => {
              const d = new Date(entry.timestamp);
              const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: C.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      backgroundColor: C.indigoBright + '22',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 20,
                    }}>
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: C.indigoBright }}>
                        {entry.tag}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: C.textMuted }}>
                      {entry.domain}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: C.textMuted }}>
                    {date} {time}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── What you chose instead (commitments, last 7 days) ─────────── */}
        {commitmentEntries.length > 0 && (
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary, marginBottom: SPACING.sm }]}>
              What you chose instead
            </Text>
            <Text style={[styles.cardSub, { color: C.textMuted, marginBottom: SPACING.md }]}>
              Last 7 days · {recentCommitments.length} commitment{recentCommitments.length === 1 ? '' : 's'}
            </Text>
            {commitmentEntries.map(([label, count], i) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: i < commitmentEntries.length - 1 ? 1 : 0,
                  borderBottomColor: C.border,
                }}
              >
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: C.textSecondary }}>
                  {label}
                </Text>
                <View style={{
                  backgroundColor: C.green + '22',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 20,
                }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: C.green }}>
                    ×{count}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Follow-through rate ───────────────────────────────────── */}
        {ftEntries.length > 0 && (
          <View style={[styles.card, { borderColor: C.cardBorder, backgroundColor: C.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Follow-through rate</Text>
              <Text style={[styles.cardSub, { color: C.textMuted }]}>{followThroughLog.length} checked</Text>
            </View>
            <View style={{ gap: SPACING.sm }}>
              {ftEntries.map(([label, { total, completed }]) => {
                const rate = Math.round((completed / total) * 100);
                return (
                  <View key={label} style={styles.feelingRow}>
                    <View style={styles.feelingBarWrap}>
                      <View style={styles.feelingLabelRow}>
                        <Text style={[styles.feelingLabel, { color: C.textSecondary }]}>{label}</Text>
                        <Text style={[styles.feelingCount, { color: rate >= 70 ? C.green : C.textMuted }]}>
                          {rate}%
                        </Text>
                      </View>
                      <View style={[styles.feelingTrack, { backgroundColor: C.border }]}>
                        <View
                          style={[styles.feelingFill, {
                            width: `${rate}%`,
                            backgroundColor: rate >= 70 ? C.green : C.warning,
                          }]}
                        />
                      </View>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: C.textMuted }}>
                        {completed}/{total} followed through
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SummaryCard({ num, label, color }: { num: number; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summaryCard, { borderColor: color + '44', backgroundColor: colors.surface }]}>
      <Text style={[styles.summaryNum, { color }]}>{num}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SinceStat({ icon, color, value, label }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sinceStat, { backgroundColor: colors.surfaceHigh }]}>
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.sinceValue, { color }]}>{value}</Text>
      <Text style={[styles.sinceLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  consistencyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  gradeBadge: { width: 56, height: 56, borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gradeLetter: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 36 },
  consistencyScore: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 32 },
  consistencyTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  consistencyFill: { height: 8, borderRadius: 4 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: 0.2,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  summaryNum: {
    fontFamily: FONTS.monoBold,
    fontSize: 26,
    lineHeight: 30,
  },
  summaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 14,
  },

  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
  },
  cardSub: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  cardNote: {
    fontFamily: FONTS.body,
    fontSize: 12,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
  },

  // Bar chart
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: MAX_BAR_HEIGHT + 30,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: { fontFamily: FONTS.mono, fontSize: 10, marginBottom: 3 },
  barTrack: {
    width: 18,
    height: MAX_BAR_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 4 },
  dayLabel: { fontFamily: FONTS.mono, fontSize: 10, marginTop: SPACING.xs },

  // Feeling breakdown
  feelingList: { gap: SPACING.sm },
  feelingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feelingEmoji: { fontSize: 20, width: 28 },
  feelingBarWrap: { flex: 1, gap: 4 },
  feelingLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  feelingLabel: { fontFamily: FONTS.body, fontSize: 13 },
  feelingCount: { fontFamily: FONTS.mono, fontSize: 11 },
  feelingTrack: { height: 6, borderRadius: RADIUS.full, overflow: 'hidden' },
  feelingFill: { height: '100%', borderRadius: RADIUS.full },

  // Heatmap
  heatmapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 3 },
  heatCell: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  heatBlock: { width: '100%', height: 34, borderRadius: RADIUS.sm },
  heatLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.2 },

  // Insight callout
  insightCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  insightCalloutText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
  },

  // Streak callout
  streakRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },

  // Since you started
  sinceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sinceStat: {
    flex: 1,
    minWidth: '40%',
    alignItems: 'center',
    gap: 3,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  sinceValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    lineHeight: 24,
  },
  sinceLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sinceSince: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  sinceSinceText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
