// Day count shown as the mascot itself: a big sprite with a "Day N" plate.
// Used when Customize > Days is set to "On the mascot".

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';
import { PackSprite } from './PackSprite';
import { nextLandmark } from './Counter';

export function MascotCount({ char, stage, days, name }: { char: CharacterId; stage: GoonStage; days: number; name: string }) {
  const { colors, cardStyle } = useTheme();
  const { next } = nextLandmark(days);
  const left = next - days;
  return (
    <View
      style={[styles.card, cardStyle, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}
      accessible
      accessibilityLabel={`${name}. Day ${days} streak. Next landmark is day ${next}, ${left} day${left === 1 ? '' : 's'} away.`}
    >
      <PackSprite char={char} stage={stage} cell={14} />
      <View style={[styles.plate, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.day, { color: colors.text }]}>Day {days}</Text>
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {name} · next landmark day {next}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:  { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  plate: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 6 },
  day:   { fontFamily: FONTS.display, fontSize: 24 },
  meta:  { fontFamily: FONTS.body, fontSize: 12.5 },
});
