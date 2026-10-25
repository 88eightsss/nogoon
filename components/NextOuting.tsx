// ─── Next outing (Today) ──────────────────────────────────────────────────────
// One quiet line on Today: the next thing on near the chosen place and how the week's outing goal is going.
// Hidden until a place is chosen, so it never nags someone who has not set one up.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { useOutingStore, outingsThisWeek } from '@/stores/useOutingStore';
import { getCommunityEvents, type CommunityEvent } from '@/lib/events';
import { regionsToShow } from '@/constants/places';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

export function NextOuting() {
  const { colors, cardStyle } = useTheme();
  const place = usePlaceStore((s) => s.place);
  const log = useOutingStore((s) => s.log);
  const goal = useOutingStore((s) => s.weeklyGoal);
  const [events, setEvents] = useState<CommunityEvent[] | null>(null);

  useFocusEffect(useCallback(() => {
    let live = true;
    getCommunityEvents().then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, []));

  const regions = useMemo(() => regionsToShow(place), [place]);
  const next = useMemo(() => {
    const week = Date.now() + 7 * 86400000;
    const mine = (events ?? []).filter((e) => regions.includes(e.region));
    return mine.find((e) => !e.recurring && e.starts_at && Date.parse(e.starts_at) < week) ?? mine.find((e) => e.recurring) ?? null;
  }, [events, regions]);

  if (!place.name || !next) return null;
  const went = outingsThisWeek(log);
  const when = next.recurring ? next.when_text : (next.starts_at ? new Date(next.starts_at).toLocaleDateString(undefined, { weekday: 'long' }) : next.when_text);

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/local' as any)}
      accessibilityRole="button"
      accessibilityLabel={`Next outing: ${next.title}. Open Step Out`}
      style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
    >
      <Feather name="map-pin" size={18} color={colors.protect} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{next.title}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {[when, next.place_name].filter(Boolean).join(' · ')} · {went >= goal ? 'weekly goal met' : `${went} of ${goal} this week`}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  title: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  meta: { fontFamily: FONTS.body, fontSize: 12.5 },
});
