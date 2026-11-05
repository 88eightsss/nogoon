// ─── Step Out feed ───────────────────────────────────────────────────────────────────────────
// A weekly list of real things near you that ENDS. Three sections: Give a hand (verified hosts asking for
// help), Happening (verified events), Neighbors say (not checked by us). No likes, no comments, no counts,
// no refresh. Declining is invisible. Sample items for now (constants/stepOutSample.ts); under construction.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { placeLabel } from '@/constants/places';
import { useStepOutStore } from '@/stores/useStepOutStore';
import { STEP_SAMPLE, SECTION_TITLE, SECTION_NOTE, type StepSection } from '@/constants/stepOutSample';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { StepCard } from '@/components/stepout/StepCard';
import { Shell } from '@/components/stepout/Shell';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const ORDER: StepSection[] = ['hand', 'happening', 'neighbor'];

export default function StepOutFeed() {
  const { colors, cardStyle } = useTheme();
  const place = usePlaceStore((s) => s.place);
  const replies = useStepOutStore((s) => s.replies);
  const crew = useStepOutStore((s) => s.crew);

  const open = (id: string) => router.push({ pathname: '/stepout-event', params: { id } } as any);
  const later = STEP_SAMPLE.filter((i) => replies[i.id] === 'later');

  return (
    <Shell title="This week near you">
      {UNDER_CONSTRUCTION.stepOutFeed && (
        <ConstructionSign note="These are examples so you can try the feed. No real hosts yet, and nothing you tap here is sent to anyone." />
      )}

      <View style={[styles.place, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
        <Feather name="map-pin" size={16} color={colors.accent} />
        <Text style={[styles.placeText, { color: colors.text }]} numberOfLines={1}>{place.name ? placeLabel(place) : 'Sample area'}</Text>
      </View>

      {ORDER.map((sec) => {
        const items = STEP_SAMPLE.filter((i) => i.section === sec && replies[i.id] !== 'no' && replies[i.id] !== 'later');
        if (items.length === 0) return null;
        return (
          <View key={sec} style={{ gap: SPACING.sm }}>
            <View>
              <Text style={[styles.section, { color: colors.text }]} accessibilityRole="header">{SECTION_TITLE[sec]}</Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>{SECTION_NOTE[sec]}</Text>
            </View>
            {items.map((i) => <StepCard key={i.id} item={i} coming={replies[i.id] === 'coming'} onPress={() => open(i.id)} />)}
          </View>
        );
      })}

      {later.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text style={[styles.section, { color: colors.text }]} accessibilityRole="header">For later</Text>
          {later.map((i) => <StepCard key={i.id} item={i} onPress={() => open(i.id)} />)}
        </View>
      )}

      <Text style={[styles.end, { color: colors.textMuted }]}>That's everything for this week. New things appear on Monday.</Text>

      <Pressable
        onPress={() => router.push('/crew' as any)}
        accessibilityRole="button"
        style={[styles.link, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      >
        <Feather name="users" size={20} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, { color: colors.text }]}>{crew ? crew.name : 'Go together'}</Text>
          <Text style={[styles.note, { color: colors.textSecondary }]}>{crew ? 'Your crew: a next thing and postcards.' : 'Start a small crew of up to 8 people.'}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
    </Shell>
  );
}

const styles = StyleSheet.create({
  place: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  placeText: { fontFamily: FONTS.bodyMedium, fontSize: 14, flex: 1 },
  section: { fontFamily: FONTS.display, fontSize: 20 },
  note: { fontFamily: FONTS.body, fontSize: 12.5 },
  end: { fontFamily: FONTS.body, fontSize: 14, textAlign: 'center', paddingVertical: SPACING.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  linkTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
});
