// ─── Feed — one good thing a day ──────────────────────────────────────────────
//
// A calm destination tab (new layout only). Shows today's finite batch (up to five) of
// positive stories from the `feed_items` table, with a link out to each source. Falls back to
// the older `positive-news` function. Cached per day. Journal and Brain Bubbles live here too.

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { getTodaysGood, type GoodItem } from '@/lib/dailyGood';
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
  const { colors, cardStyle } = useTheme();
  const [items, setItems] = useState<GoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    const list = await getTodaysGood();
    setItems(list);
    setFailed(list.length === 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>One good thing today</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>A small batch arrives each day. When it's done, it's done.</Text>

      {loading && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {!loading && items.map((item, i) => (
        <View key={`${item.headline}-${i}`} style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.headline, i > 0 && styles.headlineSmall, { color: colors.text }]}>{item.headline}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.summary}</Text>
          <View style={styles.sourceRow}>
            {item.source ? <Text style={[styles.source, { color: colors.textMuted }]}>{item.source}</Text> : <View />}
            {item.url ? (
              <Pressable onPress={() => Linking.openURL(item.url!).catch(() => {})} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Read the full story from ${item.source}`}>
                <Text style={[styles.btnText, { color: colors.accent }]}>Read more</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {!loading && items.length > 0 && (
        <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>That's everything for today. See you tomorrow.</Text>
      )}
      {!loading && failed && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Couldn't fetch today's good news. Good things are still happening out there, and you're protecting your time.
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
        { icon: 'edit-3' as const,    label: 'Brain Bubbles', body: 'Dump the noise onto a canvas.', go: () => router.push('/bubbles' as any) },
        { icon: 'bar-chart-2' as const, label: 'Insights', body: 'Your patterns, kindly told.', go: () => router.push('/insights' as any) },
      ].map((r) => (
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
