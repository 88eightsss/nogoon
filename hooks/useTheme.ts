// ─── useTheme hook ────────────────────────────────────────────────────────────
//
// Returns the resolved color palette + border config for the active theme.
// Also exposes struggling mode state and toggle.
//
// Usage:
//   const { colors, border, struggling, setStruggling } = useTheme();
//   style={{ backgroundColor: colors.background }}
//
// Border usage in card style:
//   const cardStyle = useCardStyle();
//
// Color resolution: each theme is a Dark/Grey/Light triad (see
// constants/Themes.ts) and `themeBrightness` (0–100) is a continuous dial
// across them, resolved by resolveThemePalette(). This replaced the old
// single-palette-plus-lightness-shift approach, which only ever nudged
// background/surface/border and left text/accent untouched — producing a
// "weird shade" rather than a real Dark/Grey/Light look.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { BORDERS, DEFAULT_THEME, DEFAULT_BORDER, ThemePalette, BorderConfig } from '@/constants/Themes';
import { resolveSkinPalette } from '@/constants/packs/resolve';
import { CORE_PACK } from '@/constants/packs';
import { useBrightness } from '@/hooks/useAppearance';
import { useThemeStore } from '@/stores/useThemeStore';

export type ThemeHook = {
  colors:       ThemePalette;
  border:       BorderConfig;
  struggling:   boolean;
  setStruggling:(val: boolean) => void;
  // Convenience: card style object — apply to card Views
  cardStyle: {
    borderWidth:    number;
    borderRadius:   number;
    borderStyle?:   'dashed' | 'dotted';
    shadowColor?:   string;
    shadowOpacity?: number;
    shadowRadius?:  number;
    elevation?:     number;
  };
};

export function useTheme(): ThemeHook {
  const { strugglingMode, setStruggling } = useThemeStore();
  // One palette, one border. The only colour choice is Match phone / Light / Dark (hooks/useAppearance.ts).
  const brightness = useBrightness();

  return useMemo(() => {
    const base = resolveSkinPalette(DEFAULT_THEME, brightness, CORE_PACK);
    // Light follows the time of day: a warmer ground in the morning, a cooler one in the evening.
    // (Dark has one palette.) Re-read whenever the screen re-renders, no timer.
    const h = new Date().getHours();
    const ground = brightness >= 100 ? (h >= 5 && h < 11 ? '#F5F2EA' : h >= 17 && h < 21 ? '#EDEFF2' : null) : null;
    const colors = ground ? { ...base, background: ground } : base;
    const border = BORDERS[DEFAULT_BORDER];

    const radius = border.radius; // each style now owns a real radius value directly

    const cardStyle: ThemeHook['cardStyle'] = {
      borderWidth:  border.width,
      borderRadius: radius,
      ...(border.lineStyle && { borderStyle: border.lineStyle }),
      ...(border.glow && {
        shadowColor:   colors.accent,
        shadowOpacity: 0.65,
        shadowRadius:  16,
        elevation:     14,
      }),
    };

    return {
      colors,
      border,
      struggling:   strugglingMode,
      setStruggling,
      cardStyle,
    };
  }, [strugglingMode, setStruggling, brightness]);
}
