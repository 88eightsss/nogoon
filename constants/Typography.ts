// Typography presets — ready-made text styles you can spread into your StyleSheet.
// Instead of writing fontFamily + fontSize + color on every Text component,
// just import the preset that matches what you need.
//
// Usage:
//   import { TYPE } from '@/constants/Typography'
//   <Text style={[TYPE.headingL, { color: COLORS.green }]}>Hello</Text>

import { TextStyle } from 'react-native';
import { COLORS, FONTS } from './Colors';

// The 'as const' at the bottom locks the types so TypeScript can check them
export const TYPE: Record<string, TextStyle> = {

  // --- Display / Headings (Anybody font — big, bold, Gen Z energy) ---
  headingXL: {
    fontFamily: FONTS.display,
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headingL: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headingM: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  headingS: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.textPrimary,
  },

  // --- Body text (DM Sans — clean, readable) ---
  bodyL: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 26,
  },
  bodyM: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  bodyS: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  bodyXS: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },

  // --- Labels (small, uppercase — for section headers and badges) ---
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // --- Monospace (JetBrains Mono — numbers, counters, code) ---
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  monoL: {
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    color: COLORS.textPrimary,
  },
  monoXL: {
    fontFamily: FONTS.monoBold,
    fontSize: 48,
    color: COLORS.textPrimary,
  },
  monoS: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
};
