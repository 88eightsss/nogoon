// ─── Step Out — the tab for what is around you ────────────────────────────────
// (file is still local.tsx so the route and saved links keep working)
// A weekly outing goal and passport, what is on this week, five local headlines, a journal prompt, and
// The Wall (only when sponsors are shown). Kept out of the
// Briefing so the reading stays a reading. The place chip at the top opens the place picker; the choice
// stays on the phone and only decides which events list to show and what the search links look for.

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { useOfferStore } from '@/stores/useOfferStore';
import { getCommunityEvents, type CommunityEvent } from '@/lib/events';
import { getLocalNews, requestPlace, type Headline } from '@/lib/localNews';
import { useOutingStore, outingsThisWeek, SOUVENIR_EVERY } from '@/stores/useOutingStore';
import { placeLabel, regionsToShow } from '@/constants/places';
import { todaysPrompt } from '@/constants/journalPrompts';
import { ConstructionBadge } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { PageGuide } from '@/components/PageGuide';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const SHOWN = 3;
const DAY_MS = 86400000;

function agoLabel(iso: string | null): string {
  if (!iso) return '';
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3600000);
  if (!Number.isFinite(h) || h < 0) return '';
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function StepOutScreen() {
  const { colors, cardStyle } = useTheme();
  const place = usePlaceStore((s) => s.place);
  const showSponsors = useOfferStore((s) => s.showSponsors);
  const [events, setEvents] = useState<CommunityEvent[] | null>(null);
  const [news, setNews] = useState<Headline[]>([]);
  const [asked, setAsked] = useState(false);
  const log = useOutingStore((s) => s.log);
  const souvenirs = useOutingStore((s) => s.souvenirs);
  const progress = useOutingStore((s) => s.progress);
  const goal = useOutingStore((s) => s.weeklyGoal);
  const setGoal = useOutingStore((s) => s.setWeeklyGoal);

  const load = useCallback(() => {
    let live = true;
    getCommunityEvents().then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, []);
  useFocusEffect(load);

  const regions = useMemo(() => regionsToShow(place), [place]);
  useFocusEffect(useCallback(() => {
    let live = true;
    getLocalNews(regions.filter((r) => r !== 'Hawaii (statewide)'), 5).then((h) => { if (live) setNews(h); });
    return () => { live = false; };
  }, [regions]));
  const mine = useMemo(() => {
    const list = (events ?? []).filter((e) => regions.includes(e.region));
    // Their island first, statewide after.
    return list.sort((a, b) => Number(regions.indexOf(a.region) > 0) - Number(regions.indexOf(b.region) > 0));
  }, [events, regions]);
  const top = mine.slice(0, SHOWN);
  const hasPlace = place.name.length > 0;
  const accent = colors.protect;
  const went = outingsThisWeek(log);
  const reached = went >= goal;
  // The next seven days, one pill each, with how many dated events fall on it.
  const strip = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const from = start.getTime() + i * DAY_MS;
      const n = mine.filter((e) => !e.recurring && e.starts_at && Date.parse(e.starts_at) >= from && Date.parse(e.starts_at) < from + DAY_MS).length;
      return { label: i === 0 ? 'Today' : new Date(from).toLocaleDateString(undefined, { weekday: 'short' }), n };
    });
  }, [mine]);

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: colors.text }]}>Step Out</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Get off the feed and into your week. Markets, volunteering and what is on near you.</Text>
        </View>

        <Pressable
          onPress={() => router.push('/place' as any)}
          accessibilityRole="button"
          accessibilityLabel={hasPlace ? `Place: ${placeLabel(place)}. Change place` : 'Choose your place'}
          style={[styles.placeChip, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
        >
          <Feather name="map-pin" size={16} color={accent} />
          <Text style={[styles.placeText, { color: colors.text }]} numberOfLines={1}>
            {hasPlace ? placeLabel(place) : 'Choose your place'}
          </Text>
          <Text style={[styles.placeChange, { color: accent }]}>{hasPlace ? 'Change' : 'Set'}</Text>
        </Pressable>

        {/* This week: the outing goal, souvenirs and the next seven days */}
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.goalRow}>
            <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>
              {reached ? `Goal met: ${went} outing${went === 1 ? '' : 's'} this week` : `${went} of ${goal} outing${goal === 1 ? '' : 's'} this week`}
            </Text>
            <Pressable onPress={() => setGoal(goal >= 4 ? 1 : goal + 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Weekly goal ${goal}. Change`}>
              <Text style={[styles.seeAll, { color: accent }]}>Goal: {goal}</Text>
            </Pressable>
          </View>
          <View style={styles.dots}>
            {Array.from({ length: Math.max(goal, went) }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < went ? accent : 'transparent', borderColor: i < went ? accent : colors.cardBorder }]} />
            ))}
          </View>
          <Text style={[styles.rowBody, { color: colors.textSecondary }]}>
            Go to something, tap "I went", and your pal gets a treat. {souvenirs.length > 0 ? `Passport: ${souvenirs.map((v) => v.name).slice(-3).join(', ')}${souvenirs.length > 3 ? ` and ${souvenirs.length - 3} more` : ''}. ` : ''}
            {SOUVENIR_EVERY - progress} more for the next souvenir.
          </Text>
        </View>
        {strip.some((d) => d.n > 0) ? (
          <Pressable onPress={() => router.push('/events' as any)} accessibilityRole="button" accessibilityLabel="This week's events" style={styles.strip}>
            {strip.map((d, i) => (
              <View key={i} style={[styles.stripDay, { borderColor: d.n > 0 ? accent : colors.cardBorder, backgroundColor: d.n > 0 ? colors.accentDim : 'transparent' }]}>
                <Text style={[styles.stripLabel, { color: d.n > 0 ? accent : colors.textMuted }]}>{d.label.toUpperCase()}</Text>
                <Text style={[styles.stripNum, { color: d.n > 0 ? accent : colors.textMuted }]}>{d.n > 0 ? d.n : '·'}</Text>
              </View>
            ))}
          </Pressable>
        ) : null}

        {/* Happening near you */}
        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: colors.textMuted }]}>Happening near you</Text>
          {mine.length > SHOWN ? (
            <Pressable onPress={() => router.push('/events' as any)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.seeAll, { color: accent }]}>See all {mine.length}</Text>
            </Pressable>
          ) : null}
        </View>
        {UNDER_CONSTRUCTION.events ? <View style={{ alignSelf: 'flex-start' }}><ConstructionBadge /></View> : null}

        {events === null ? (
          <ActivityIndicator color={accent} />
        ) : top.length > 0 ? (
          top.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push('/events' as any)}
              accessibilityRole="button"
              style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            >
              <View style={[styles.tile, { backgroundColor: colors.accentDim }]}>
                {!e.recurring && e.starts_at ? (
                  <>
                    <Text style={[styles.tileDay, { color: colors.accent }]}>{new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text>
                    <Text style={[styles.tileNum, { color: colors.accent }]}>{new Date(e.starts_at).getDate()}</Text>
                  </>
                ) : (
                  <Feather name="repeat" size={18} color={colors.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>{e.title}</Text>
                <Text style={[styles.rowBody, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[e.when_text, e.place_name].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        ) : (
          <View style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, alignItems: 'flex-start' }]}>
            <Feather name="compass" size={20} color={accent} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {hasPlace ? `No list for ${place.name} yet` : 'Pick a place to see what is on'}
              </Text>
              <Text style={[styles.rowBody, { color: colors.textSecondary }]}>
                {hasPlace
                  ? 'We do not have a gathered list here yet. The search links find markets, volunteering and free events near you.'
                  : 'Choose your town and we will show what is on, or point you to searches that find it.'}
              </Text>
              <Pressable onPress={() => router.push('/events' as any)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.seeAll, { color: accent }]}>Find things to do</Text>
              </Pressable>
              {hasPlace ? (
                <Pressable
                  onPress={() => { if (!asked) { setAsked(true); void requestPlace(placeLabel(place)); } }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: asked }}
                >
                  <Text style={[styles.seeAll, { color: asked ? colors.textMuted : accent }]}>
                    {asked ? 'Thanks, we have noted it' : `Request ${place.name}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {/* Local news: five headlines, then it ends */}
        {news.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.textMuted }]}>Local news</Text>
            {news.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => Linking.openURL(h.url).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`${h.title}, from ${h.source}`}
                style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={3}>{h.title}</Text>
                  <Text style={[styles.rowBody, { color: colors.textMuted }]} numberOfLines={1}>{[h.source, agoLabel(h.published_at)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Feather name="external-link" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
            <Text style={[styles.rowBody, { color: colors.textMuted, textAlign: 'center' }]}>That is the five. Headlines open the outlet's own page.</Text>
          </>
        ) : null}

        {/* Journal */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Journal</Text>
        <Pressable
          onPress={() => router.push('/journal' as any)}
          accessibilityRole="button"
          style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
        >
          <Text style={[styles.prompt, { color: colors.text }]}>{todaysPrompt()}</Text>
          <Text style={[styles.link, { color: colors.accent }]}>Write it down</Text>
        </Pressable>

        {/* The Wall */}
        {showSponsors ? (
          <>
            <Text style={[styles.section, { color: colors.textMuted }]}>The Wall</Text>
            <Pressable
              onPress={() => router.push('/wall' as any)}
              accessibilityRole="button"
              style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            >
              <Feather name="grid" size={20} color={accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Local businesses and makers</Text>
                <Text style={[styles.rowBody, { color: colors.textSecondary }]}>Sponsored. Only when you choose to look.</Text>
                {UNDER_CONSTRUCTION.wall ? <View style={{ marginTop: 6 }}><ConstructionBadge /></View> : null}
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <PageGuide
        page="local"
        icon="map-pin"
        accent={accent}
        title="Step Out"
        hint="Get out into your week"
        subtitle="The point of cutting back is more life. Things to do, a weekly goal, five local headlines, a journal prompt, and local businesses."
        points={[
          { icon: 'map-pin',   title: 'Your place',         body: 'Pick a town and the list follows. It stays on your phone.' },
          { icon: 'flag',      title: 'I went',             body: 'Tap it after an outing. Your pal gets a treat, and every few outings you earn a souvenir.' },
          { icon: 'calendar',  title: 'Happening near you', body: 'Markets, volunteering and community events, each with a link to its source and a button to add it to your calendar.' },
          { icon: 'book-open', title: 'Journal',            body: 'A prompt a day, and colourful pages that never leave your phone.' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  title: { fontFamily: FONTS.display, fontSize: 30 },
  sub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '100%' },
  placeText: { fontFamily: FONTS.bodyBold, fontSize: 14, flexShrink: 1 },
  placeChange: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  seeAll: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  rowBody: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  tile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileDay: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8, lineHeight: 11 },
  tileNum: { fontFamily: FONTS.display, fontSize: 17, lineHeight: 19 },
  card: { padding: SPACING.md, gap: SPACING.sm },
  prompt: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 24 },
  link: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dots: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  strip: { flexDirection: 'row', gap: 6 },
  stripDay: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  stripLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.6 },
  stripNum: { fontFamily: FONTS.display, fontSize: 16, lineHeight: 20 },
});
