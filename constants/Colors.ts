// ─── NoGoon Design System ─────────────────────────────────────────────────────
//
// Single source of truth for all colors and fonts.
// Import COLORS and FONTS anywhere — never hardcode hex values in components.
//
// BRAND IDENTITY:
//   Primary  — Indigo (#2e2787) — the main brand color. Deep, trustworthy, bold.
//   Bright   — Indigo Bright (#5b52f0) — used on dark backgrounds where the deep
//              indigo would be too dark to read/see. Active states, icon tints.
//   Purple   — (#9d7cff) — Pro features, Arcade tab, XP bar
//   Cyan     — (#00d4ff) — Profile, info, insights
//   Green    — (#4ade80) — SUCCESS ONLY: checkmarks, streak active, correct answers
//              Green is never used as a brand color — only to mean "good/correct/done"
//
// BACKGROUND SYSTEM:
//   All backgrounds have a faint purple tint to feel cohesive with the brand.
//   background → surface → surfaceHigh is the elevation stack (darkest → lightest).

export const COLORS = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  background:  '#080811',           // Near-black with faint purple tint — every screen bg
  surface:     '#0e0d1c',           // Elevated surface — cards, panels, inputs
  surfaceHigh: '#14132a',           // Highest elevation — selected cards, modals

  // ── Brand accents ─────────────────────────────────────────────────────────────
  // PRIMARY — deep indigo. Used for CTA buttons, active nav, key interactions.
  indigo:      '#2e2787',
  indigoBright:'#5b52f0',           // Readable on dark backgrounds — titles, icon tints
  indigoDim:   'rgba(46,39,135,0.20)', // Glow/background tint for indigo elements
  indigoGlow:  'rgba(91,82,240,0.15)', // Softer — for borders, active tabs

  // SECONDARY — purple. Pro features, Arcade, XP, game accents.
  purple:      '#9d7cff',
  purpleDim:   'rgba(157,124,255,0.12)',

  // TERTIARY — cyan. Profile tab, info banners, insight charts.
  cyan:        '#00d4ff',
  cyanDim:     'rgba(0,212,255,0.12)',

  // SUCCESS — green. Checkmarks, streak badges, correct answers, enabled states.
  // Do NOT use green as a brand color — reserve it exclusively for "success/correct".
  green:       '#4ade80',
  greenDim:    'rgba(74,222,128,0.12)',

  // ── Semantic ──────────────────────────────────────────────────────────────────
  danger:      '#ff4d4d',           // Destructive actions, error states
  dangerDim:   'rgba(255,77,77,0.15)',
  warning:     '#ffb800',           // Caution states, battery warnings, dev mode

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   '#ffffff',         // Main readable text — headings, labels
  textSecondary: '#b8b5d4',         // Supporting text — purple-tinted secondary
  textMuted:     '#4a4870',         // Inactive, placeholders, meta info

  // ── UI chrome ─────────────────────────────────────────────────────────────────
  border:     '#1c1a35',            // Dividers, tab bar border — purple-tinted dark
  cardBorder: '#221f40',            // Card outlines — slightly lighter than border
  overlay:    'rgba(8,8,17,0.88)',  // Modal/sheet backdrops
} as const;

// ─── Font families ─────────────────────────────────────────────────────────────
// These names must exactly match what's registered in useFonts() in app/_layout.tsx.

export const FONTS = {
  display:       'Anybody_700Bold',       // Big titles, headings, hero numbers
  displayRegular:'Anybody_400Regular',    // Display text that doesn't need bold weight
  body:          'DMSans_400Regular',     // All body copy and UI labels
  bodyMedium:    'DMSans_500Medium',      // Slightly emphasized body text
  bodyBold:      'DMSans_700Bold',        // Bold UI labels, button text
  mono:          'JetBrainsMono_400Regular', // Counters, stats, monospace data
  monoBold:      'JetBrainsMono_700Bold', // Large bold numbers (scores, streaks)
} as const;
