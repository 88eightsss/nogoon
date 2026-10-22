// ─── Choose your place ────────────────────────────────────────────────────────
// Search any town in the world. The choice stays on the phone. Where we have a gathered events list
// (today: Maui and Oahu) Local shows it; everywhere else it shows search links and says so.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { searchPlaces } from '@/lib/places';
import { QUICK_PLACES, placeLabel, regionKeyFor, type Place } from '@/constants/places';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

export default function PlaceScreen() {
  const { colors, cardStyle } = useTheme();
  const current = usePlaceStore((s) => s.place);
  const setPlace = usePlaceStore((s) => s.setPlace);
  const clearPlace = usePlaceStore((s) => s.clearPlace);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setHits(null); setBusy(false); return; }
    setBusy(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchPlaces(text);
      if (mine !== seq.current) return;
      setHits(r);
      setBusy(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/local' as any));
  const pick = (p: Place) => { Haptics.selectionAsync().catch(() => {}); setPlace(p); done(); };

  const row = (p: Place, key: string) => {
    const curated = !!p.regionKey;
    return (
      <Pressable
        key={key}
        onPress={() => pick(p)}
        accessibilityRole="button"
        accessibilityLabel={`${placeLabel(p)}${p.country ? `, ${p.country}` : ''}. ${curated ? 'Events list available' : 'Search links only'}`}
        style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      >
        <Feather name="map-pin" size={18} color={curated ? colors.protect : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{placeLabel(p)}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{p.country}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: curated ? colors.accentDim : colors.surfaceHigh }]}>
          <Text style={[styles.badgeText, { color: curated ? colors.accent : colors.textSecondary }]}>
            {curated ? 'Events list' : 'Search links'}
          </Text>
        </View>
      </Pressable>
    );
  };

  const typed = q.trim();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Choose your place</Text>
        <Pressable onPress={done} hitSlop={10} accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Search any town. It stays on your phone and decides what Local shows.
        </Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search a town or city"
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          autoCorrect={false}
          autoCapitalize="words"
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
          accessibilityLabel="Search a town or city"
        />

        {typed.length >= 2 ? (
          busy && !hits ? (
            <ActivityIndicator color={colors.accent} />
          ) : hits && hits.length > 0 ? (
            <>
              <Text style={[styles.section, { color: colors.textMuted }]}>Matches</Text>
              {hits.map((p, i) => row(p, `${p.name}-${p.admin}-${i}`))}
            </>
          ) : (
            <View style={{ gap: SPACING.sm }}>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                No matches, or search is not reachable right now. You can still use what you typed. Local will show search links for it.
              </Text>
              {row({ name: typed, admin: '', country: '', regionKey: regionKeyFor(typed, 'Hawaii', 'US') }, 'typed')}
            </View>
          )
        ) : (
          <>
            <Text style={[styles.section, { color: colors.textMuted }]}>With an events list</Text>
            {QUICK_PLACES.map((p) => row(p, p.name))}
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Other places work too. They get search links for markets, volunteering and free events until we gather a list for them.
            </Text>
          </>
        )}

        {current.name ? (
          <Pressable onPress={() => { clearPlace(); done(); }} accessibilityRole="button" hitSlop={8} style={styles.clear}>
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear my place ({placeLabel(current)})</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 24 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15 },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  meta: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17 },
  badge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  badgeText: { fontFamily: FONTS.bodyMedium, fontSize: 11.5 },
  clear: { alignSelf: 'center', paddingVertical: SPACING.md },
  clearText: { fontFamily: FONTS.bodyMedium, fontSize: 13, textDecorationLine: 'underline' },
});
