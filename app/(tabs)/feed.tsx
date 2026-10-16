// ─── Briefing — the calm daily replacement for the feed ───────────────────────
//
// A finite, once-a-day destination (new layout only). Sections, each with a hard cap:
//   Good news          up to 5 uplifting stories
//   What people are looking up   up to 4 most-read topics (Wikipedia), described in plain words
//   Major news         up to 4 calm summaries, ONLY if the user opted in (Me > Customize)
//   Your turn          a journal prompt, Journal, and The Wall (Bubbles, Insights, games live in Unwind)
// Every item links to its source. When the sections end, the briefing ends.

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { getTodaysBriefing, type Briefing, type GoodItem } from '@/lib/dailyGood';
import { usePackStore } from '@/stores/usePackStore';
import { useOfferStore } from '@/stores/useOfferStore';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const PROMPTS = [
  "What's one thing you did instead of scrolling?",
  'What were you really looking for the last time you reached for your phone?',
  'Name one thing that went right today, however small.',
  'What would you like to be doing with the time you got back?',
  'Who could you message today who would be glad to hear from you?',
  'What does your body need right now?',
  'What is one thing you are proud of this week?',
];
const todaysPrompt = () => PROMPTS[Math.floor(Date.now() / 86400000) % PROMPTS.length];

export default function FeedScreen() {
  const showSponsors = useOfferStore((s) => s.showSponsors);
  const { colors, cardStyle } = useTheme();
  const showWorldNews = usePackStore((s) => s.showWorldNews);
  const [brief, setBrief] = useState<Briefing>({ good: [], curious: [], world: [] });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    const b = await getTodaysBriefing();
    setBrief(b);
    setFailed(b.good.length + b.curious.length + b.world.length === 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (url?: string) => { if (url) Linking.openURL(url).catch(() => {}); };

  const Story = ({ item, big }: { item: GoodItem; big?: boolean }) => (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, minHeight: 0 }]}>
      <Text style={[styles.headline, !big && styles.headlineSmall, { color: colors.text }]}>{item.headline}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{item.summary}</Text>
      <View style={styles.sourceRow}>
        {item.source ? <Text style={[styles.source, { color: colors.textMuted }]}>{item.source}</Text> : <View />}
        {item.url ? (
          <Pressable onPress={() => open(item.url)} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Read more from ${item.source}`}>
            <Text style={[styles.btnText, { color: colors.accent }]}>Read more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const Section = ({ title, hint, items }: { title: string; hint?: string; items: GoodItem[] }) => (
    items.length === 0 ? null : (
      <View style={{ gap: SPACING.sm }}>
        <View>
          <Text style={[styles.section, { color: colors.textMuted }]}>{title}</Text>
          {hint ? <Text style={[styles.sub, { color: colors.textMuted }]}>{hint}</Text> : null}
        </View>
        {items.map((it, i) => <Story key={`${it.headline}-${i}`} item={it} big={title === 'Good news' && i === 0} />)}
      </View>
    )
  );

  const total = brief.good.length + brief.curious.length + (showWorldNews ? brief.world.length : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Today's briefing</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>A small batch, once a day. When it's done, it's done.</Text>

      {loading && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && <Section title="Good news" items={brief.good} />}
      {!loading && <Section title="What people are looking up" hint="The topics the world got curious about yesterday." items={brief.curious} />}
      {!loading && showWorldNews && <Section title="Major news" hint="Calm and factual. A few items, then it ends." items={brief.world} />}
      {!loading && !showWorldNews && (
        <Pressable onPress={() => router.push('/customize' as any)} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Major news is off. You can add a short, calm summary in Customize.</Text>
        </Pressable>
      )}

      {!loading && total > 0 && (
        <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>That's everything for today. See you tomorrow.</Text>
      )}
      {!loading && failed && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Couldn't fetch today's briefing. Good things are still happening out there, and you're protecting your time.
          </Text>
          <Pressable onPress={load} style={[styles.btn, { borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.text }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      <Text style={[styles.section, { color: colors.textMuted }]}>Your turn</Text>
      <Pressable
        onPress={() => router.push('/journal' as any)}
        style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, minHeight: 0 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.headline, styles.headlineSmall, { color: colors.text }]}>{todaysPrompt()}</Text>
        <Text style={[styles.btnText, { color: colors.accent }]}>Write it down</Text>
      </Pressable>
      {[
        { icon: 'book-open' as const, label: 'Journal', body: 'Log an urge or a win. Everything you write stays here.', go: () => router.push('/journal' as any) },
        { icon: 'grid' as const,      label: 'The Wall', body: 'Sponsored. Local businesses and makers. Only when you choose to look.', go: () => router.push('/wall' as any) },
      ].filter((r) => showSponsors || r.label !== 'The Wall').map((r) => (
        <Pressable
          key={r.label}
          onPress={r.go}
          style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
        >
          <Feather name={r.icon} size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{r.label}</Text>
            <Text style={[styles.rowBody, { color: colors.textSecondary }]}>{r.body}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:  { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  title:    { fontFamily: FONTS.display, fontSize: 26 },
  sub:      { fontFamily: FONTS.body, fontSize: 13 },
  card:     { padding: SPACING.lg, gap: SPACING.sm, minHeight: 120, justifyContent: 'center' },
  headline: { fontFamily: FONTS.bodyBold, fontSize: 19, lineHeight: 26 },
  body:     { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
  headlineSmall: { fontSize: 16, lineHeight: 22 },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  source:   { fontFamily: FONTS.body, fontSize: 12 },
  btn:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  btnText:  { fontFamily: FONTS.bodyBold, fontSize: 13 },
  section:  { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  row:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  rowBody:  { fontFamily: FONTS.body, fontSize: 12.5 },
});
