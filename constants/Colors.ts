// ─── NoGoon Design System ─────────────────────────────────────────────────────
//
// Single source of truth for all colors and fonts.
// Import COLORS for the single light green/white palette.
//
// BRAND IDENTITY:
//   Primary  — Forest Green (#1B5E20) — deep, trustworthy, grounding.
//   Bright   — Forest Green mid (#388E3C) — buttons, interactive elements on white.
//   Teal     — (#00796B) — Pro features, Arcade tab, XP bar
//   Blue     — (#0277BD) — Profile, info, insights
//   Green    — (#2E7D32) — SUCCESS: checkmarks, streak active, correct answers
//              Aligns with brand direction — green = healthy, correct, good.
//
// BACKGROUND SYSTEM:
//   Light: background → surface → surfaceHigh (lightest → slightly elevated)

export const COLORS = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  background:  '#EEEEEC',           // Warm neutral gray — every screen bg
  surface:     '#F6F6F4',           // Warm off-white — cards, panels, inputs
  surfaceHigh: '#EAEAE7',           // Slightly elevated — selected cards, modals

  // ── Brand accents ─────────────────────────────────────────────────────────────
  indigo:      '#1B5E20',           // Deep forest green — dark brand anchor
  indigoBright:'#388E3C',           // Forest green — buttons, active states, icon tints
  indigoDim:   'rgba(56,142,60,0.12)',
  indigoGlow:  'rgba(56,142,60,0.08)',

  purple:      '#00796B',           // Teal — Block tab identity, Pro features, XP bar
  purpleDim:   'rgba(0,121,107,0.12)',

  arcade:      '#6D28D9',           // Purple — Arcade card, distinct from all tabs
  arcadeDim:   'rgba(109,40,217,0.10)',

  cyan:        '#0277BD',           // Calm blue — Profile, info, insights
  cyanDim:     'rgba(2,119,189,0.10)',

  // SUCCESS + brand green. Checkmarks, streak badges, correct answers.
  green:       '#2E7D32',           // Forest green — aligns with primary brand
  greenDim:    'rgba(46,125,50,0.10)',

  // ── Semantic ──────────────────────────────────────────────────────────────────
  danger:      '#C62828',           // Deep red — destructive actions, errors
  dangerDim:   'rgba(198,40,40,0.10)',
  warning:     '#E65100',           // Deep amber — caution, Calm tab
  warningDim:  'rgba(230,81,0,0.10)',
  hotPink:     '#AD1457',           // Deep berry — critical alerts, blocking disabled

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   '#1A2E1A',         // Near-black with green tint — easy on the eyes
  textSecondary: '#4A6741',         // Medium sage — subtitles, labels
  textMuted:     '#6B8F65',         // Light sage — hints, timestamps, placeholders

  // ── UI chrome ─────────────────────────────────────────────────────────────────
  border:     '#C8E6C9',            // Light green border
  cardBorder: '#B0D9B0',            // Slightly stronger card border
  overlay:    'rgba(27,46,27,0.85)',// Dark green modal overlay
} as const;


// ─── Font families ─────────────────────────────────────────────────────────────
// These names must exactly match what's registered in useFonts() in app/_layout.tsx.

export const FONTS = {
  display:       'Anybody_700Bold',
  displayRegular:'Anybody_400Regular',
  body:          'DMSans_400Regular',
  bodyMedium:    'DMSans_500Medium',
  bodyBold:      'DMSans_700Bold',
  mono:          'JetBrainsMono_400Regular',
  monoBold:      'JetBrainsMono_700Bold',
} as const;
