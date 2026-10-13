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
import { BORDERS, ThemePalette, BorderConfig, resolveThemePalette, resolveTriadPalette } from '@/constants/Themes';
import { packTriad } from '@/constants/packs';
import { useActivePack } from '@/hooks/usePack';
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
  const { themeId, borderId, strugglingMode, setStruggling, themeBrightness } = useThemeStore();
  // An active pack with a theme part overrides the user's own theme/border; Core has none.
  const pack = useActivePack();

  return useMemo(() => {
    const triad  = packTriad(pack);
    const colors = triad ? resolveTriadPalette(triad, themeBrightness) : resolveThemePalette(themeId, themeBrightness);
    const border = BORDERS[pack.parts.shape?.borderId ?? borderId];

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
  }, [themeId, borderId, strugglingMode, setStruggling, themeBrightness, pack]);
}
