// Badge — a small pill-shaped label used for status indicators, level names, etc.
//
// Usage:
//   <Badge label="ACTIVE" color={COLORS.green} />
//   <Badge label="Explorer" color={COLORS.purple} size="sm" />

import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface BadgeProps {
  label: string;
  color: string;       // The accent color (text + border + dim background)
  size?: 'sm' | 'md'; // Small or medium badge
  style?: ViewStyle;
}

export function Badge({ label, color, size = 'md', style }: BadgeProps) {
  // Create a faint version of the color for the background
  // We use the color at low opacity so it tints without being too heavy
  const bgColor = color + '22'; // Appending '22' = ~13% opacity in hex

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.sm,
        { backgroundColor: bgColor, borderColor: color + '55' },
        style,
      ]}
    >
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',          // Shrink to content width
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelSm: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
