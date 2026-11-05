// ─── Make ────────────────────────────────────────────────────────────────────
//
// A small corner for frustration and restlessness: two-minute things to make with your hands and eyes,
// then a private gallery of what you made. Nothing is public, shared, scored or timed.
// Opened from Calm, from "This is annoying" on the pause, and from Make cards on the day plan.

import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useMakeStore, promptOfTheDay, DRAW_PROMPTS, LINE_PROMPTS } from '@/stores/useMakeStore';
import { PixelView } from '@/components/make/PixelView';

export default function MakeScreen() {
  const { colors, cardStyle } = useTheme();
  const items = useMakeStore((s) => s.items);
  const remove = useMakeStore((s) => s.remove);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const tiles = [
    { icon: 'edit-3' as const, title: 'Draw something small', sub: promptOfTheDay(DRAW_PROMPTS), go: '/make-draw' },
    { icon: 'type' as const, title: 'Say it in a line', sub: promptOfTheDay(LINE_PROMPTS), go: '/make-line' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Make something</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Two minutes. No audience, no score. When your hands are busy, the urge gets quieter.
        </Text>

        {tiles.map((t) => (
          <Pressable
            key={t.title}
            onPress={() => router.push(t.go as any)}
            style={({ pressed }) => [styles.tile, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
          >
            <Feather name={t.icon} size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileTitle, { color: colors.text }]}>{t.title}</Text>
              <Text style={[styles.tileSub, { color: colors.textSecondary }]}>{t.sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        <Text style={[styles.label, { color: colors.textMuted }]}>THINGS I MADE</Text>
        {items.length === 0 ? (
          <Text style={[styles.sub, { color: colors.textMuted }]}>Nothing yet. Your first one goes here, only visible to you.</Text>
        ) : (
          <View style={styles.grid}>
            {items.map((it) => (
              <View key={it.id} style={[styles.item, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                {it.kind === 'pixel' && it.cells ? (
                  <PixelView cells={it.cells} size={120} bg={colors.surfaceHigh} />
                ) : (
                  <Text style={[styles.lineText, { color: colors.text }]} numberOfLines={6}>{it.text}</Text>
                )}
                <View style={styles.itemFoot}>
                  <Text style={[styles.itemDate, { color: colors.textMuted }]}>{new Date(it.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                  <Pressable onPress={() => remove(it.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete this">
                    <Feather name="trash-2" size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  title: { fontFamily: FONTS.display, fontSize: 28 },
  sub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, minHeight: 72 },
  tileTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  tileSub: { fontFamily: FONTS.body, fontSize: 13, marginTop: 2 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 11, letterSpacing: 0.8, marginTop: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  item: { width: 152, padding: SPACING.sm, gap: SPACING.sm, alignItems: 'center' },
  lineText: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, alignSelf: 'stretch', minHeight: 120 },
  itemFoot: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' },
  itemDate: { fontFamily: FONTS.body, fontSize: 11 },
});
