// ─── useThemedColors ──────────────────────────────────────────────────────────
//
// Arcade and its 19 game components were built against the static `COLORS`
// constant in constants/Colors.ts — a single frozen palette from before the
// Dark/Grey/Light theme system existed. That's why Arcade looked unchanged
// no matter what theme or brightness a user picked: every game's styles were
// built once, at module-load time, straight from that constant.
//
// This hook returns an object with the *same shape* as the legacy COLORS
// constant (so call sites barely change) but computed from the live,
// resolved theme palette via useTheme(). Each game file swaps its static
// `import { COLORS } from '@/constants/Colors'` for
// `const COLORS = useThemedColors();`, and its module-level
// `StyleSheet.create({...})` becomes a `makeStyles(COLORS)` function called
// through `useMemo(() => makeStyles(COLORS), [COLORS])` inside the component.
//
// Why useMemo and not a useEffect + setState: useMemo computes the new
// styles synchronously, in the same render/commit as the rest of the screen.
// There's no extra render pass and nothing to flash — the screen just paints
// once, already in the right theme. A useEffect-based approach would commit
// once with stale colors, then re-render a frame later once the effect
// fires — that's the actual mechanism a "flash" comes from, so this sidesteps
// it entirely rather than needing to patch it after the fact.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';

function toRgba(hexOrRgba: string, alpha: number): string {
  if (hexOrRgba[0] === '#') {
    const r = parseInt(hexOrRgba.slice(1, 3), 16);
    const g = parseInt(hexOrRgba.slice(3, 5), 16);
    const b = parseInt(hexOrRgba.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const parts = hexOrRgba.slice(hexOrRgba.indexOf('(') + 1, hexOrRgba.indexOf(')')).split(',').map(Number);
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
}

export type ArcadeColors = {
  background: string;
  surface: string;
  surfaceHigh: string;
  indigo: string;
  indigoBright: string;
  indigoDim: string;
  indigoGlow: string;
  purple: string;
  purpleDim: string;
  arcade: string;
  arcadeDim: string;
  cyan: string;
  cyanDim: string;
  green: string;
  greenDim: string;
  danger: string;
  dangerDim: string;
  warning: string;
  warningDim: string;
  hotPink: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  cardBorder: string;
  overlay: string;
};

// Legacy COLORS name → live theme token mapping. Everything that was a named
// brand color maps to the closest live equivalent by original intent:
//   indigo/purple/cyan/green were the Today/Protect/Me/success accents
//   respectively (see constants/Colors.ts's own brand-identity comment).
export function useThemedColors(): ArcadeColors {
  const { colors } = useTheme();

  return useMemo<ArcadeColors>(() => ({
    background:   colors.background,
    surface:      colors.surface,
    surfaceHigh:  colors.surfaceHigh,

    indigo:       colors.accent,
    indigoBright: colors.accentBright,
    indigoDim:    colors.accentDim,
    indigoGlow:   toRgba(colors.accent, 0.08),

    purple:       colors.protect,
    purpleDim:    toRgba(colors.protect, 0.12),

    arcade:       colors.arcade,
    arcadeDim:    toRgba(colors.arcade, 0.10),

    cyan:         colors.me,
    cyanDim:      toRgba(colors.me, 0.10),

    green:        colors.success,
    greenDim:     colors.successDim,

    danger:       colors.danger,
    dangerDim:    colors.dangerDim,
    warning:      colors.warning,
    warningDim:   colors.warningDim,
    hotPink:      colors.danger,

    textPrimary:  colors.text,
    textSecondary:colors.textSecondary,
    textMuted:    colors.textMuted,

    border:       colors.border,
    cardBorder:   colors.cardBorder,
    overlay:      colors.overlay,
  }), [colors]);
}
