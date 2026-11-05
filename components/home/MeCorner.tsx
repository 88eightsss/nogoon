// ─── Me corner ───────────────────────────────────────────────────────────────────────────────
// Small companion badge plus days gained, top right of every tab in the new navigation. Tap opens Me.
// The companion keeps counting walk-aways in the background, so the badge always shows its real stage.

import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { PackSprite } from '@/components/page/PackSprite';
import { useMascot } from '@/components/page/useCharacter';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

export function MeCorner() {
  const { colors } = useTheme();
  const { char, stage } = useMascot();
  const days = useUserStore((s) => s.totalActiveDays);
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/profile' as any)}
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`Me. ${days} day${days === 1 ? '' : 's'} gained.`}
      hitSlop={8}
    >
      <View style={styles.sprite}><PackSprite char={char} stage={stage} cell={2} /></View>
      <Text style={[styles.days, { color: colors.text }]}>{days}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 10,
    marginRight: SPACING.sm,
  },
  sprite: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  days: { fontFamily: FONTS.bodyBold, fontSize: 14 },
});
