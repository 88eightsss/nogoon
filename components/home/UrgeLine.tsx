// ─── "Your urges usually fade in about N minutes" ────────────────────────────────────────────
// Own numbers only, from the Ride it out timer. Hidden until there are enough samples so early
// numbers cannot mislead. Never a promise: "usually", never "always".

import { Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useRecoveryStore, medianUrgeMinutes } from '@/stores/useRecoveryStore';
import { getLocalDateKey } from '@/utils/date';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export function UrgeLine() {
  const { colors, cardStyle } = useTheme();
  const seconds = useRecoveryStore((s) => s.urgeSeconds);
  const starts = useRecoveryStore((s) => s.urgeStarts);
  const passed = useRecoveryStore((s) => s.urgesPassed);
  const minutes = medianUrgeMinutes(seconds);
  if (minutes == null) return null;

  let started = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = getLocalDateKey(d);
    started += starts[k] ?? 0;
    done += passed[k] ?? 0;
  }
  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Feather name="activity" size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.main, { color: colors.text }]}>
          Your urges usually fade in about {minutes} minute{minutes === 1 ? '' : 's'}.
        </Text>
        {started > 0 && (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {done} of {started} you watched this week passed.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  main: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  sub: { fontFamily: FONTS.body, fontSize: 12.5, marginTop: 2 },
});
