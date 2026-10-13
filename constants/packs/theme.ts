// Turns a pack's two anchor color sets into the dark/grey/light triad the theme
// engine (constants/Themes.ts) already understands.

import type { ThemePalette, ThemeTriad } from '@/constants/Themes';
import type { PackColors, PackManifest } from './types';

type RGB = { r: number; g: number; b: number };

const toRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const toHex = ({ r, g, b }: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a), y = toRgb(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
};
export const rgba = (hex: string, a: number) => {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const DEFAULTS = {
  dark:  { protect: '#34F7E0', calm: '#F99F6E', arcade: '#B18FE7', me: '#5BBCF6', danger: '#E28989', warning: '#F99F6E', success: '#7CCA80', overlay: 'rgba(0,4,10,0.88)' },
  light: { protect: '#0B8F84', calm: '#C2571A', arcade: '#6D3FC4', me: '#1E73B8', danger: '#B3261E', warning: '#B45309', success: '#2E7D32', overlay: 'rgba(10,12,20,0.5)' },
};

function derive(c: PackColors, mode: 'dark' | 'light'): ThemePalette {
  const d = DEFAULTS[mode];
  const borderA = mode === 'dark' ? 0.32 : 0.35;
  const cardA   = mode === 'dark' ? 0.55 : 0.6;
  return {
    background: c.background, surface: c.surface, surfaceHigh: c.surfaceHigh,
    accent: c.accent, accentBright: c.accentBright, accentDim: rgba(c.accent, 0.15),
    protect: c.protect ?? d.protect, calm: c.calm ?? d.calm, arcade: c.arcade ?? d.arcade, me: c.me ?? d.me,
    text: c.text, textSecondary: c.textSecondary, textMuted: c.textMuted,
    border: rgba(c.accent, borderA), cardBorder: rgba(c.accent, cardA), overlay: d.overlay,
    danger: d.danger, dangerDim: rgba(d.danger, 0.15),
    warning: d.warning, warningDim: rgba(d.warning, 0.15),
    success: d.success, successDim: rgba(d.success, 0.15),
  };
}

function mixColors(a: PackColors, b: PackColors, t: number): PackColors {
  const out: any = {};
  (Object.keys(a) as (keyof PackColors)[]).forEach((k) => {
    const av = a[k], bv = b[k];
    if (av && bv) out[k] = mix(av, bv, t);
    else if (av) out[k] = av;
  });
  return out as PackColors;
}

const cache = new Map<string, Pick<ThemeTriad, 'dark' | 'grey' | 'light'>>();

// Returns null for packs without a theme part (Core uses the user's own theme).
export function packTriad(pack: PackManifest): Pick<ThemeTriad, 'dark' | 'grey' | 'light'> | null {
  const t = pack.parts.theme;
  if (!t) return null;
  const key = `${pack.id}@${pack.version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const triad = {
    dark:  derive(t.dark, 'dark'),
    grey:  derive(mixColors(t.dark, t.light, 0.5), 'dark'),
    light: derive(t.light, 'light'),
  };
  cache.set(key, triad);
  return triad;
}

// Re-tints any triad (a pack's or a built-in theme's) with the user's own accent color.
export function withAccent<T extends Pick<ThemeTriad, 'dark' | 'grey' | 'light'>>(triad: T, accent: string): T {
  const tint = (p: ThemePalette): ThemePalette => ({
    ...p, accent, accentBright: mix(accent, '#ffffff', 0.35), accentDim: rgba(accent, 0.15),
  });
  return { ...triad, dark: tint(triad.dark), grey: tint(triad.grey), light: tint(triad.light) };
}
