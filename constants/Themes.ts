// ─── NoGoon Theme System ──────────────────────────────────────────────────────
//
// 5 color themes + 5 border styles, stored in useThemeStore.
// Screens import { useTheme } from '@/hooks/useTheme' and use
//   colors.background, colors.accent, border.radius, etc.
//
// Adding a new theme: add an entry to THEMES below and the union to ThemeId.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeId = 'forest' | 'midnight' | 'warm' | 'dusk' | 'stone';
export type BorderId = 'none' | 'sharp' | 'soft' | 'pixel' | 'glow';

// ─── Theme palette shape ──────────────────────────────────────────────────────

export type ThemePalette = {
  id:           ThemeId;
  name:         string;
  dark:         boolean;   // true = dark-background theme

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

// ─── Theme definitions ────────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, ThemePalette> = {

  // ── Forest — light, green-tinted (default, closest to original palette)
  forest: {
    id:           'forest',
    name:         'Forest',
    dark:         false,
    background:   '#EEEEEC',
    surface:      '#F6F6F4',
    surfaceHigh:  '#EAEAE7',
    accent:       '#2E7D32',
    accentBright: '#388E3C',
    accentDim:    'rgba(46,125,50,0.10)',
    protect:      '#00796B',
    calm:         '#E65100',
    arcade:       '#6D28D9',
    me:           '#0277BD',
    text:         '#1A2E1A',
    textSecondary:'#4A6741',
    textMuted:    '#6B8F65',
    border:       '#C8E6C9',
    cardBorder:   '#B0D9B0',
    overlay:      'rgba(27,46,27,0.85)',
    danger:       '#C62828',
    dangerDim:    'rgba(198,40,40,0.10)',
    warning:      '#E65100',
    warningDim:   'rgba(230,81,0,0.10)',
    success:      '#2E7D32',
    successDim:   'rgba(46,125,50,0.10)',
  },

  // ── Midnight — deep slate blue, clean white text
  midnight: {
    id:           'midnight',
    name:         'Midnight',
    dark:         true,
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
    border:       'rgba(77,139,255,0.18)',
    cardBorder:   'rgba(77,139,255,0.28)',
    overlay:      'rgba(0,10,20,0.88)',
    danger:       '#EF5350',
    dangerDim:    'rgba(239,83,80,0.15)',
    warning:      '#FFB74D',
    warningDim:   'rgba(255,183,77,0.15)',
    success:      '#66BB6A',
    successDim:   'rgba(102,187,106,0.15)',
  },

  // ── Warm — dark navy with amber accents
  warm: {
    id:           'warm',
    name:         'Warm',
    dark:         true,
    background:   '#0F172A',
    surface:      '#1E293B',
    surfaceHigh:  '#273447',
    accent:       '#F59E0B',
    accentBright: '#FBBF24',
    accentDim:    'rgba(245,158,11,0.15)',
    protect:      '#34D399',
    calm:         '#FB923C',
    arcade:       '#A78BFA',
    me:           '#60A5FA',
    text:         '#F1F5F9',
    textSecondary:'#94A3B8',
    textMuted:    '#64748B',
    border:       'rgba(245,158,11,0.18)',
    cardBorder:   'rgba(245,158,11,0.28)',
    overlay:      'rgba(0,5,20,0.88)',
    danger:       '#F87171',
    dangerDim:    'rgba(248,113,113,0.15)',
    warning:      '#FB923C',
    warningDim:   'rgba(251,146,60,0.15)',
    success:      '#34D399',
    successDim:   'rgba(52,211,153,0.15)',
  },

  // ── Dusk — deep purple with soft pink accents
  dusk: {
    id:           'dusk',
    name:         'Dusk',
    dark:         true,
    background:   '#1A0A2E',
    surface:      '#261040',
    surfaceHigh:  '#321652',
    accent:       '#EC4899',
    accentBright: '#F472B6',
    accentDim:    'rgba(236,72,153,0.15)',
    protect:      '#34D399',
    calm:         '#FB923C',
    arcade:       '#C084FC',
    me:           '#67E8F9',
    text:         '#F5F0FA',
    textSecondary:'#C4B5D9',
    textMuted:    '#8B7DA8',
    border:       'rgba(236,72,153,0.18)',
    cardBorder:   'rgba(236,72,153,0.28)',
    overlay:      'rgba(10,0,25,0.88)',
    danger:       '#F87171',
    dangerDim:    'rgba(248,113,113,0.15)',
    warning:      '#FB923C',
    warningDim:   'rgba(251,146,60,0.15)',
    success:      '#34D399',
    successDim:   'rgba(52,211,153,0.15)',
  },

  // ── Stone — dark charcoal with warm cream text
  stone: {
    id:           'stone',
    name:         'Stone',
    dark:         true,
    background:   '#1C1917',
    surface:      '#292524',
    surfaceHigh:  '#352F2D',
    accent:       '#D6D3D1',
    accentBright: '#E7E5E4',
    accentDim:    'rgba(214,211,209,0.12)',
    protect:      '#78716C',
    calm:         '#A8A29E',
    arcade:       '#B8B0A8',
    me:           '#9CA3AF',
    text:         '#F5F5F4',
    textSecondary:'#A8A29E',
    textMuted:    '#78716C',
    border:       'rgba(214,211,209,0.15)',
    cardBorder:   'rgba(214,211,209,0.25)',
    overlay:      'rgba(0,0,0,0.88)',
    danger:       '#F87171',
    dangerDim:    'rgba(248,113,113,0.15)',
    warning:      '#FCD34D',
    warningDim:   'rgba(252,211,77,0.15)',
    success:      '#86EFAC',
    successDim:   'rgba(134,239,172,0.15)',
  },
};

// ─── Border style shape ───────────────────────────────────────────────────────

export type BorderConfig = {
  id:     BorderId;
  name:   string;
  width:  number;   // card border width
  // Radius override: 0 = square, -1 = use RADIUS defaults
  radius: number;
  glow:   boolean;  // whether to apply a glow shadow on cards
};

export const BORDERS: Record<BorderId, BorderConfig> = {
  none:  { id: 'none',  name: 'Clean',   width: 0,   radius: -1, glow: false },
  sharp: { id: 'sharp', name: 'Sharp',   width: 2,   radius: 0,  glow: false },
  soft:  { id: 'soft',  name: 'Soft',    width: 1.5, radius: -1, glow: false },
  pixel: { id: 'pixel', name: 'Chunky',  width: 3,   radius: 0,  glow: false },
  glow:  { id: 'glow',  name: 'Neon',    width: 2,   radius: -1, glow: true  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const THEME_ORDER: ThemeId[] = ['forest', 'midnight', 'warm', 'dusk', 'stone'];
export const BORDER_ORDER: BorderId[] = ['none', 'sharp', 'soft', 'pixel', 'glow'];

export const DEFAULT_THEME: ThemeId = 'forest';
export const DEFAULT_BORDER: BorderId = 'soft';
