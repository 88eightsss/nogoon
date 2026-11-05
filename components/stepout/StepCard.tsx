// ─── One thing to do ─────────────────────────────────────────────────────────────────────────
// A card in the Step Out feed. Verified hosts get a check mark and a checked date; Neighbors say gets a
// dashed border and the plain "not checked by us" line. No counts of any kind, no reactions.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import type { StepItem } from '@/constants/stepOutSample';

export function VerifiedMark({ item }: { item: StepItem }) {
  const { colors } = useTheme();
  if (!item.verified) return null;
  return (
    <View style={styles.vRow} accessible accessibilityLabel={`Verified ${item.verified === 'business' ? 'business' : 'nonprofit'}. ${item.checked ?? ''}`}>
      <Feather name="check-circle" size={13} color={colors.success} />
      <Text style={[styles.vText, { color: colors.textSecondary }]}>
        {item.verified === 'business' ? 'Business event' : 'Verified'}{item.checked ? ` · ${item.checked}` : ''}
      </Text>
    </View>
  );
}

export function StepCard({ item, coming, onPress }: { item: StepItem; coming?: boolean; onPress: () => void }) {
  const { colors, cardStyle } = useTheme();
  const neighbor = item.section === 'neighbor';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.when}. ${item.area}.`}
      style={({ pressed }) => [
        styles.card, cardStyle,
        { backgroundColor: colors.surface, borderColor: neighbor ? colors.border : colors.cardBorder, borderStyle: neighbor ? 'dashed' : 'solid', opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.host, { color: colors.textMuted }]} numberOfLines={1}>{item.host}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.when} · {item.area} · {item.cost}</Text>
        {item.ask ? <Text style={[styles.ask, { color: colors.accent }]}>{item.ask}</Text> : null}
        {neighbor ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>Not checked by us, so look twice.</Text>
        ) : (
          <VerifiedMark item={item} />
        )}
        {coming ? (
          <View style={styles.vRow}>
            <Feather name="check" size={13} color={colors.success} />
            <Text style={[styles.vText, { color: colors.success }]}>You said you're coming</Text>
          </View>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  host: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: FONTS.body, fontSize: 13 },
  ask: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vText: { fontFamily: FONTS.body, fontSize: 12 },
});
