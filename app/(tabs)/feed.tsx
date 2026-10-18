// ─── Briefing — the calm daily replacement for the feed ───────────────────────
//
// A finite, once-a-day destination (new layout only). Sections, each with a hard cap:
//   Good news          uplifting stories
//   What people are looking up   most-read topics (Wikipedia), described in plain words
//   Major news         calm summaries, ONLY if the user opted in (Me > Customize)
//   Your turn          a journal prompt, Journal, Happening near you, and The Wall
// Length is the reader's choice (toggle at the top): "20 stories" caps the day at 20 and ends,
// "Endless" keeps loading older stories as you scroll. Every item links to its source.

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { getTodaysBriefing, getOlderStories, type Briefing, type GoodItem } from '@/lib/dailyGood';
import { useBriefingPrefs } from '@/stores/useBriefingPrefs';
import { usePackStore } from '@/stores/usePackStore';
import { useOfferStore } from '@/stores/useOfferStore';
import { FONTS } from '@/constants/Colors';
import { ConstructionBadge, ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { isLightColor } from '@/utils/colorLuminance';
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
  const length = useBriefingPrefs((s) => s.length);
  const setLength = useBriefingPrefs((s) => s.setLength);
  const endless = length === 'endless';
  const [older, setOlder] = useState<GoodItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    const b = await getTodaysBriefing();
    setBrief(b);
    setFailed(b.good.length + b.curious.length + b.world.length === 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Endless: pull older stories a page at a time. Switching back to 20 clears them.
  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted || loading) return;
    setLoadingMore(true);
    const before = brief.day ?? new Date().toISOString().slice(0, 10);
    const page = await getOlderStories(before, older.length, showWorldNews);
    if (page.length === 0) setExhausted(true);
    else setOlder((cur) => [...cur, ...page]);
    setLoadingMore(false);
  }, [loadingMore, exhausted, loading, brief.day, older.length, showWorldNews]);

  useEffect(() => {
    if (!endless) { setOlder([]); setExhausted(false); }
  }, [endless]);
  // First page of older stories as soon as today's batch is on screen.
  useEffect(() => {
    if (endless && !loading && !failed && older.length === 0 && !exhausted) loadMore();
  }, [endless, loading, failed, older.length, exhausted, loadMore]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!endless) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y > contentSize.height - 700) loadMore();
  };

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
          {title === 'Good news' && UNDER_CONSTRUCTION.goodNews ? <ConstructionBadge label="Sample stories for now" /> : null}
          {hint ? <Text style={[styles.sub, { color: colors.textMuted }]}>{hint}</Text> : null}
        </View>
        {items.map((it, i) => <Story key={`${it.headline}-${i}`} item={it} big={title === 'Good news' && i === 0} />)}
      </View>
    )
  );

  // "20 stories" mode caps the day at 20 (good news first, major news last). Endless shows the whole batch.
  const cap = (list: GoodItem[], room: number) => (endless ? list : list.slice(0, Math.max(0, room)));
  const good = cap(brief.good, 20);
  const curious = cap(brief.curious, 20 - good.length);
  const world = showWorldNews ? cap(brief.world, 20 - good.length - curious.length) : [];
  const total = good.length + curious.length + world.length;

  const yourTurn = (
    <>
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
        { icon: 'book-open' as const, label: 'Journal', body: 'Colourful pages, stickers, doodles and thought bubbles for your head. Everything stays on your phone.', go: () => router.push('/journal' as any) },
        { icon: 'map-pin' as const,   label: 'Happening near you', body: 'Farmers markets, volunteering and community events.', go: () => router.push('/events' as any) },
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
            {((r.label === 'The Wall' && UNDER_CONSTRUCTION.wall) || (r.label === 'Happening near you' && UNDER_CONSTRUCTION.events)) ? (
              <View style={{ marginTop: 6 }}><ConstructionBadge /></View>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content} onScroll={onScroll} scrollEventThrottle={200}>
      <Text style={[styles.title, { color: colors.text }]}>Today's briefing</Text>
      {UNDER_CONSTRUCTION.goodNews ? <View style={{ alignSelf: 'flex-start' }}><ConstructionBadge label="Still being built" /></View> : null}
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {endless ? 'Keeps loading older stories as you scroll.' : "A small batch, once a day. When it's done, it's done."}
      </Text>
      <View style={[styles.seg, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}>
        {([['twenty', 'Up to 20'], ['endless', 'Endless']] as const).map(([id, label]) => {
          const on = length === id;
          return (
            <Pressable
              key={id}
              onPress={() => setLength(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={id === 'twenty' ? 'Up to twenty stories a day, then it ends' : 'Endless scrolling'}
              style={[styles.segBtn, on && { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.segText, { color: on ? (isLightColor(colors.accent) ? '#111111' : '#fff') : colors.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && <Section title="Good news" items={good} />}
      {!loading && <Section title="What people are looking up" hint="The topics the world got curious about yesterday." items={curious} />}
      {!loading && showWorldNews && <Section title="Major news" hint="Calm and factual. A few items, then it ends." items={world} />}
      {!loading && !showWorldNews && (
        <Pressable onPress={() => router.push('/customize' as any)} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Major news is off. You can add a short, calm summary in Customize.</Text>
        </Pressable>
      )}

      {!loading && total > 0 && !endless && (
        <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>That's everything for today. See you tomorrow.</Text>
      )}
      {!loading && failed && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {UNDER_CONSTRUCTION.goodNews ? <ConstructionSign note="The daily briefing isn't switched on yet." /> : null}
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Couldn't fetch today's briefing. Good things are still happening out there, and you're protecting your time.
          </Text>
          <Pressable onPress={load} style={[styles.btn, { borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.text }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {yourTurn}
      {endless && !loading && !failed && (
        <View style={{ gap: SPACING.sm }}>
          <Text style={[styles.section, { color: colors.textMuted }]}>Earlier stories</Text>
          {older.map((it, i) => <Story key={`${it.url ?? it.headline}-${i}`} item={it} />)}
          {loadingMore && <ActivityIndicator color={colors.accent} />}
          {exhausted && (
            <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>That's everything we have stored right now. Fresh stories arrive tomorrow.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  seg:      { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, alignSelf: 'flex-start' },
  segBtn:   { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 999 },
  segText:  { fontFamily: FONTS.bodyBold, fontSize: 13 },
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
