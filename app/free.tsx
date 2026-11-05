// ─── Free for everyone ────────────────────────────────────────────────────────
// Plain words on how NoGoon is paid for. Opened from Me > Account & help > About.
// Keep this honest: no company name until one is registered, no donate or gift buttons until the
// nonprofit or fiscal sponsor and Play billing are set up, and nothing that promises "no ads" in a way
// the Wall (clearly labeled sponsors) would break.

import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const POINTS: { title: string; body: string }[] = [
  { title: 'Free to use', body: 'Blocking, the pause, Ride it out, the Briefing and your companion are all free. No subscription, and nothing to unlock with money.' },
  { title: 'No ad networks', body: 'NoGoon does not run ad networks, and nothing about you is sold or shared with advertisers.' },
  { title: 'How it is paid for', body: 'Grants, and local sponsors on the Wall as it opens. Sponsors are always labeled, they never appear in the pause, and you only see them if you go and look.' },
];

export default function FreeForEveryone() {
  const { colors, cardStyle } = useTheme();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { color: colors.text }]} accessibilityRole="header">Free for everyone</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.lead, { color: colors.textSecondary }]}>
          Stopping should not cost money. Here is how that works.
        </Text>
        {POINTS.map((p) => (
          <View key={p.title} style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[s.h, { color: colors.text }]}>{p.title}</Text>
            <Text style={[s.p, { color: colors.textSecondary }]}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 20 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  lead: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  card: { padding: SPACING.md, gap: 6 },
  h: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  p: { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
});
