// ─── One calm check-in after giving in ───────────────────────────────────────
//
// Shown on Today after an unlock (see utils/tempUnlock.ts). No streak is lost, nothing is shamed.
// One tap for what was going on (counts only), then a nudge toward a plan for next time.
// "Days gained" and walk-aways are untouched by this.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useRecoveryStore, TRIGGER_CHOICES } from '@/stores/useRecoveryStore';

export function SlipCard() {
  const { colors, cardStyle } = useTheme();
  const pending = useRecoveryStore((s) => s.slipPending);
  const clearSlip = useRecoveryStore((s) => s.clearSlip);
  const logTrigger = useRecoveryStore((s) => s.logTrigger);
  const [answered, setAnswered] = useState(false);

  if (!pending) return null;

  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{answered ? 'Thanks for noting that.' : 'That happened.'}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {answered
              ? 'Your days gained did not change. A plan for next time can make it easier.'
              : 'Your days gained did not change. What was going on?'}
          </Text>
        </View>
        <Pressable onPress={clearSlip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {answered ? (
        <View style={styles.chips}>
          <Pressable onPress={() => { clearSlip(); router.push('/plans' as any); }} style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accent + '1A' }]} accessibilityRole="button">
            <Text style={[styles.chipText, { color: colors.accent }]}>Write a plan</Text>
          </Pressable>
          <Pressable onPress={clearSlip} style={[styles.chip, { borderColor: colors.border }]} accessibilityRole="button">
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>Not now</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.chips}>
          {TRIGGER_CHOICES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => { logTrigger(t.id); setAnswered(true); }}
              style={[styles.chip, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, { color: colors.text }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.md, gap: SPACING.md },
  top: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  title: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  sub: { fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },
});
