// ─── NoGoon Theme System ──────────────────────────────────────────────────────
//
// 6 color themes + 6 border styles, stored in useThemeStore.
// Screens import { useTheme } from '@/hooks/useTheme' and use
//   colors.background, colors.accent, border.radius, etc.
//
// Each theme is a *triad* — Dark, Grey, and Light hand-designed anchor
// palettes — rather than a single flat palette. A continuous 0–100 dial
// (themeBrightness) blends between them via resolveThemePalette():
//   0 ─────────────── 40 ── 50 ── 60 ─────────────── 100
//   Dark ⟶ eased blend ⟶ | Grey (flat) | ⟶ eased blend ⟶ Light
// Dark and Grey both use light text, so that half blends with a plain
// smoothstep — no polarity flip, nothing to hide. Grey and Light disagree on
// text polarity (light text → dark text), so that half uses a sigmoid
// "crossover" curve that holds near each end and concentrates the actual
// flip into a narrow middle band, so most of the dial stays readable.
// Grey shares one neutral, theme-agnostic base (background/surface/text)
// across all six themes — grey has no inherent hue — while accent/protect/
// calm/arcade/me/border/cardBorder/danger/warning/success keep a soft tint
// of each theme's own hue so it still reads as "that theme," not generic.
//
// Adding a new theme: add an entry to THEMES below (dark + grey + light)
// and the union to ThemeId.
// ─────────────────────────────────────────────────────────────────────────────

import { RADIUS } from '@/constants/Spacing';

export type ThemeId = 'forest' | 'midnight' | 'warm' | 'dusk' | 'stone' | 'mocha';
export type BorderId = 'none' | 'sharp' | 'soft' | 'pixel' | 'glow' | 'laced';

// ─── Theme palette shape ──────────────────────────────────────────────────────

export type ThemePalette = {
  // Backgrounds — lightest to most elevated
  background:   string;
  surface:      string;
  surfaceHigh:  string;

  // Primary accent — buttons, highlights, icon tints
  accent:       string;
  accentBright: string;
  accentDim:    string;    // semi-transparent accent for tinted bg areas

  // Tab identity colors (each tab has its own hue)
  protect:      string;
  calm:         string;
  arcade:       string;
  me:           string;

  // Text
  text:         string;
  textSecondary:string;
  textMuted:    string;

  // UI chrome
  border:       string;
  cardBorder:   string;
  overlay:      string;    // modal backdrop

  // Semantic — reuse across themes
  danger:       string;
  dangerDim:    string;
  warning:      string;
  warningDim:   string;
  success:      string;
  successDim:   string;
};

// A theme is three hand-designed anchor palettes plus its identity/label —
// resolveThemePalette() blends between them for the current brightness dial.
export type ThemeTriad = {
  id:         ThemeId;
  name:       string;
  nativeMode: 'dark' | 'light';   // the theme's "home" look — used for preview swatches
  dark:       ThemePalette;
  grey:       ThemePalette;
  light:      ThemePalette;
};

// ─── Theme definitions ────────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeTriad> = {

  // ── Forest — green-tinted, light-native (default, closest to original palette)
  forest: {
    id:         'forest',
    name:       'Forest',
    nativeMode: 'light',
    dark: {
      background:   '#0F1D0F',
      surface:      '#19291A',
      surfaceHigh:  '#233624',
      accent:       '#7CCA80',
      accentBright: '#A3D7A5',
      accentDim:    'rgba(124,202,128,0.15)',
      protect:      '#34F7E0',
      calm:         '#F99F6E',
      arcade:       '#B18FE7',
      me:           '#5BBCF6',
      text:         '#E7EEE7',
      textSecondary:'#A3C2A5',
      textMuted:    '#649067',
      border:       'rgba(124,202,128,0.32)',
      cardBorder:   'rgba(124,202,128,0.55)',
      overlay:      'rgba(0,4,10,0.88)',
      danger:       '#E28989',
      dangerDim:    'rgba(226,137,137,0.15)',
      warning:      '#F99F6E',
      warningDim:   'rgba(249,159,110,0.15)',
      success:      '#7CCA80',
      successDim:   'rgba(124,202,128,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#98CD9B',
      accentBright: '#BCDCBD',
      accentDim:    'rgba(152,205,155,0.16)',
      protect:      '#63E9D9',
      calm:         '#F0B493',
      arcade:       '#C2ABE5',
      me:           '#83C5EC',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(152,205,155,0.22)',
      cardBorder:   'rgba(152,205,155,0.36)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#E1A6A6',
      dangerDim:    'rgba(225,166,166,0.15)',
      warning:      '#F0B493',
      warningDim:   'rgba(240,180,147,0.15)',
      success:      '#98CD9B',
      successDim:   'rgba(152,205,155,0.15)',
    },
    light: {
      background:   '#EEEEEC',
      surface:      '#F6F6F4',
      surfaceHigh:  '#EAEAE7',
      accent:       '#2E7D32',
      accentBright: '#235F26',
      accentDim:    'rgba(46,125,50,0.1)',
      protect:      '#00796B',
      calm:         '#E65100',
      arcade:       '#6D28D9',
      me:           '#0277BD',
      text:         '#1A2E1A',
      textSecondary:'#4A6741',
      textMuted:    '#6B8F65',
      border:       'rgba(46,125,50,0.24)',
      cardBorder:   'rgba(46,125,50,0.4)',
      overlay:      'rgba(14,27,15,0.45)',
      danger:       '#C62828',
      dangerDim:    'rgba(198,40,40,0.1)',
      warning:      '#E65100',
      warningDim:   'rgba(230,81,0,0.1)',
      success:      '#2E7D32',
      successDim:   'rgba(46,125,50,0.1)',
    },
  },

  // ── Midnight — deep slate blue, dark-native
  midnight: {
    id:         'midnight',
    name:       'Midnight',
    nativeMode: 'dark',
    dark: {
      background:   '#0D1B2A',
      surface:      '#152539',
      surfaceHigh:  '#1D3048',
      accent:       '#4D8BFF',
      accentBright: '#6BA3FF',
      accentDim:    'rgba(77,139,255,0.15)',
      protect:      '#26C6DA',
      calm:         '#FFB74D',
      arcade:       '#B388FF',
      me:           '#80CBC4',
      text:         '#E8EEF4',
      textSecondary:'#99B2CC',
      textMuted:    '#5C7A96',
      border:       'rgba(77,139,255,0.32)',
      cardBorder:   'rgba(77,139,255,0.55)',
      overlay:      'rgba(0,10,20,0.88)',
      danger:       '#EF5350',
      dangerDim:    'rgba(239,83,80,0.15)',
      warning:      '#FFB74D',
      warningDim:   'rgba(255,183,77,0.15)',
      success:      '#66BB6A',
      successDim:   'rgba(102,187,106,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#8FB4EE',
      accentBright: '#A8C6FF',
      accentDim:    'rgba(143,180,238,0.16)',
      protect:      '#6FD0DE',
      calm:         '#FFC97A',
      arcade:       '#C7ACFF',
      me:           '#A3DCD4',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(143,180,238,0.20)',
      cardBorder:   'rgba(143,180,238,0.34)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#F09B99',
      dangerDim:    'rgba(240,155,153,0.15)',
      warning:      '#FFC97A',
      warningDim:   'rgba(255,201,122,0.15)',
      success:      '#A3D8A6',
      successDim:   'rgba(163,216,166,0.15)',
    },
    light: {
      background:   '#F3F6FC',
      surface:      '#FFFFFF',
      surfaceHigh:  '#E7EEF9',
      accent:       '#3568D4',
      accentBright: '#4D8BFF',
      accentDim:    'rgba(53,104,212,0.10)',
      protect:      '#007A8C',
      calm:         '#C65D00',
      arcade:       '#6A3FD6',
      me:           '#00796B',
      text:         '#12202E',
      textSecondary:'#45607A',
      textMuted:    '#6F8CA6',
      border:       'rgba(53,104,212,0.25)',
      cardBorder:   'rgba(53,104,212,0.40)',
      overlay:      'rgba(10,20,35,0.45)',
      danger:       '#D32F2F',
      dangerDim:    'rgba(211,47,47,0.1)',
      warning:      '#C65D00',
      warningDim:   'rgba(198,93,0,0.1)',
      success:      '#2E7D32',
      successDim:   'rgba(46,125,50,0.1)',
    },
  },

  // ── Warm — amber-accented, dark-native
  warm: {
    id:         'warm',
    name:       'Warm',
    nativeMode: 'dark',
    dark: {
      background:   '#0F172A',
      surface:      '#1E293B',
      surfaceHigh:  '#273447',
      accent:       '#F59E0B',
      accentBright: '#F7B546',
      accentDim:    'rgba(245,158,11,0.15)',
      protect:      '#34D399',
      calm:         '#FB923C',
      arcade:       '#A78BFA',
      me:           '#60A5FA',
      text:         '#F1F5F9',
      textSecondary:'#94A3B8',
      textMuted:    '#64748B',
      border:       'rgba(245,158,11,0.32)',
      cardBorder:   'rgba(245,158,11,0.55)',
      overlay:      'rgba(0,4,10,0.88)',
      danger:       '#F87171',
      dangerDim:    'rgba(248,113,113,0.15)',
      warning:      '#FB923C',
      warningDim:   'rgba(251,146,60,0.15)',
      success:      '#34D399',
      successDim:   'rgba(52,211,153,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#E7C07E',
      accentBright: '#EDD4AB',
      accentDim:    'rgba(231,192,126,0.16)',
      protect:      '#90D8BE',
      calm:         '#EDBC93',
      arcade:       '#C5B6F2',
      me:           '#A3C5EF',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(231,192,126,0.22)',
      cardBorder:   'rgba(231,192,126,0.36)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#EFABAB',
      dangerDim:    'rgba(239,171,171,0.15)',
      warning:      '#EDBC93',
      warningDim:   'rgba(237,188,147,0.15)',
      success:      '#90D8BE',
      successDim:   'rgba(144,216,190,0.15)',
    },
    light: {
      background:   '#F9F7F3',
      surface:      '#FEFEFE',
      surfaceHigh:  '#F1EDE7',
      accent:       '#B37205',
      accentBright: '#F59E0B',
      accentDim:    'rgba(179,114,5,0.1)',
      protect:      '#1BA070',
      calm:         '#D16105',
      arcade:       '#4306F9',
      me:           '#0669E3',
      text:         '#2B2417',
      textSecondary:'#706148',
      textMuted:    '#9A8C74',
      border:       'rgba(179,114,5,0.24)',
      cardBorder:   'rgba(179,114,5,0.4)',
      overlay:      'rgba(27,22,14,0.45)',
      danger:       '#EB0606',
      dangerDim:    'rgba(235,6,6,0.1)',
      warning:      '#D16105',
      warningDim:   'rgba(209,97,5,0.1)',
      success:      '#1BA070',
      successDim:   'rgba(27,160,112,0.1)',
    },
  },

  // ── Dusk — deep purple with soft pink accents, dark-native
  dusk: {
    id:         'dusk',
    name:       'Dusk',
    nativeMode: 'dark',
    dark: {
      background:   '#1A0A2E',
      surface:      '#261040',
      surfaceHigh:  '#321652',
      accent:       '#EC4899',
      accentBright: '#F27FB8',
      accentDim:    'rgba(236,72,153,0.15)',
      protect:      '#34D399',
      calm:         '#FB923C',
      arcade:       '#C084FC',
      me:           '#67E8F9',
      text:         '#F5F0FA',
      textSecondary:'#C4B5D9',
      textMuted:    '#8B7DA8',
      border:       'rgba(236,72,153,0.32)',
      cardBorder:   'rgba(236,72,153,0.55)',
      overlay:      'rgba(0,4,10,0.88)',
      danger:       '#F87171',
      dangerDim:    'rgba(248,113,113,0.15)',
      warning:      '#FB923C',
      warningDim:   'rgba(251,146,60,0.15)',
      success:      '#34D399',
      successDim:   'rgba(52,211,153,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#E184B2',
      accentBright: '#E9AFCC',
      accentDim:    'rgba(225,132,178,0.16)',
      protect:      '#7DD2B3',
      calm:         '#EAAE7D',
      arcade:       '#C59CEF',
      me:           '#90E0EB',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(225,132,178,0.22)',
      cardBorder:   'rgba(225,132,178,0.36)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#EB9595',
      dangerDim:    'rgba(235,149,149,0.15)',
      warning:      '#EAAE7D',
      warningDim:   'rgba(234,174,125,0.15)',
      success:      '#7DD2B3',
      successDim:   'rgba(125,210,179,0.15)',
    },
    light: {
      background:   '#F9F3F6',
      surface:      '#FEFEFE',
      surfaceHigh:  '#F1E7EC',
      accent:       '#AE0A5B',
      accentBright: '#EC4899',
      accentDim:    'rgba(174,10,91,0.1)',
      protect:      '#17885F',
      calm:         '#B55405',
      arcade:       '#7106DC',
      me:           '#049AAD',
      text:         '#2B1721',
      textSecondary:'#70485C',
      textMuted:    '#9A7487',
      border:       'rgba(174,10,91,0.24)',
      cardBorder:   'rgba(174,10,91,0.4)',
      overlay:      'rgba(27,14,20,0.45)',
      danger:       '#CF0505',
      dangerDim:    'rgba(207,5,5,0.1)',
      warning:      '#B55405',
      warningDim:   'rgba(181,84,5,0.1)',
      success:      '#17885F',
      successDim:   'rgba(23,136,95,0.1)',
    },
  },

  // ── Stone — near-monochrome charcoal/cream, dark-native
  stone: {
    id:         'stone',
    name:       'Stone',
    nativeMode: 'dark',
    dark: {
      background:   '#1C1917',
      surface:      '#292524',
      surfaceHigh:  '#352F2D',
      accent:       '#D6D3D1',
      accentBright: '#DBD8D7',
      accentDim:    'rgba(214,211,209,0.15)',
      protect:      '#78716C',
      calm:         '#A8A29E',
      arcade:       '#B8B0A8',
      me:           '#9CA3AF',
      text:         '#F5F5F4',
      textSecondary:'#A8A29E',
      textMuted:    '#78716C',
      border:       'rgba(214,211,209,0.32)',
      cardBorder:   'rgba(214,211,209,0.55)',
      overlay:      'rgba(0,4,10,0.88)',
      danger:       '#F87171',
      dangerDim:    'rgba(248,113,113,0.15)',
      warning:      '#FCD34D',
      warningDim:   'rgba(252,211,77,0.15)',
      success:      '#86EFAC',
      successDim:   'rgba(134,239,172,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#B6B2AF',
      accentBright: '#CECCCA',
      accentDim:    'rgba(182,178,175,0.16)',
      protect:      '#989390',
      calm:         '#9E9996',
      arcade:       '#A8A19A',
      me:           '#9499A3',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(182,178,175,0.22)',
      cardBorder:   'rgba(182,178,175,0.36)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#E26464',
      dangerDim:    'rgba(226,100,100,0.15)',
      warning:      '#E4C252',
      warningDim:   'rgba(228,194,82,0.15)',
      success:      '#73D998',
      successDim:   'rgba(115,217,152,0.15)',
    },
    light: {
      background:   '#F9F6F3',
      surface:      '#FEFEFE',
      surfaceHigh:  '#F1EBE7',
      accent:       '#625B56',
      accentBright: '#D6D3D1',
      accentDim:    'rgba(98,91,86,0.1)',
      protect:      '#363330',
      calm:         '#45403D',
      arcade:       '#504840',
      me:           '#3B404A',
      text:         '#2B1F17',
      textSecondary:'#705848',
      textMuted:    '#9A8374',
      border:       'rgba(98,91,86,0.24)',
      cardBorder:   'rgba(98,91,86,0.4)',
      overlay:      'rgba(27,19,14,0.45)',
      danger:       '#920404',
      dangerDim:    'rgba(146,4,4,0.1)',
      warning:      '#816303',
      warningDim:   'rgba(129,99,3,0.1)',
      success:      '#0C903C',
      successDim:   'rgba(12,144,60,0.1)',
    },
  },

  // ── Mocha — warm beige/brown, light-native
  mocha: {
    id:         'mocha',
    name:       'Mocha',
    nativeMode: 'light',
    dark: {
      background:   '#1D150F',
      surface:      '#292019',
      surfaceHigh:  '#362B23',
      accent:       '#C59F82',
      accentBright: '#D3BAA6',
      accentDim:    'rgba(197,159,130,0.15)',
      protect:      '#8EB8A9',
      calm:         '#E5A06F',
      arcade:       '#B1A0C5',
      me:           '#90B0C7',
      text:         '#EEEAE7',
      textSecondary:'#C2B0A3',
      textMuted:    '#907764',
      border:       'rgba(197,159,130,0.32)',
      cardBorder:   'rgba(197,159,130,0.55)',
      overlay:      'rgba(0,4,10,0.88)',
      danger:       '#D88282',
      dangerDim:    'rgba(216,130,130,0.15)',
      warning:      '#E5A06F',
      warningDim:   'rgba(229,160,111,0.15)',
      success:      '#9CB989',
      successDim:   'rgba(156,185,137,0.15)',
    },
    grey: {
      background:   '#3A3E45',
      surface:      '#454A52',
      surfaceHigh:  '#50565F',
      accent:       '#C9AF9C',
      accentBright: '#DACABE',
      accentDim:    'rgba(201,175,156,0.16)',
      protect:      '#A4C1B6',
      calm:         '#E0B291',
      arcade:       '#BFB4CC',
      me:           '#A8BDCC',
      text:         '#E7E9EC',
      textSecondary:'#AEB3BA',
      textMuted:    '#7D828A',
      border:       'rgba(201,175,156,0.22)',
      cardBorder:   'rgba(201,175,156,0.36)',
      overlay:      'rgba(10,12,15,0.55)',
      danger:       '#D89E9E',
      dangerDim:    'rgba(216,158,158,0.15)',
      warning:      '#E0B291',
      warningDim:   'rgba(224,178,145,0.15)',
      success:      '#ADC1A0',
      successDim:   'rgba(173,193,160,0.15)',
    },
    light: {
      background:   '#faf7f4',
      surface:      '#f0e9e0',
      surfaceHigh:  '#e8ddd0',
      accent:       '#8b5e3c',
      accentBright: '#6F4B30',
      accentDim:    'rgba(139,94,60,0.1)',
      protect:      '#4a7c6a',
      calm:         '#c4621c',
      arcade:       '#7c5ea0',
      me:           '#4a7a9b',
      text:         '#1e1008',
      textSecondary:'#5c4030',
      textMuted:    '#8a6a50',
      border:       'rgba(139,94,60,0.24)',
      cardBorder:   'rgba(139,94,60,0.4)',
      overlay:      'rgba(27,20,14,0.45)',
      danger:       '#b83232',
      dangerDim:    'rgba(184,50,50,0.1)',
      warning:      '#c4621c',
      warningDim:   'rgba(196,98,28,0.1)',
      success:      '#5a7a45',
      successDim:   'rgba(90,122,69,0.1)',
    },
  },
};

// ─── Border style shape ───────────────────────────────────────────────────────

export type BorderConfig = {
  id:          BorderId;
  name:        string;
  width:       number;   // card border width
  radius:      number;   // actual corner radius in px -- each style owns a real value now,
                          // not a 0/-1 sentinel, so the styles read as genuinely different
                          // shapes instead of collapsing into "square" vs "default rounded"
  glow:        boolean;  // whether to apply a glow shadow on cards
  lineStyle?:  'dashed' | 'dotted'; // RN borderStyle override -- omitted means 'solid'
};

// Width, radius, glow AND lineStyle now all vary per style -- previously sharp/pixel
// shared radius:0 (differing only by 1px width) and soft/glow shared radius:-1
// (differing only by width+glow), which read as noise at real UI sizes. Each style
// now claims its own point on the radius spectrum (square -> tight -> default -> pill)
// so they stay distinct at a glance, not just when compared side by side.
export const BORDERS: Record<BorderId, BorderConfig> = {
  none:  { id: 'none',  name: 'Clean',   width: 0,   radius: RADIUS.lg, glow: false },
  sharp: { id: 'sharp', name: 'Sharp',   width: 2,   radius: 0,         glow: false },
  soft:  { id: 'soft',  name: 'Soft',    width: 1.5, radius: RADIUS.xl, glow: false },
  pixel: { id: 'pixel', name: 'Chunky',  width: 4,   radius: RADIUS.xs, glow: false },
  glow:  { id: 'glow',  name: 'Neon',    width: 2,   radius: RADIUS.lg, glow: true  },
  // A dotted RN border at a decent width reads as a stitched/lace trim, especially
  // paired with a mid rounding -- distinct from every other style on line quality
  // alone, not just width/radius, so it holds up even if a future style needs to
  // reuse a radius value.
  laced: { id: 'laced', name: 'Laced',   width: 2,   radius: RADIUS.md, glow: false, lineStyle: 'dotted' },
};

// ─── Order + defaults ─────────────────────────────────────────────────────────

export const THEME_ORDER: ThemeId[] = ['forest', 'midnight', 'warm', 'dusk', 'stone', 'mocha'];
export const BORDER_ORDER: BorderId[] = ['none', 'sharp', 'soft', 'pixel', 'glow', 'laced'];

export const DEFAULT_THEME: ThemeId = 'forest';
export const DEFAULT_BORDER: BorderId = 'soft';

// ─── Brightness dial — resolves a continuous 0–100 value into a ThemePalette ──
//
// See the header comment for the shape of the blend. Ported 1:1 from the
// validated interactive prototype (color math + curve constants), just
// generalized from one theme to all six.

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(c: string): RGBA {
  if (c[0] === '#') {
    return {
      r: parseInt(c.slice(1, 3), 16),
      g: parseInt(c.slice(3, 5), 16),
      b: parseInt(c.slice(5, 7), 16),
      a: 1,
    };
  }
  const parts = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number);
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function lerpColorStr(c1: string, c2: string, t: number): string {
  const a = parseColor(c1), b = parseColor(c2);
  const r  = Math.round(a.r + (b.r - a.r) * t);
  const g  = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  const al = a.a + (b.a - a.a) * t;
  if (al < 1) return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
  const toHex = (x: number) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function lerpPalette(a: ThemePalette, b: ThemePalette, t: number): ThemePalette {
  const out = {} as ThemePalette;
  (Object.keys(a) as (keyof ThemePalette)[]).forEach((key) => {
    out[key] = lerpColorStr(a[key], b[key], t);
  });
  return out;
}

// Dark and Grey both use light text — safe to blend smoothly, no polarity flip.
function smoothEase(t: number): number {
  return t * t * (3 - 2 * t);
}

// Grey and Light disagree on text polarity, so this curve holds near each
// end and concentrates the actual crossover into a narrow middle band.
function crossoverEase(t: number, k = 9): number {
  const raw = 1 / (1 + Math.exp(-k * (t - 0.5)));
  const min = 1 / (1 + Math.exp(k * 0.5));
  const max = 1 / (1 + Math.exp(-k * 0.5));
  return (raw - min) / (max - min);
}

// Percent on each side of 50 that stays pure Grey — a flat, unblended anchor
// instead of pure math, so "Grey mode" is a real, recognizable stop.
const GREY_PLATEAU = 10;

export function resolveThemePalette(themeId: ThemeId, brightness: number): ThemePalette {
  const triad = THEMES[themeId];
  const pct = Math.max(0, Math.min(100, brightness));
  const loEnd = 50 - GREY_PLATEAU;
  const hiStart = 50 + GREY_PLATEAU;

  if (pct <= loEnd) {
    return lerpPalette(triad.dark, triad.grey, smoothEase(pct / loEnd));
  }
  if (pct >= hiStart) {
    return lerpPalette(triad.grey, triad.light, crossoverEase((pct - hiStart) / (100 - hiStart)));
  }
  return triad.grey;
}

// Label for the brightness dial readout — mirrors the prototype.
export function brightnessLabel(pct: number): 'Dark' | 'Mostly dark' | 'Grey' | 'Mostly light' | 'Light' {
  if (pct <= 8) return 'Dark';
  if (pct < 40) return 'Mostly dark';
  if (pct <= 60) return 'Grey';
  if (pct < 92) return 'Mostly light';
  return 'Light';
}
