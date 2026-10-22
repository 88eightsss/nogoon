// ─── Briefing — the calm daily replacement for the feed ───────────────────────
//
// A finite, once-a-day destination (new layout only). Sections, each with a hard cap:
//   Good news          uplifting stories
//   What people are looking up   most-read topics (Wikipedia), described in plain words
//   Major news         calm summaries, ONLY if the user opted in (Me > Customize)
//   Your turn          a journal prompt, Journal, Happening near you, and The Wall
// Length is the reader's choice (toggle at the top): "20 stories" caps the day at 20 and ends,
// "Endless" keeps loading older stories as you scroll. Every item links to its source.

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, Platform, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { getLocalDateKey } from '@/utils/date';

const EMPTY_READ: string[] = [];
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

type Kind = 'good' | 'curious' | 'world';
const KIND_ICON: Record<Kind, ComponentProps<typeof Feather>['name']> = { good: 'sun', curious: 'search', world: 'globe' };

// The Briefing is deliberately styled like clippings from a news site, not like the rest of the app,
// so it feels like a place to read rather than another app to scroll. Serif headlines, a masthead
// line with the publisher, a thin rule, "x sec read", and a link out to the real article.
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const paperFor = (light: boolean) => light
  ? { bg: '#FAF8F3', ink: '#1B1A17', sub: '#4A4740', rule: '#DDD8CA', muted: '#7E796E' }
  : { bg: '#1E1E20', ink: '#EEEBE4', sub: '#B9B5AB', rule: '#3A3A3E', muted: '#8C887F' };
const readTime = (it: GoodItem) => {
  const secs = Math.max(10, Math.round(`${it.headline} ${it.summary}`.split(/\s+/).length / 3.8));
  return secs < 60 ? `${Math.ceil(secs / 5) * 5} sec read` : `${Math.round(secs / 60)} min read`;
};
const storyKey = (it: GoodItem) => it.url ?? it.headline;

// Photos on every other story that has one (1st, 3rd, 5th ...), so the page stays calm and text-first.
const photoFlags = (items: GoodItem[]) => { let n = 0; return items.map((it) => (it.image ? n++ % 2 === 0 : false)); };

function Story({ item, big, tint, photo }: { item: GoodItem; big?: boolean; tint: string; photo?: boolean }) {
  const { colors } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);
  const paper = paperFor(isLightColor(colors.background));
  const key = storyKey(item);
  const today = getLocalDateKey();
  const read = useBriefingPrefs((s) => s.readDay === today && s.read.includes(key));
  const markRead = useBriefingPrefs((s) => s.markRead);
  const url = item.url;
  const go = () => { markRead(key); if (url) Linking.openURL(url).catch(() => {}); };
  const letter = (item.source || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <Pressable
      onPress={go}
      accessibilityRole={url ? 'link' : 'button'}
      accessibilityLabel={`${item.headline}. ${item.source ? `From ${item.source}. ` : ''}${read ? 'Already read. ' : ''}${url ? 'Opens the article.' : ''}`}
      style={[styles.clip, { backgroundColor: paper.bg, borderColor: paper.rule }, read && { opacity: 0.6 }]}
    >
      <View style={[styles.mast, { borderBottomColor: paper.rule }]}>
        <View style={[styles.monogram, { backgroundColor: tint }]}>
          <Text style={[styles.monogramLetter, { color: isLightColor(tint) ? '#111111' : '#FFFFFF' }]}>{letter}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.mastName, { color: paper.muted }]}>{(item.source || 'Source').toUpperCase()}</Text>
        {read
          ? <Feather name="check-circle" size={15} color={tint} />
          : <Text style={[styles.mastTag, { color: paper.muted }]}>{readTime(item)}</Text>}
      </View>
      {photo && item.image && !imgFailed ? (
        <View>
          <Image
            source={{ uri: item.image }}
            style={[styles.photo, { backgroundColor: paper.rule }]}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            recyclingKey={item.image}
            onError={() => setImgFailed(true)}
            accessible={false}
          />
          {item.imageCredit ? <Text style={[styles.photoCredit, { color: paper.muted }]}>Photo: {item.imageCredit}</Text> : null}
        </View>
      ) : null}
      <Text style={[styles.clipHead, big && styles.clipHeadBig, { color: paper.ink, fontFamily: SERIF }]}>{item.headline}</Text>
      <Text style={[styles.clipBody, { color: paper.sub }]} numberOfLines={big ? undefined : 4}>{item.summary}</Text>
      {url ? (
        <View style={styles.readRow}>
          <Text style={[styles.readLink, { color: tint }]}>Read the full article</Text>
          <Feather name="arrow-up-right" size={14} color={tint} />
        </View>
      ) : null}
    </Pressable>
  );
}

function Section({ title, hint, items, kind }: { title: string; hint?: string; items: GoodItem[]; kind: Kind }) {
  const { colors } = useTheme();
  if (items.length === 0) return null;
  const tint = kind === 'good' ? colors.warning : colors.accent;
  const flags = photoFlags(items);
  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ gap: 4 }}>
        <View style={styles.rubric}>
          <View style={[styles.rubricLine, { backgroundColor: colors.cardBorder }]} />
          <Feather name={KIND_ICON[kind]} size={13} color={tint} />
          <Text style={[styles.rubricTitle, { color: colors.textMuted }]}>{title}</Text>
          <View style={[styles.rubricLine, { backgroundColor: colors.cardBorder }]} />
        </View>
        {kind === 'good' && UNDER_CONSTRUCTION.goodNews ? <View style={{ alignSelf: 'center' }}><ConstructionBadge label="Sample stories for now" /></View> : null}
        {hint ? <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>{hint}</Text> : null}
      </View>
      {items.map((it, i) => <Story key={`${storyKey(it)}-${i}`} item={it} big={kind === 'good' && i === 0} tint={tint} photo={flags[i]} />)}
    </View>
  );
}

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

  // "20 stories" mode caps the day at 20 (good news first, major news last). Endless shows the whole batch.
  const cap = (list: GoodItem[], room: number) => (endless ? list : list.slice(0, Math.max(0, room)));
  const good = cap(brief.good, 20);
  const curious = cap(brief.curious, 20 - good.length);
  const world = showWorldNews ? cap(brief.world, 20 - good.length - curious.length) : [];
  const total = good.length + curious.length + world.length;
  const todayKey = getLocalDateKey();
  const readKeys = useBriefingPrefs((st) => (st.readDay === todayKey ? st.read : EMPTY_READ));
  const readCount = useMemo(
    () => [...good, ...curious, ...world].filter((it) => readKeys.includes(storyKey(it))).length,
    [good, curious, world, readKeys],
  );
  const caughtUp = total > 0 && readCount >= total;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

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
      <Text style={[styles.dateLine, { color: colors.textMuted }]}>{dateLine.toUpperCase()}</Text>
      <Text style={[styles.title, { color: colors.text, fontFamily: SERIF }]}>Today's briefing</Text>
      {UNDER_CONSTRUCTION.goodNews ? <View style={{ alignSelf: 'flex-start' }}><ConstructionBadge label="Still being built" /></View> : null}
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {endless ? 'Keeps loading older stories as you scroll.' : total > 0 ? `${total} ${total === 1 ? 'story' : 'stories'} today. When it's done, it's done.` : "A small batch, once a day. When it's done, it's done."}
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

      {!loading && brief.stale && (
        <View style={[styles.offline, { borderColor: colors.cardBorder, backgroundColor: colors.surfaceHigh }]}>
          <Feather name="wifi-off" size={14} color={colors.textMuted} />
          <Text style={[styles.sub, { color: colors.textSecondary, flex: 1 }]}>
            {`Couldn't reach the internet. Showing the last briefing${brief.day ? ` from ${brief.day}` : ''}.`}
          </Text>
          <Pressable onPress={load} accessibilityRole="button" hitSlop={8}><Text style={[styles.btnText, { color: colors.accent }]}>Retry</Text></Pressable>
        </View>
      )}

      {!loading && !endless && total > 0 && (
        <View style={{ gap: 6 }} accessible accessibilityLabel={`${readCount} of ${total} stories read`}>
          <View style={styles.progress}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.progressSeg, { backgroundColor: i < readCount ? colors.accent : colors.cardBorder }]} />
            ))}
          </View>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{readCount} of {total} read</Text>
        </View>
      )}

      {loading && (
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && <Section kind="good" title="Good news" items={good} />}
      {!loading && <Section kind="curious" title="What people are looking up" hint="The topics the world got curious about yesterday." items={curious} />}
      {!loading && showWorldNews && <Section kind="world" title="Major news" hint="Calm and factual. A few items, then it ends." items={world} />}
      {!loading && !showWorldNews && (
        <Pressable onPress={() => router.push('/customize' as any)} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Major news is off. You can add a short, calm summary in Customize.</Text>
        </Pressable>
      )}

      {!loading && total > 0 && !endless && (
        caughtUp ? (
          <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, minHeight: 0, alignItems: 'center' }]}>
            <Feather name="sunrise" size={22} color={colors.accent} />
            <Text style={[styles.headline, styles.headlineSmall, { color: colors.text, fontFamily: SERIF, textAlign: 'center' }]}>You're all caught up.</Text>
            <Text style={[styles.body, { color: colors.textSecondary, textAlign: 'center' }]}>That was the whole paper for today. Put the phone down. It will all still be here tomorrow.</Text>
          </View>
        ) : (
          <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>That's everything for today. See you tomorrow.</Text>
        )
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
          {(() => { const flags = photoFlags(older); return older.map((it, i) => <Story key={`${storyKey(it)}-${i}`} item={it} tint={colors.accent} photo={flags[i]} />); })()}
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
  title:    { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  dateLine: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.4 },
  offline:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  progress: { flexDirection: 'row', gap: 3 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  clip:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.sm },
  mast:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  monogram: { width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  monogramLetter: { fontFamily: FONTS.bodyBold, fontSize: 12 },
  mastName: { flex: 1, fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1.2 },
  mastTag:  { fontFamily: FONTS.mono, fontSize: 10.5 },
  photo:    { width: '100%', aspectRatio: 16 / 9, borderRadius: 3 },
  photoCredit: { fontFamily: FONTS.mono, fontSize: 9.5, marginTop: 4 },
  clipHead: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  clipHeadBig: { fontSize: 24, lineHeight: 31 },
  clipBody: { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 22 },
  readLink: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  rubric:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.md },
  rubricLine: { flex: 1, height: StyleSheet.hairlineWidth },
  rubricTitle: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  sub:      { fontFamily: FONTS.body, fontSize: 13 },
  card:     { padding: SPACING.lg, gap: SPACING.sm, minHeight: 120, justifyContent: 'center' },
  headline: { fontFamily: FONTS.bodyBold, fontSize: 19, lineHeight: 26 },
  body:     { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
  headlineSmall: { fontSize: 16, lineHeight: 22 },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  readRow:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionCount: { fontFamily: FONTS.mono, fontSize: 11 },
  source:   { fontFamily: FONTS.body, fontSize: 12 },
  btn:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  btnText:  { fontFamily: FONTS.bodyBold, fontSize: 13 },
  section:  { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  row:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  rowBody:  { fontFamily: FONTS.body, fontSize: 12.5 },
});
