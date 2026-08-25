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
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { THEMES, BORDERS, ThemePalette, BorderConfig } from '@/constants/Themes';
import { useThemeStore } from '@/stores/useThemeStore';
import { RADIUS } from '@/constants/Spacing';

export type ThemeHook = {
  colors:       ThemePalette;
  border:       BorderConfig;
  struggling:   boolean;
  setStruggling:(val: boolean) => void;
  // Convenience: card style object — apply to card Views
  cardStyle: {
    borderWidth:    number;
    borderRadius:   number;
    shadowColor?:   string;
    shadowOpacity?: number;
    shadowRadius?:  number;
    elevation?:     number;
  };
};

export function useTheme(): ThemeHook {
  const { themeId, borderId, strugglingMode, setStruggling } = useThemeStore();

  return useMemo(() => {
    const colors = THEMES[themeId];
    const border = BORDERS[borderId];

    const radius = border.radius === -1 ? RADIUS.lg : border.radius;

    const cardStyle: ThemeHook['cardStyle'] = {
      borderWidth:  border.width,
      borderRadius: radius,
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
  }, [themeId, borderId, strugglingMode, setStruggling]);
}
