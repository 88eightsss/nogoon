// ─── Places near you ──────────────────────────────────────────────────────────
// Parks, beaches, trails, museums, zoos and aquariums, gardens and public places for the island the person
// picked in Step Out. Under construction (constants/construction.ts): names only, no hours or prices yet.
// Nothing here is sent anywhere. Directions open the phone's Maps app.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { placeLabel } from '@/constants/places';
import { SPOT_GROUPS, KIND_ICON, KIND_LABEL, type SpotGroup, type Spot } from '@/constants/spots';
import { spotsFor, pickOne, mapsUrl, PAGE } from '@/lib/spots';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

function openMaps(p: Spot) {
  Haptics.selectionAsync().catch(() => {});
  Linking.openURL(mapsUrl(p)).catch(() => Alert.alert("Couldn't open Maps", 'Check your connection and try again.'));
}

export default function SpotsScreen() {
  const { colors, cardStyle } = useTheme();
  const place = usePlaceStore((s) => s.place);
  const [group, setGroup] = useState<SpotGroup | 'all'>('all');
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<Spot | null>(null);

  const hasList = place.regionKey === 'Maui' || place.regionKey === 'Oahu';
  const list = useMemo(() => spotsFor(place.regionKey, group), [place.regionKey, group]);
  const visible = list.slice(0, shown);

  const chip = (label: string, on: boolean, press: () => void, icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => (
    <Pressable
      key={label} onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surfaceHigh }]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={on ? colors.accent : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, { color: on ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Places near you</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={10} accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {UNDER_CONSTRUCTION.places && (
          <ConstructionSign note="A starter list of well-known places on Oahu and Maui. Hours, prices and conditions are not in yet, so check before you go." />
        )}

        <Pressable
          onPress={() => router.push('/place' as any)}
          accessibilityRole="button"
          accessibilityLabel={place.name ? `Place: ${placeLabel(place)}. Change place` : 'Choose your place'}
          style={[styles.placeChip, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
        >
          <Feather name="map-pin" size={16} color={colors.accent} />
          <Text style={[styles.placeText, { color: colors.text }]} numberOfLines={1}>{place.name ? placeLabel(place) : 'Choose your place'}</Text>
          <Text style={[styles.placeChange, { color: colors.accent }]}>{place.name ? 'Change' : 'Choose'}</Text>
        </Pressable>

        {!hasList ? (
          <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{place.name ? `No list for ${place.name} yet` : 'Pick your town first'}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {place.name
                ? 'We only have places for Oahu and Maui so far. Other islands and towns are coming. We would rather show nothing than guess.'
                : 'Choose a town on Oahu or Maui and the list follows. It stays on your phone.'}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {chip('All', group === 'all', () => { setGroup('all'); setShown(PAGE); setPicked(null); }, 'map-marker-radius')}
              {SPOT_GROUPS.map((g) => chip(g.label, group === g.key, () => { setGroup(g.key); setShown(PAGE); setPicked(null); }, g.icon))}
            </ScrollView>

            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setPicked(pickOne(list, picked?.id)); }}
              accessibilityRole="button" accessibilityLabel="Pick one for me"
              style={[styles.pickBtn, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="shuffle-variant" size={18} color={colors.text} />
              <Text style={[styles.pickText, { color: colors.text }]}>Pick one for me</Text>
            </Pressable>

            {picked ? (
              <View style={[styles.card, cardStyle, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
                <Text style={[styles.section, { color: colors.textMuted }]}>How about</Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{picked.name}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{KIND_LABEL[picked.kind]} · {picked.area}</Text>
                <Pressable onPress={() => openMaps(picked)} accessibilityRole="button" accessibilityLabel={`Open ${picked.name} in Maps`} hitSlop={8}>
                  <Text style={[styles.link, { color: colors.accent }]}>Open in Maps</Text>
                </Pressable>
              </View>
            ) : null}

            {list.length === 0 ? (
              <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>Nothing listed for that yet.</Text>
            ) : visible.map((p) => (
              <Pressable
                key={p.id} onPress={() => openMaps(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, ${KIND_LABEL[p.kind]}, ${p.area}. Open in Maps`}
                style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
              >
                <View style={[styles.tile, { backgroundColor: colors.accentDim }]}>
                  <MaterialCommunityIcons name={KIND_ICON[p.kind]} size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{KIND_LABEL[p.kind]} · {p.area}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Hours not listed</Text>
                </View>
                <Feather name="external-link" size={16} color={colors.textMuted} />
              </Pressable>
            ))}

            {list.length > shown ? (
              <Pressable onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button" style={[styles.pickBtn, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
                <Text style={[styles.pickText, { color: colors.text }]}>Show {Math.min(PAGE, list.length - shown)} more</Text>
              </Pressable>
            ) : list.length > 0 ? (
              <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>That is everything we have listed.</Text>
            ) : null}

            <Text style={[styles.body, { color: colors.textMuted }]}>
              Names only for now. Tapping a place opens it in Maps, where you can check hours and costs. For trails and beaches, check the official page or posted signs for closures and conditions before you go.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 24 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '100%' },
  placeText: { fontFamily: FONTS.bodyBold, fontSize: 14, flexShrink: 1 },
  placeChange: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 14, borderWidth: 1 },
  pickText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  card: { padding: SPACING.md, gap: 4 },
  cardTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  link: { fontFamily: FONTS.bodyBold, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  tile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  meta: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17 },
});
