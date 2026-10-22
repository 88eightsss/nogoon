// ─── Happening near you ───────────────────────────────────────────────────────
// Farmers markets, volunteering and community events. Curated and approved by hand (see
// supabase/functions/events-draft); every card links to its source. Below the list, search links
// (using the optional town from Beyond the screen) cover everywhere we have no curated list.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useOfferStore } from '@/stores/useOfferStore';
import { PLACE_MAX, nearbyUrl, type Nearby } from '@/constants/elsewhere';
import { getCommunityEvents, KIND_LABELS, type CommunityEvent, type EventKind } from '@/lib/events';
import { FONTS } from '@/constants/Colors';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { SPACING } from '@/constants/Spacing';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
const KIND_ICON: Record<EventKind, FeatherName> = {
  market: 'shopping-bag', volunteer: 'heart', community: 'users', outdoors: 'sun', class: 'award', music: 'music', other: 'star',
};

const SEARCHES: Nearby[] = [
  { id: 'markets',   label: 'Farmers markets',  sub: 'Fresh food and local makers',          icon: 'shopping-bag', kind: 'maps',   q: 'farmers market' },
  { id: 'volunteer', label: 'Volunteer',        sub: 'Give an afternoon to something real',  icon: 'heart',        kind: 'url',    url: 'https://www.volunteermatch.org' },
  { id: 'events',    label: 'Free events this week', sub: 'Music, markets, talks',           icon: 'calendar',     kind: 'search', q: 'free community events this week' },
  { id: 'cleanup',   label: 'Beach and park cleanups', sub: 'Outside, useful, social',       icon: 'sun',          kind: 'search', q: 'beach cleanup or park cleanup volunteer' },
];

function open(url: string) {
  Haptics.selectionAsync().catch(() => {});
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open that", 'Check your connection and try again.'));
}

export default function EventsScreen() {
  const { colors, cardStyle } = useTheme();
  const place = useOfferStore((s) => s.place);
  const setPlace = useOfferStore((s) => s.setPlace);

  const [events, setEvents] = useState<CommunityEvent[] | null>(null);
  const [region, setRegion] = useState<string>('All');
  const [kind, setKind] = useState<EventKind | 'all'>('all');

  useEffect(() => {
    let live = true;
    getCommunityEvents().then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, []);

  const regions = useMemo(() => ['All', ...Array.from(new Set((events ?? []).map((e) => e.region))).sort()], [events]);
  // Start on the region that matches the town they typed in Beyond the screen, if any.
  useEffect(() => {
    const p = place.trim().toLowerCase();
    if (!p || !events) return;
    const hit = regions.find((r) => r !== 'All' && (p.includes(r.toLowerCase()) || r.toLowerCase().includes(p)));
    if (hit) setRegion(hit);
  }, [events]);   // eslint-disable-line react-hooks/exhaustive-deps

  const kinds = useMemo(() => Array.from(new Set((events ?? []).map((e) => e.kind))), [events]);
  const list = (events ?? []).filter((e) => (region === 'All' || e.region === region) && (kind === 'all' || e.kind === kind));

  // Grouped like a feed: what is on in the next 7 days, what is coming up, and the things that happen every week.
  const groups = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 86400000;
    const dated = list.filter((e) => !e.recurring);
    const soon = dated.filter((e) => e.starts_at && Date.parse(e.starts_at) < week);
    return [
      { title: 'This week', items: soon },
      { title: 'Coming up', items: dated.filter((e) => !soon.includes(e)) },
      { title: 'Every week', items: list.filter((e) => e.recurring) },
    ].filter((g) => g.items.length > 0);
  }, [list]);

  const chip = (label: string, on: boolean, press: () => void) => (
    <Pressable
      key={label} onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surfaceHigh }]}
    >
      <Text style={[styles.chipText, { color: on ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Happening near you</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={10} accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {UNDER_CONSTRUCTION.events && (
          <ConstructionSign note="We are still adding events by hand, so your area may be empty for now. Check back soon." />
        )}
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          The point of cutting back is more life. Here is what is on in your community, refreshed twice a week, with a link to the source for every one.
        </Text>

        {events === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : events.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {regions.map((r) => chip(r, region === r, () => setRegion(r)))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {chip('Everything', kind === 'all', () => setKind('all'))}
              {kinds.map((k) => chip(KIND_LABELS[k], kind === k, () => setKind(k)))}
            </ScrollView>

            {list.length === 0 ? (
              <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>Nothing listed for that yet.</Text>
            ) : groups.flatMap((g) => [
              <Text key={`h-${g.title}`} style={[styles.section, { color: colors.textMuted }]}>{g.title}</Text>,
              ...g.items.map((e) => (
              <View key={e.id} style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <View style={styles.cardTop}>
                  {!e.recurring && e.starts_at ? (
                    <View style={[styles.icon, { backgroundColor: colors.accentDim }]} accessible={false}>
                      <Text style={[styles.tileDay, { color: colors.accent }]}>{new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text>
                      <Text style={[styles.tileNum, { color: colors.accent }]}>{new Date(e.starts_at).getDate()}</Text>
                    </View>
                  ) : (
                    <View style={[styles.icon, { backgroundColor: colors.accentDim }]}>
                      <Feather name={KIND_ICON[e.kind]} size={18} color={colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{e.title}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {[e.when_text, e.place_name].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {e.cost ? (
                    <View style={[styles.cost, { backgroundColor: colors.surfaceHigh }]}>
                      <Text style={[styles.costText, { color: colors.textSecondary }]}>{e.cost}</Text>
                    </View>
                  ) : null}
                </View>
                {e.summary ? <Text style={[styles.body, { color: colors.textSecondary }]}>{e.summary}</Text> : null}
                <View style={styles.cardFoot}>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{e.region}{e.source ? ` · via ${e.source}` : ''}</Text>
                  <Pressable onPress={() => open(e.url)} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Details for ${e.title}`}>
                    <Text style={[styles.link, { color: colors.accent }]}>Details</Text>
                  </Pressable>
                </View>
              </View>
              )),
            ])}
          </>
        ) : (
          <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>No curated list for your area yet</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              We are building these by hand, region by region. Until yours is here, the searches below find what is on near you.
            </Text>
          </View>
        )}

        <Text style={[styles.section, { color: colors.textMuted }]}>Find more near you</Text>
        <TextInput
          value={place}
          onChangeText={setPlace}
          placeholder="Your town (optional)"
          placeholderTextColor={colors.textMuted}
          maxLength={PLACE_MAX}
          autoCorrect={false}
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
          accessibilityLabel="Your town"
        />
        <Text style={[styles.meta, { color: colors.textMuted }]}>Stays on your phone. Only used to build the search when you tap.</Text>
        {SEARCHES.map((n) => (
          <Pressable
            key={n.id} onPress={() => open(nearbyUrl(n, place))} accessibilityRole="link"
            style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          >
            <Feather name={n.icon} size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{n.label}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>{n.sub}</Text>
            </View>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </Pressable>
        ))}

        <Text style={[styles.meta, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }]}>
          Listings are gathered automatically each week from local news and organisers' pages, and every one links to its source. Details can change or be wrong, so check the link before you go.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 24 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  card: { padding: SPACING.md, gap: SPACING.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileDay: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8, lineHeight: 11 },
  tileNum: { fontFamily: FONTS.display, fontSize: 17, lineHeight: 19 },
  cardTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  meta: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17 },
  cost: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  costText: { fontFamily: FONTS.bodyMedium, fontSize: 11.5 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.md },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
});
