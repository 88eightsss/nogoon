// ─── Local — the tab for what is around you ───────────────────────────────────
// Happening near you, a journal prompt, and The Wall (only when sponsors are shown). Kept out of the
// Briefing so the reading stays a reading. The place chip at the top opens the place picker; the choice
// stays on the phone and only decides which events list to show and what the search links look for.

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { useOfferStore } from '@/stores/useOfferStore';
import { getCommunityEvents, type CommunityEvent } from '@/lib/events';
import { placeLabel, regionsToShow } from '@/constants/places';
import { todaysPrompt } from '@/constants/journalPrompts';
import { ConstructionBadge } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { PageGuide } from '@/components/PageGuide';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const SHOWN = 3;

export default function LocalScreen() {
  const { colors, cardStyle } = useTheme();
  const place = usePlaceStore((s) => s.place);
  const showSponsors = useOfferStore((s) => s.showSponsors);
  const [events, setEvents] = useState<CommunityEvent[] | null>(null);

  const load = useCallback(() => {
    let live = true;
    getCommunityEvents().then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, []);
  useFocusEffect(load);

  const regions = useMemo(() => regionsToShow(place), [place]);
  const mine = useMemo(() => {
    const list = (events ?? []).filter((e) => regions.includes(e.region));
    // Their island first, statewide after.
    return list.sort((a, b) => Number(regions.indexOf(a.region) > 0) - Number(regions.indexOf(b.region) > 0));
  }, [events, regions]);
  const top = mine.slice(0, SHOWN);
  const hasPlace = place.name.length > 0;
  const accent = colors.protect;

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: colors.text }]}>Local</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Things to do near you, and somewhere to put your thoughts.</Text>
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
            </View>
          </View>
        )}

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
        title="Local"
        hint="Things to do near you"
        subtitle="The point of cutting back is more life. Events, a journal prompt, and local businesses, all away from the news."
        points={[
          { icon: 'map-pin',   title: 'Your place',         body: 'Pick a town and the list follows. It stays on your phone.' },
          { icon: 'calendar',  title: 'Happening near you', body: 'Markets, volunteering and community events, each with a link to its source.' },
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
});
