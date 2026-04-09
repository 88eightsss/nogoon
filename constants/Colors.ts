// This file is the single source of truth for GATE's design system.
// Import COLORS and FONTS anywhere in the app instead of hardcoding values.
// That way, if you ever change a color, you only change it in one place.

export const COLORS = {
  // --- Backgrounds ---
  background: '#08080e',          // Deep dark background used on every screen
  surface: '#0f0f1a',             // Slightly lighter — for cards and panels
  surfaceHigh: '#15152a',         // Elevated surface — for highlighted cards

  // --- Brand accents ---
  green: '#6cff5a',               // Primary accent — active shield, streaks, CTA buttons
  greenDim: 'rgba(108,255,90,0.15)', // Faint green — glows and backgrounds
  purple: '#b47aff',              // Secondary accent — games, XP bar
  purpleDim: 'rgba(180,122,255,0.15)',
  cyan: '#00d4ff',                // Tertiary accent — profile, info
  cyanDim: 'rgba(0,212,255,0.15)',

  // --- Semantic ---
  danger: '#ff4d4d',              // Blocked content warnings, destructive actions
  dangerDim: 'rgba(255,77,77,0.15)',
  warning: '#ffb800',             // Caution states

  // --- Text ---
  textPrimary: '#ffffff',         // Main readable text
  textSecondary: '#aaaacc',       // Dimmer supporting text
  textMuted: '#555566',           // Very dim — inactive tabs, placeholders

  // --- UI chrome ---
  border: '#1a1a2e',              // Subtle dividers and tab bar borders
  cardBorder: '#1f1f35',          // Slightly lighter — card outlines
  overlay: 'rgba(8,8,14,0.85)',   // Modal/sheet backdrops
} as const;

// Font family names — these must exactly match the names used in useFonts()
export const FONTS = {
  display: 'Anybody_700Bold',        // Big titles and headings
  displayRegular: 'Anybody_400Regular',
  body: 'DMSans_400Regular',         // All body copy and UI labels
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_400Regular',  // Code, counters, monospace data
  monoBold: 'JetBrainsMono_700Bold',
} as const;
