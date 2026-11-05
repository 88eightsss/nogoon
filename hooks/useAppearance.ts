// ─── Appearance: Match phone, Light or Dark (plus "dim at night") ─────────────
// The only colour choice in the app. It decides how bright the one palette is: 100 = Light, 0 = Dark.
// Older settings (six themes, accent colours, border styles, skins) are still saved on the phone but no
// longer change how the app looks.

import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/useThemeStore';

/** Dark after 9 pm and before 6 am, when "Dim at night" is on. */
export function isNightNow(d: Date = new Date()): boolean {
  const h = d.getHours();
  return h >= 21 || h < 6;
}

export function useBrightness(): number {
  const appearance = useThemeStore((s) => s.appearance);
  const dimAtNight = useThemeStore((s) => s.dimAtNight);
  const system = useColorScheme();
  if (dimAtNight && isNightNow()) return 0;
  if (appearance === 'light') return 100;
  if (appearance === 'dark') return 0;
  return system === 'dark' ? 0 : 100;
}
