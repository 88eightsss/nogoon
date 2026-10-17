// ─── "Make this page yours" card ──────────────────────────────────────────────
//
// Shown on My Page until the user picks a skin or says not now. It is the first-run
// "pick your style" step, without adding a screen to onboarding.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePackStore } from '@/stores/usePackStore';
import { availablePacks } from '@/constants/packs';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

export function StyleCard() {
  const { colors, cardStyle } = useTheme();
  const dismissed     = usePackStore((s) => s.styleCardDismissed);
  const dismiss       = usePackStore((s) => s.dismissStyleCard);
  const unlockedIds   = usePackStore((s) => s.unlockedIds);
  const activePackId  = usePackStore((s) => s.activePackId);
  const setActivePack = usePackStore((s) => s.setActivePack);
  const packs = availablePacks(unlockedIds);
  // With a single look there is nothing to pick, so the first-run style card has no job.
  if (dismissed || packs.length < 2) return null;
  const pick = (id: string) => { setActivePack(id); dismiss(); };

  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Text style={[styles.title, { color: colors.text }]}>Make this page yours</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>Pick a look. You can change it any time.</Text>
      <View style={styles.row}>
        {packs.map((p) => {
          const swatch = p.parts.theme ? p.parts.theme[p.parts.theme.nativeMode].accent : colors.accent;
          const on = p.id === activePackId;
          return (
            <Pressable
              key={p.id}
              onPress={() => pick(p.id)}
              style={[styles.chip, { borderColor: on ? colors.accent : colors.border }]}
              accessibilityLabel={`Use the ${p.name} skin`}
            >
              <View style={[styles.dot, { backgroundColor: swatch }]} />
              <Text style={[styles.chipText, { color: colors.text }]}>{p.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => { dismiss(); router.push('/customize' as any); }} hitSlop={8}>
          <Text style={[styles.link, { color: colors.accent }]}>More options</Text>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={8}>
          <Text style={[styles.link, { color: colors.textMuted }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:  { padding: SPACING.md, gap: SPACING.sm },
  title: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  body:  { fontFamily: FONTS.body, fontSize: 13 },
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  dot:   { width: 14, height: 14, borderRadius: 7 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  actions:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  link:     { fontFamily: FONTS.bodyBold, fontSize: 13 },
});
