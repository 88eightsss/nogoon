// Spacing scale — use these instead of hardcoded numbers for margins and padding.
//
// Usage: import { SPACING, RADIUS } from '@/constants/Spacing'
//        style={{ padding: SPACING.lg }}

export const SPACING = {
  xs: 4,    // Tiny gaps — between icon and label
  sm: 8,    // Small gaps — inside compact components
  md: 12,   // Medium gaps — standard component padding
  lg: 16,   // Large gaps — standard screen edge padding
  xl: 20,   // Extra large — section spacing
  xxl: 24,  // Double extra — between major sections
  xxxl: 32, // Triple extra — hero sections
  huge: 48, // Maximum — top of screen breathing room
} as const;

export const RADIUS = {
  xs: 4,    // Tight rounding — small chips, inline badges
  sm: 8,    // Buttons, small badges
  md: 12,   // Cards
  lg: 16,   // Large cards
  xl: 24,   // Pill shapes, modals
  full: 999, // Perfect circle / full pill
} as const;
