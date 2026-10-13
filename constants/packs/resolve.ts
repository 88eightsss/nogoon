// One place that turns (built-in theme | active pack) + brightness + optional accent
// override into the final palette, so useTheme and the tab bar can't drift apart.

import { THEMES, resolveTriadPalette, type ThemeId, type ThemePalette } from '@/constants/Themes';
import type { PackManifest } from './types';
import { packTriad, withAccent } from './theme';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveSkinPalette(
  themeId: ThemeId, brightness: number, pack: PackManifest, accent?: string,
): ThemePalette {
  const base = packTriad(pack) ?? THEMES[themeId];
  const triad = accent && HEX.test(accent) ? withAccent(base, accent) : base;
  return resolveTriadPalette(triad, brightness);
}
