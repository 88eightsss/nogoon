// Card — a reusable rounded container used throughout the app.
// Instead of repeating the same background + border + radius on every screen,
// we wrap content in <Card> and get consistent styling for free.
//
// Usage:
//   <Card>
//     <Text>Hello</Text>
//   </Card>
//
//   <Card style={{ padding: 0 }} elevated>  ← no padding, lighter background
//     ...
//   </Card>

import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface CardProps {
  children: React.ReactNode;

  // 'elevated' uses a slightly lighter background to make the card pop off the screen
  elevated?: boolean;

  // Override or extend the default styles (padding, margin, etc.)
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, elevated = false, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
  },
  elevated: {
    // Slightly lighter background for emphasis
    backgroundColor: COLORS.surfaceHigh,
  },
});
